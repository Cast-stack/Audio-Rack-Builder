/**
 * POST /api/rack/check  { rack: RackSpec }
 *
 * Runs the feasibility engine server-side. The planner does this in the browser
 * on every drag; this endpoint exists so a saved rack can be checked from a
 * cron, a CI step, or someone else's tooling without reimplementing the rules.
 */

import { NextResponse } from "next/server";
import { z } from "zod";

import { checkRack } from "@/lib/rack/checks";
import { prisma } from "@/lib/db/client";
import { toDeviceSpec } from "@/lib/db/mappers";
import type { DeviceSpec, RackSpec } from "@/lib/rack/types";

const CircuitSchema = z.object({
  label: z.string(),
  volts: z.number().positive(),
  amps: z.number().positive(),
});

const RackSchema = z.object({
  name: z.string(),
  case: z.object({
    slug: z.string(),
    name: z.string(),
    rackUnits: z.number().int().positive(),
    usableDepthMm: z.number().int().positive(),
    hasRearRails: z.boolean(),
    maxLoadLb: z.number().positive().nullable(),
    emptyWeightLb: z.number().positive().nullable(),
  }),
  circuits: z.array(CircuitSchema),
  placements: z.array(
    z.object({
      deviceId: z.string(),
      position: z.number().int(),
      circuit: z.string().nullable(),
      label: z.string().nullable().optional(),
    }),
  ),
});

export async function POST(request: Request) {
  const parsed = RackSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid rack", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const rack = parsed.data as RackSpec;

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
