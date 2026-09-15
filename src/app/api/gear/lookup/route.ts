/**
 * POST /api/gear/lookup  { query }
 *
 * The user-facing path: somebody searched for gear the catalog does not have.
 *
 * Two rules make this safe. The budget is tighter than the admin path because
 * a person is watching. And the result never reaches the shared catalog on its
 * own — it comes back marked provisional for that user's rack and goes into the
 * review queue. One bad rear-panel enumeration reaching everyone is a much
 * worse day than one person waiting for approval.
 */

import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

import { researchFast } from "@/lib/gear/research";
import { CATEGORY_NAMES } from "@/lib/gear/catalog";
import { prisma } from "@/lib/db/client";
import { finishJob, recordRevision, startJob } from "@/lib/gear/persist";

export const maxDuration = 120;

const Body = z.object({ query: z.string().min(2).max(200) });

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Lookup is not configured." }, { status: 503 });
  }

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Expected { query: string }" }, { status: 400 });
  }
  const query = parsed.data.query.trim();

  // Deduplicate before spending anything: the same twenty devices get asked
  // for over and over, and a queued job is as good as a finished one.
  const pending = await prisma.researchJob.findFirst({
    where: { query: { equals: query, mode: "insensitive" }, status: { in: ["QUEUED", "RUNNING"] } },
  });
  if (pending) {
    return NextResponse.json({ jobId: pending.id, status: "already-running", query });
  }

  const client = new Anthropic();
  const job = await startJob("LOOKUP", query);

  try {
    const outcome = await researchFast(client, query, CATEGORY_NAMES);
    await finishJob(job.id, outcome.usage);

    if (!outcome.result) {
      return NextResponse.json(
        {
          jobId: job.id,
          status: "not-found",
          message:
            "Could not establish this device from manufacturer sources. It has been queued for a person to look at.",
          issues: outcome.issues,
        },
        { status: 422 },
      );
    }

    const revision = await recordRevision({
      jobId: job.id,
      result: outcome.result,
      disposition: outcome.disposition,
      issues: outcome.issues,
    });

    return NextResponse.json({
      jobId: job.id,
      revisionId: revision.id,
      status: "provisional",
      /**
       * Enough to place in a rack and budget against, with the honesty carried
       * along: the client renders this device with an unverified badge and
       * marks any total that includes it.
       */
      device: outcome.result.device,
      provenance: outcome.result.provenance,
      unresolved: outcome.result.unresolved,
      disposition: outcome.disposition,
      issues: outcome.issues,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await finishJob(job.id, { inputTokens: 0, outputTokens: 0, searches: 0, fetches: 0 }, message);
    return NextResponse.json({ jobId: job.id, error: message }, { status: 500 });
  }
}
