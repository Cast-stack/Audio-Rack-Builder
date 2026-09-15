/**
 * Running totals for a rack: space, weight, balance, power, heat.
 *
 * Everything here is pure and cheap enough to recompute on every drag, so the
 * numbers in the planner's side rail are never stale.
 */

import { MM_PER_RU, occupiedPositions, occupiedUnits, requiredDepth } from "./geometry";
import type { Circuit, DeviceSpec, RackSpec } from "./types";

/** NEC 210.19(A)/210.20(A): a continuous load may use 80% of the breaker. */
export const CONTINUOUS_DERATE = 0.8;

/**
 * Watts per rack unit a sealed case sheds by convection before it needs help.
 * Well below anything a manufacturer would quote — this is the number at which
 * a rack stops being comfortable to touch after a four-hour show.
 */
export const PASSIVE_THERMAL_W_PER_RU = 35;

export interface CircuitLoad {
  circuit: Circuit;
  deviceIds: string[];
  /** Steady-state draw, watts. */
  typicalW: number;
  /** Continuous capacity after derate, watts. */
  capacityW: number;
  /** Instantaneous ceiling — the breaker's actual rating. */
  peakCapacityW: number;
  /** Worst-case startup: biggest unit's inrush plus everything else steady. */
  inrushW: number;
  utilization: number;
}

export interface RackBudget {
  unitsUsed: number;
  unitsTotal: number;
  unitsFree: number;

  weightLb: number;
  /** Including the empty case, when known. */
  grossWeightLb: number | null;
  /** Height of the loaded centre of gravity above the bottom rail, mm. */
  cogMm: number | null;
  /** That height as a fraction of the rack's own height. Lower is better. */
  cogFraction: number | null;

  /** Deepest single device requirement, chassis + connector + bend. */
  maxRequiredDepthMm: number | null;
  usableDepthMm: number;

  totalTypicalW: number;
  totalMaxW: number;
  circuits: CircuitLoad[];
  /** Active devices with no circuit assigned. */
  unassignedDeviceIds: string[];

  /** Heat to shed, watts. Treated as equal to steady-state draw. */
  heatW: number;
  heatWPerRu: number;
  hasForcedAir: boolean;

  /** Devices whose spec is missing a figure the budget needs. */
  incomplete: { deviceId: string; missing: string[] }[];
}

export function computeBudget(
  rack: RackSpec,
  devices: Map<string, DeviceSpec>,
): RackBudget {
  const placed = rack.placements
    .map((p) => ({ placement: p, device: devices.get(p.deviceId) }))
    .filter((x): x is { placement: (typeof rack.placements)[number]; device: DeviceSpec } =>
      x.device !== undefined,
    );

  // Space is counted in occupied U rows, not per device: two half-rack
  // receivers sharing U3 consume one rack unit between them, not two.
  const rowsUsed = new Set<number>();
  let weightLb = 0;
  let momentLbMm = 0;
  let totalTypicalW = 0;
  let totalMaxW = 0;
  let maxRequiredDepthMm: number | null = null;
  const incomplete: RackBudget["incomplete"] = [];
  let hasForcedAir = false;

  for (const { placement, device } of placed) {
    const units = occupiedUnits(device);
    for (const u of occupiedPositions(device, placement.position)) rowsUsed.add(u);

    const missing: string[] = [];
    if (device.weightLb == null) missing.push("weight");
    if (device.depthMm == null) missing.push("depth");
    if (!device.passive && !device.poePowered && device.powerTypicalW == null && device.powerMaxW == null) {
      missing.push("power");
    }
    if (missing.length) incomplete.push({ deviceId: device.id, missing });

    if (device.weightLb != null) {
      weightLb += device.weightLb;
      // Centre of the device's own span, measured from the bottom rail.
      const centreMm = (placement.position - 1 + units / 2) * MM_PER_RU;
      momentLbMm += device.weightLb * centreMm;
    }

    // Prefer the honest steady-state figure; fall back to the nameplate only
    // when that is all the manufacturer published.
    const typical = device.powerTypicalW ?? device.powerMaxW ?? 0;
    totalTypicalW += typical;
    totalMaxW += device.powerMaxW ?? typical;

    const req = requiredDepth(device).requiredMm;
    if (req != null && (maxRequiredDepthMm == null || req > maxRequiredDepthMm)) {
      maxRequiredDepthMm = req;
    }

    if (device.category === "Rack Fan") hasForcedAir = true;
  }

  const byCircuit = new Map<string, string[]>();
  const unassignedDeviceIds: string[] = [];
  for (const { placement, device } of placed) {
    const draws = !device.passive && !device.poePowered &&
      (device.powerTypicalW ?? device.powerMaxW ?? 0) > 0;
    if (!draws) continue;
    if (!placement.circuit) {
      unassignedDeviceIds.push(device.id);
      continue;
    }
    const list = byCircuit.get(placement.circuit) ?? [];
    list.push(device.id);
    byCircuit.set(placement.circuit, list);
  }

  const circuits: CircuitLoad[] = rack.circuits.map((circuit) => {
    const deviceIds = byCircuit.get(circuit.label) ?? [];
    const loads = deviceIds
      .map((id) => devices.get(id))
      .filter((d): d is DeviceSpec => d !== undefined)
      .map((d) => ({
        typical: d.powerTypicalW ?? d.powerMaxW ?? 0,
        inrush: (d.powerTypicalW ?? d.powerMaxW ?? 0) * (d.inrushFactor || 1),
      }));

    const typicalW = loads.reduce((s, l) => s + l.typical, 0);
    const peakCapacityW = circuit.volts * circuit.amps;
    const capacityW = peakCapacityW * CONTINUOUS_DERATE;

    // Worst realistic startup: one unit inrushes while the rest sit steady.
    let inrushW = typicalW;
    for (const l of loads) {
      const candidate = typicalW - l.typical + l.inrush;
      if (candidate > inrushW) inrushW = candidate;
    }

    return {
      circuit,
      deviceIds,
      typicalW: round1(typicalW),
      capacityW: round1(capacityW),
      peakCapacityW: round1(peakCapacityW),
      inrushW: round1(inrushW),
      utilization: capacityW > 0 ? typicalW / capacityW : 0,
    };
  });

  const rackHeightMm = rack.case.rackUnits * MM_PER_RU;
  const cogMm = weightLb > 0 ? momentLbMm / weightLb : null;

  const unitsUsed = rowsUsed.size;

  return {
    unitsUsed,
    unitsTotal: rack.case.rackUnits,
    unitsFree: rack.case.rackUnits - unitsUsed,

    weightLb: round1(weightLb),
    grossWeightLb:
      rack.case.emptyWeightLb != null ? round1(weightLb + rack.case.emptyWeightLb) : null,
    cogMm: cogMm == null ? null : Math.round(cogMm),
    cogFraction: cogMm == null ? null : cogMm / rackHeightMm,

    maxRequiredDepthMm,
    usableDepthMm: rack.case.usableDepthMm,

    totalTypicalW: round1(totalTypicalW),
    totalMaxW: round1(totalMaxW),
    circuits,
    unassignedDeviceIds,

    heatW: round1(totalTypicalW),
    heatWPerRu: rack.case.rackUnits > 0 ? round1(totalTypicalW / rack.case.rackUnits) : 0,
    hasForcedAir,

    incomplete,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
