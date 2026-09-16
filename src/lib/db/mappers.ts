/**
 * Prisma rows to the plain shapes the feasibility engine understands.
 *
 * The engine never imports Prisma — it runs in tests, in a worker, and in the
 * browser while someone drags a unit. This file is the only seam.
 */

import type { Prisma } from "@prisma/client";
import type { CaseSpec, DeviceSpec, PlacementSpec, PortSpec, RackSpec, Circuit } from "@/lib/rack/types";

export type DeviceRow = Prisma.DeviceGetPayload<{
  include: { ports: true; manufacturer: true; category: true };
}>;

export type RackRow = Prisma.RackGetPayload<{
  include: { case: true; placements: true };
}>;

const FORM_FACTOR_FROM_DB = {
  FULL_RACK: "full-rack",
  HALF_RACK: "half-rack",
  THIRD_RACK: "third-rack",
  QUARTER_RACK: "quarter-rack",
  DESKTOP: "desktop",
  ACCESSORY: "accessory",
} as const;

export function toDeviceSpec(row: DeviceRow): DeviceSpec {
  return {
    id: row.id,
    slug: row.slug,
    brand: row.manufacturer.name,
    model: row.model,
    category: row.category.name,
    formFactor: FORM_FACTOR_FROM_DB[row.formFactor],
    passive: row.category.passive,
    rackUnits: row.rackUnits,
    depthMm: row.depthMm,
    depthIsOverall: row.depthIsOverall,
    weightLb: row.weightLb,
    powerTypicalW: row.powerTypicalW,
    powerMaxW: row.powerMaxW,
    inrushFactor: row.inrushFactor ?? 1,
    poePowered: row.poePowered,
    ports: row.ports
      .slice()
      .sort((a, b) => a.sortKey - b.sortKey)
      .map(toPortSpec),
  };
}

function toPortSpec(p: DeviceRow["ports"][number]): PortSpec {
  return {
    label: p.label,
    connector: p.connector,
    direction: p.direction as PortSpec["direction"],
    signal: p.signal,
    channels: p.channels,
    count: p.count,
    face: p.face === "front" ? "front" : "rear",
    projectionMm: p.projectionMm,
  };
}

export function toCaseSpec(row: RackRow["case"]): CaseSpec {
  return {
    slug: row.slug,
    name: row.name,
    rackUnits: row.rackUnits,
    usableDepthMm: row.usableDepthMm,
    hasRearRails: row.hasRearRails,
    maxLoadLb: row.maxLoadLb,
    emptyWeightLb: row.emptyWeightLb,
  };
}

/** Circuits live in a Json column; validate on the way out, not on faith. */
export function toCircuits(value: unknown): Circuit[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((v) => {
    if (typeof v !== "object" || v === null) return [];
    const c = v as Record<string, unknown>;
    if (typeof c.label !== "string") return [];
    const volts = Number(c.volts);
    const amps = Number(c.amps);
    if (!Number.isFinite(volts) || !Number.isFinite(amps)) return [];
    return [{ label: c.label, volts, amps }];
  });
}

export function toRackSpec(row: RackRow): RackSpec {
  return {
    name: row.name,
    case: toCaseSpec(row.case),
    circuits: toCircuits(row.circuits),
    placements: row.placements.map(
      // Every dimension of the placement key comes back out. Dropping one
      // here is the same bug as dropping one from anchorKey(): two physical
      // cells collapse into one and the rack that round-trips is not the rack
      // that went in. bay and slot are non-null in the schema, and "full"
      // reads identically to an omitted slot throughout the engine.
      (p): PlacementSpec => ({
        deviceId: p.deviceId,
        bay: p.bay,
        position: p.position,
        slot: p.slot as PlacementSpec["slot"],
        circuit: p.circuit,
        label: p.label,
      }),
    ),
  };
}
