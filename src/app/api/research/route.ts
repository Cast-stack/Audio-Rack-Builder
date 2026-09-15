/**
 * POST /api/research  { query, publish?: boolean }
 *
 * Researches one device against manufacturer sources and stores the result as
 * a revision with its evidence. Publishes only when the guardrails return
 * auto-publish — everything else waits for a person.
 *
 * This is the admin/enrichment entry point. The user-facing "gear not found"
 * path is /api/gear/lookup, which uses a tighter budget because someone is
 * watching the spinner.
 */

import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

import { researchDevice } from "@/lib/gear/research";
import { CATEGORY_NAMES, MANUFACTURER_DOMAINS } from "@/lib/gear/catalog";
import { finishJob, publishRevision, recordRevision, startJob } from "@/lib/gear/persist";

export const maxDuration = 300;

const Body = z.object({
  query: z.string().min(2).max(200),
  publish: z.boolean().optional(),
});

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Research is not configured. Set ANTHROPIC_API_KEY." },
      { status: 503 },
    );
  }

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Expected { query: string }" }, { status: 400 });
  }

  const client = new Anthropic();
  const job = await startJob("ENRICH", parsed.data.query);

  try {
    const outcome = await researchDevice(client, {
      query: parsed.data.query,
      categories: CATEGORY_NAMES,
      allowedDomains: MANUFACTURER_DOMAINS,
    });

    await finishJob(job.id, outcome.usage);

    if (!outcome.result) {
      return NextResponse.json(
        { jobId: job.id, disposition: outcome.disposition, issues: outcome.issues },
        { status: 422 },
      );
    }

    const revision = await recordRevision({
      jobId: job.id,
      result: outcome.result,
      disposition: outcome.disposition,
      issues: outcome.issues,
    });

    const shouldPublish =
      outcome.disposition === "auto-publish" || parsed.data.publish === true;
    const device = shouldPublish
      ? await publishRevision(revision.id, "research")
      : null;

    return NextResponse.json({
      jobId: job.id,
      revisionId: revision.id,
      disposition: outcome.disposition,
      issues: outcome.issues,
      unresolved: outcome.result.unresolved,
      notes: outcome.result.notes,
      published: Boolean(device),
      device,
      usage: outcome.usage,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await finishJob(job.id, { inputTokens: 0, outputTokens: 0, searches: 0, fetches: 0 }, message);
    return NextResponse.json({ jobId: job.id, error: message }, { status: 500 });
  }
}
