/**
 * POST /api/gear/request  { query, sources?: string[] }
 *
 * "It is not in your catalog. Here is the manual." The path for a person who
 * owns the box and knows where its documentation lives.
 *
 * Three things separate this from /api/gear/lookup, which searches on a name
 * alone:
 *
 *   - It reads links the user supplies, including PDFs, on top of the standing
 *     manufacturer allowlist. See src/lib/gear/sources.ts for what is accepted
 *     and what accepting it costs.
 *   - It never publishes. Not on a clean triage, not on a manufacturer source,
 *     not ever. A device reaches the shared catalog when a person promotes it,
 *     which is the rule the whole provenance story rests on.
 *   - It works without a database. With Postgres the result is filed as a
 *     revision for review, as designed. Without one it still comes back to the
 *     caller, who keeps it in their own browser marked unverified. That makes
 *     the feature usable with nothing but an API key, and it does not weaken
 *     the rule above: a device in one person's localStorage has not been
 *     published to anybody.
 */

import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

import { researchDevice } from "@/lib/gear/research";
import { CATEGORY_NAMES, MANUFACTURER_DOMAINS } from "@/lib/gear/catalog";
import { MAX_SOURCES } from "@/lib/gear/sources";

export const maxDuration = 300;

const Body = z.object({
  query: z.string().min(2).max(200),
  sources: z.array(z.string().max(2000)).max(MAX_SOURCES * 2).optional(),
});

/**
 * A crude meter, deliberately.
 *
 * Every call spends real money on searches and fetches, and PLAN.md has had
 * "one user with a script is the whole margin" written down since before this
 * route existed. This is not the metering that belongs in front of a paid
 * product — it is the floor under it, so that shipping the feature does not
 * ship the hole at the same time. Per-process, so it resets on redeploy and
 * does not hold across instances; replace it with the real thing when accounts
 * land.
 */
const WINDOW_MS = 60 * 60 * 1000;
const PER_WINDOW = 10;
const hits = new Map<string, number[]>();

function overBudget(key: string): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= PER_WINDOW) {
    hits.set(key, recent);
    return true;
  }
  recent.push(now);
  hits.set(key, recent);
  // Keep the map from growing without bound on a long-lived process.
  if (hits.size > 5000) {
    for (const [k, v] of hits) if (!v.some((t) => now - t < WINDOW_MS)) hits.delete(k);
  }
  return false;
}

function callerKey(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  return (fwd ? fwd.split(",")[0]!.trim() : null) ?? request.headers.get("x-real-ip") ?? "anonymous";
}

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Adding gear is not configured on this server. Set ANTHROPIC_API_KEY." },
      { status: 503 },
    );
  }

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Expected { query: string, sources?: string[] }" },
      { status: 400 },
    );
  }

  if (overBudget(callerKey(request))) {
    return NextResponse.json(
      { error: `That is ${PER_WINDOW} devices in an hour. Give it a rest, or get in touch.` },
      { status: 429 },
    );
  }

  const query = parsed.data.query.trim();
  const client = new Anthropic();

  try {
    const outcome = await researchDevice(client, {
      query,
      categories: CATEGORY_NAMES,
      allowedDomains: MANUFACTURER_DOMAINS,
      sources: parsed.data.sources ?? [],
      // A person is watching a spinner, so the budget is the tight one. The
      // supplied links are the reason that is affordable: pointed at the right
      // PDF, this does not need six searches to find it.
      maxSearches: 4,
      maxFetches: 6,
    });

    const rejected = outcome.sources.rejected;

    if (!outcome.result) {
      return NextResponse.json(
        {
          status: "not-found",
          message:
            "Could not establish this device from manufacturer sources. A link straight to the manual usually fixes it.",
          issues: outcome.issues,
          rejectedSources: rejected,
        },
        { status: 422 },
      );
    }

    // Filed for review where there is somewhere to file it. The absence of a
    // database is not a reason to throw the work away.
    let revisionId: string | null = null;
    let filed = false;
    if (process.env.DATABASE_URL) {
      try {
        const { recordRevision, startJob, finishJob } = await import("@/lib/gear/persist");
        const job = await startJob("LOOKUP", query);
        await finishJob(job.id, outcome.usage);
        const revision = await recordRevision({
          jobId: job.id,
          result: outcome.result,
          disposition: outcome.disposition,
          issues: outcome.issues,
        });
        revisionId = revision.id;
        filed = true;
      } catch {
        // The research is done and paid for. Losing the audit row is worth
        // reporting, but it is not worth throwing away the answer.
        filed = false;
      }
    }

    return NextResponse.json({
      status: "provisional",
      revisionId,
      filedForReview: filed,
      device: outcome.result.device,
      provenance: outcome.result.provenance,
      unresolved: outcome.result.unresolved,
      notes: outcome.result.notes ?? null,
      disposition: outcome.disposition,
      issues: outcome.issues,
      sources: {
        read: outcome.sources.accepted,
        rejected,
        allTrusted: outcome.sources.allTrusted,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
