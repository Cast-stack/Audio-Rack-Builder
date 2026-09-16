/**
 * Running totals for a rack: space, weight, balance, power, heat.
 *
 * Everything here is pure and cheap enough to recompute on every drag, so the
 * numbers in the planner's side rail are never stale.
 */

import {
  bayCount,
  bayOf,
  MM_PER_RU,
  occupiedPositions,
  occupiedUnits,
  requiredDepth,
} from "./geometry";
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

/** What one column of rails is carrying. */
export interface BayLoad {
  bay: number;
  unitsUsed: number;
  unitsTotal: number;
  weightLb: number;
}

export interface RackBudget {
  unitsUsed: number;
  unitsTotal: number;
  unitsFree: number;
  /** One entry per bay, in order. A single-bay case has one. */
  bays: BayLoad[];
  /**
   * How lopsided the load is across the bays: 0 when even, 1 when it is all in
   * one bay. A wide case goes over sideways on a ramp long before a narrow one
   * does, and neither the weight total nor the centre of gravity shows it.
   */
  lateralImbalance: number;

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
  const bays = bayCount(rack.case);
  // Keyed by bay and row: in a two-bay case, U3 of bay 1 and U3 of bay 2 are
  // two different rack units, and counting bare rows would halve the space.
  const rowsUsed = new Set<string>();
  const perBayRows = new Map<number, Set<number>>();
  const perBayWeight = new Map<number, number>();
  let weightLb = 0;
  let momentLbMm = 0;
  let totalTypicalW = 0;
  let totalMaxW = 0;
  let maxRequiredDepthMm: number | null = null;
  const incomplete: RackBudget["incomplete"] = [];
  let hasForcedAir = false;

  for (const { placement, device } of placed) {
    const units = occupiedUnits(device);
    const bay = bayOf(placement);
    for (const u of occupiedPositions(device, placement.position)) {
      rowsUsed.add(`${bay}|${u}`);
      const seen = perBayRows.get(bay) ?? new Set<number>();
      seen.add(u);
      perBayRows.set(bay, seen);
    }
    if (device.weightLb != null) {
      perBayWeight.set(bay, (perBayWeight.get(bay) ?? 0) + device.weightLb);
    }

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

  const bayLoads: BayLoad[] = [];
  for (let b = 1; b <= bays; b++) {
    bayLoads.push({
      bay: b,
      unitsUsed: perBayRows.get(b)?.size ?? 0,
      unitsTotal: rack.case.rackUnits,
      weightLb: round1(perBayWeight.get(b) ?? 0),
    });
  }
  const heaviest = bayLoads.reduce((m, b) => Math.max(m, b.weightLb), 0);
  const lightest = bayLoads.reduce((m, b) => Math.min(m, b.weightLb), heaviest);
  const lateralImbalance = bays < 2 || weightLb <= 0 ? 0 : (heaviest - lightest) / weightLb;

  const rackHeightMm = rack.case.rackUnits * MM_PER_RU;
  const cogMm = weightLb > 0 ? momentLbMm / weightLb : null;

  const unitsUsed = rowsUsed.size;

  return {
    unitsUsed,
    unitsTotal: rack.case.rackUnits * bays,
    unitsFree: rack.case.rackUnits * bays - unitsUsed,
    bays: bayLoads,
    lateralImbalance,

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
    heatWPerRu:
      rack.case.rackUnits > 0 ? round1(totalTypicalW / (rack.case.rackUnits * bays)) : 0,
    hasForcedAir,

    incomplete,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
