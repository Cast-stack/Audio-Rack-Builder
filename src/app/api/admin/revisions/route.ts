/**
 * GET  /api/admin/revisions        — the review queue, oldest first
 * POST /api/admin/revisions        { revisionId, action: "publish" | "reject", reason? }
 *
 * Rejection reasons are worth as much as approvals: they are the only honest
 * record of what the researcher gets wrong on this catalog specifically, and
 * they are what the next iteration of the prompt is written from.
 */

import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db/client";
import { publishRevision } from "@/lib/gear/persist";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const take = Math.min(Number(url.searchParams.get("limit") ?? 25), 100);

  const revisions = await prisma.deviceRevision.findMany({
    where: { disposition: { in: ["REVIEW", "AUTO_PUBLISH"] }, currentFor: null },
    include: { provenance: true, job: true },
    orderBy: { createdAt: "asc" },
    take,
  });

  return NextResponse.json({ count: revisions.length, revisions });
}

const Action = z.object({
  revisionId: z.string(),
  action: z.enum(["publish", "reject"]),
  reason: z.string().max(1000).optional(),
  reviewer: z.string().max(120).optional(),
});

export async function POST(request: Request) {
  const parsed = Action.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }
  const { revisionId, action, reason, reviewer } = parsed.data;

  if (action === "reject") {
    const revision = await prisma.deviceRevision.update({
      where: { id: revisionId },
      data: {
        disposition: "REJECT",
        notes: reason ?? null,
        createdBy: reviewer ?? "reviewer",
      },
    });
    return NextResponse.json({ revision });
  }

  const device = await publishRevision(revisionId, reviewer ?? "reviewer");
  return NextResponse.json({ device });
}
