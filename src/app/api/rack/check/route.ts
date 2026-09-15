/**
 * POST /api/rack/check  { rack: RackSpec }
 *
 * Runs the feasibility engine server-side. The planner does this in the browser
 * on every drag; this endpoint exists so a saved rack can be checked from a
 * cron, a CI step, or someone else's tooling without reimplementing the rules.
 */

import { NextResponse } from "next/server";

import { checkRack } from "@/lib/rack/checks";
import { RackSchema, toRackSpecFromWire } from "@/lib/rack/schema";
import { prisma } from "@/lib/db/client";
import { toDeviceSpec } from "@/lib/db/mappers";
import type { DeviceSpec } from "@/lib/rack/types";

export async function POST(request: Request) {
  const parsed = RackSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid rack", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const rack = toRackSpecFromWire(parsed.data);

  const ids = [...new Set(rack.placements.map((p) => p.deviceId))];
  const rows = await prisma.device.findMany({
    where: { id: { in: ids } },
    include: { ports: true, manufacturer: true, category: true },
  });

  const devices = new Map<string, DeviceSpec>(rows.map((r) => [r.id, toDeviceSpec(r)]));
  const missing = ids.filter((id) => !devices.has(id));

  const report = checkRack(rack, devices);

  return NextResponse.json({
    budget: report.budget,
    results: report.results,
    errors: report.errors,
    warnings: report.warnings,
    ...(missing.length ? { missingDeviceIds: missing } : {}),
  });
}
