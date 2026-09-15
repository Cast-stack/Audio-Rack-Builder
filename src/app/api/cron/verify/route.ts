/**
 * GET /api/cron/verify — re-check the oldest records against current sources.
 *
 * A sweep that finds nothing new writes a fresh verifiedAt and stops. A sweep
 * that finds a change writes a revision and opens a diff for review; it never
 * edits the live device. Vercel cron calls this with CRON_SECRET as a bearer
 * token.
 */

import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

import { prisma } from "@/lib/db/client";
import { researchDevice } from "@/lib/gear/research";
import { CATEGORY_NAMES, MANUFACTURER_DOMAINS } from "@/lib/gear/catalog";
import { finishJob, recordRevision, startJob } from "@/lib/gear/persist";
import { toDeviceSpec } from "@/lib/db/mappers";
import type { Device as ResearchedDevice } from "@/lib/gear/schema";
import type { DeviceSpec } from "@/lib/rack/types";

export const maxDuration = 300;

/** Keep each run small so one cron invocation always finishes. */
const BATCH = 5;

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "not configured" }, { status: 503 });
  }

  const stale = await prisma.device.findMany({
    where: { status: { not: "DISCONTINUED" } },
    include: { ports: true, manufacturer: true, category: true },
    orderBy: [{ verifiedAt: { sort: "asc", nulls: "first" } }],
    take: BATCH,
  });

  const client = new Anthropic();
  const checked: { device: string; disposition: string; changed: boolean }[] = [];

  for (const row of stale) {
    const job = await startJob("VERIFY", `${row.manufacturer.name} ${row.model}`);
    try {
      const outcome = await researchDevice(client, {
        query: `${row.manufacturer.name} ${row.model}`,
        categories: CATEGORY_NAMES,
        allowedDomains: MANUFACTURER_DOMAINS,
        existing: toDeviceSpec(row),
        maxSearches: 4,
        maxFetches: 6,
      });
      await finishJob(job.id, outcome.usage);

      if (!outcome.result) {
        checked.push({ device: row.slug, disposition: "failed", changed: false });
        continue;
      }

      const changed = differs(outcome.result.device, toDeviceSpec(row), row.status);
      if (changed) {
        await recordRevision({
          jobId: job.id,
          result: outcome.result,
          disposition: outcome.disposition,
          issues: outcome.issues,
          deviceId: row.id,
        });
      } else {
        await prisma.device.update({
          where: { id: row.id },
          data: { verifiedAt: new Date() },
        });
      }
      checked.push({ device: row.slug, disposition: outcome.disposition, changed });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await finishJob(job.id, { inputTokens: 0, outputTokens: 0, searches: 0, fetches: 0 }, message);
      checked.push({ device: row.slug, disposition: "error", changed: false });
    }
  }

  return NextResponse.json({ checked });
}

/**
 * Only the figures a rack build depends on count as a change worth reviewing.
 * A reworded description is not a reason to put a record in front of a person.
 */
const MATERIAL_FIELDS = [
  "rackUnits",
  "depthMm",
  "weightLb",
  "powerTypicalW",
  "powerMaxW",
] as const;

const STATUS_FROM_PAYLOAD = {
  current: "CURRENT",
  discontinued: "DISCONTINUED",
  announced: "ANNOUNCED",
} as const;

function differs(next: ResearchedDevice, current: DeviceSpec, currentStatus: string): boolean {
  if (STATUS_FROM_PAYLOAD[next.status] !== currentStatus) return true;
  return MATERIAL_FIELDS.some((f) => next[f] !== current[f]);
}
