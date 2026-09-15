/**
 * The checker. This is the thing the two reference tools do not do.
 *
 * IEM Rig and StageRack both draw a rack and total up power, weight and depth.
 * Neither tells you the build will fail — that the 286 mm unit will not close
 * in a 300 mm case once six BNCs are mated, that four units on one 20 A circuit
 * trip the breaker at power-up even though they sit at 60% steady, that the
 * amp at the top makes the case a hazard on a ramp.
 *
 * Every check returns a code, so the UI can link it to the units it concerns
 * and a person can dismiss one they have already thought about.
 */

import { computeBudget, PASSIVE_THERMAL_W_PER_RU, type RackBudget } from "./budget";
import { caseDepthHeadroom, occupiedPositions, occupiedUnits } from "./geometry";
import type { CheckResult, DeviceSpec, RackSpec } from "./types";

/** Above this fraction of rack height, a loaded case wants to tip on a ramp. */
export const COG_WARN_FRACTION = 0.55;
/** A unit this heavy in the top third is worth calling out on its own. */
export const HEAVY_UNIT_LB = 25;
/** Circuits above this share of their derated capacity have no headroom left. */
export const CIRCUIT_WARN_UTILIZATION = 0.85;
/** Devices deeper than this need rear rail support, not just front ears. */
export const REAR_SUPPORT_DEPTH_MM = 300;
/** And units heavier than this. */
export const REAR_SUPPORT_WEIGHT_LB = 20;

export interface CheckReport {
  budget: RackBudget;
  results: CheckResult[];
  errors: number;
  warnings: number;
}

export function checkRack(rack: RackSpec, devices: Map<string, DeviceSpec>): CheckReport {
  const budget = computeBudget(rack, devices);
  const results: CheckResult[] = [
    ...checkPlacement(rack, devices),
    ...checkDepth(rack, devices),
    ...checkMounting(rack, devices),
    ...checkPower(rack, devices, budget),
    ...checkWeight(rack, budget, devices),
    ...checkThermal(budget),
    ...checkCompleteness(budget, devices),
  ];

  return {
    budget,
    results,
    errors: results.filter((r) => r.severity === "error").length,
    warnings: results.filter((r) => r.severity === "warning").length,
  };
}

// ------------------------------------------------------------------ space

function checkPlacement(rack: RackSpec, devices: Map<string, DeviceSpec>): CheckResult[] {
  const out: CheckResult[] = [];
  const occupancy = new Map<number, string[]>();

  for (const p of rack.placements) {
    const device = devices.get(p.deviceId);
    if (!device) continue;

    if (p.position < 1) {
      out.push({
        code: "placement.below-rack",
        severity: "error",
        title: "Placed below the bottom rail",
        detail: `${device.brand} ${device.model} is at U${p.position}. The bottom rail is U1.`,
        deviceIds: [device.id],
        positions: [p.position],
      });
      continue;
    }

    const positions = occupiedPositions(device, p.position);
    const top = positions[positions.length - 1]!;
    if (top > rack.case.rackUnits) {
      out.push({
        code: "placement.overflows-case",
        severity: "error",
        title: "Runs off the top of the case",
        detail:
          `${device.brand} ${device.model} needs ${occupiedUnits(device)}U from U${p.position}, ` +
          `which reaches U${top} in a ${rack.case.rackUnits}U case.`,
        deviceIds: [device.id],
        positions,
      });
    }

    for (const u of positions) {
      const list = occupancy.get(u) ?? [];
      list.push(device.id);
      occupancy.set(u, list);
    }
  }

  for (const [u, ids] of occupancy) {
    if (ids.length > 1) {
      const names = ids
        .map((id) => devices.get(id))
        .filter((d): d is DeviceSpec => !!d)
        .map((d) => `${d.brand} ${d.model}`);
      out.push({
        code: "placement.collision",
        severity: "error",
        title: `Two units in U${u}`,
        detail: `${names.join(" and ")} both occupy U${u}.`,
        deviceIds: ids,
        positions: [u],
      });
    }
  }

  return out;
}

// ------------------------------------------------------------------ depth

function checkDepth(rack: RackSpec, devices: Map<string, DeviceSpec>): CheckResult[] {
  const out: CheckResult[] = [];
  const seen = new Set<string>();

  for (const p of rack.placements) {
    const device = devices.get(p.deviceId);
    if (!device || seen.has(device.id)) continue;
    seen.add(device.id);

    const { fits, headroomMm, breakdown } = caseDepthHeadroom(device, rack.case);
    if (breakdown.requiredMm == null) continue;

    const math =
      `${breakdown.chassisMm} mm chassis + ${breakdown.connectorMm} mm for the ` +
      `${breakdown.drivenBy ?? "rear"} connectors + ${breakdown.bendMm} mm to turn the cable ` +
      `= ${breakdown.requiredMm} mm`;

    if (!fits) {
      out.push({
        code: "depth.will-not-fit",
        severity: "error",
        title: `${device.model} needs more depth than the case has`,
        detail: `${math}, against ${rack.case.usableDepthMm} mm usable. Short by ${Math.abs(headroomMm!)} mm.`,
        deviceIds: [device.id],
        positions: [p.position],
      });
    } else if (headroomMm != null && headroomMm < 25) {
      out.push({
        code: "depth.tight",
        severity: "warning",
        title: `${device.model} clears by ${headroomMm} mm`,
        detail: `${math}. It fits, but there is no room for a service loop or a right-angle adapter.`,
        deviceIds: [device.id],
        positions: [p.position],
      });
    }
  }

  return out;
}

function checkMounting(rack: RackSpec, devices: Map<string, DeviceSpec>): CheckResult[] {
  if (rack.case.hasRearRails) return [];
  const out: CheckResult[] = [];
  const seen = new Set<string>();

  for (const p of rack.placements) {
    const device = devices.get(p.deviceId);
    if (!device || seen.has(device.id)) continue;
    seen.add(device.id);

    const deep = (device.depthMm ?? 0) > REAR_SUPPORT_DEPTH_MM;
    const heavy = (device.weightLb ?? 0) > REAR_SUPPORT_WEIGHT_LB;
    if (deep || heavy) {
      out.push({
        code: "mounting.no-rear-support",
        severity: "warning",
        title: `${device.model} is hanging on its ears`,
        detail:
          `This case has no rear rails, and a ${device.weightLb ?? "?"} lb, ` +
          `${device.depthMm ?? "?"} mm unit will flex its front panel in transit. ` +
          `Add a rear support kit or a shelf.`,
        deviceIds: [device.id],
        positions: [p.position],
      });
    }
  }

  return out;
}

// ------------------------------------------------------------------ power

function checkPower(
  rack: RackSpec,
  devices: Map<string, DeviceSpec>,
  budget: RackBudget,
): CheckResult[] {
  const out: CheckResult[] = [];

  if (rack.circuits.length === 0 && budget.totalTypicalW > 0) {
    out.push({
      code: "power.no-circuits",
      severity: "warning",
      title: "No circuits defined",
      detail:
        `The rack draws ${budget.totalTypicalW} W but has no branch circuits set up, ` +
        `so nothing can be checked against a breaker. Add the circuits you will actually be given.`,
    });
  }

  for (const load of budget.circuits) {
    const { circuit } = load;
    const name = `${circuit.label} (${circuit.amps} A / ${circuit.volts} V)`;

    if (load.typicalW > load.capacityW) {
      out.push({
        code: "power.over-continuous",
        severity: "error",
        title: `${circuit.label} is over its continuous rating`,
        detail:
          `${load.typicalW} W of steady draw on ${name}. A continuous load is limited to 80% ` +
          `of the breaker, which is ${load.capacityW} W. Move something to another circuit.`,
        deviceIds: load.deviceIds,
        circuit: circuit.label,
      });
    } else if (load.utilization > CIRCUIT_WARN_UTILIZATION) {
      out.push({
        code: "power.near-limit",
        severity: "warning",
        title: `${circuit.label} is at ${Math.round(load.utilization * 100)}% of usable`,
        detail:
          `${load.typicalW} W against ${load.capacityW} W usable on ${name}. ` +
          `Nothing else is going on this circuit.`,
        deviceIds: load.deviceIds,
        circuit: circuit.label,
      });
    }

    // Inrush is the failure that shows up at doors, not in the spreadsheet.
    if (load.inrushW > load.peakCapacityW && load.typicalW <= load.capacityW) {
      out.push({
        code: "power.inrush-trip",
        severity: "warning",
        title: `${circuit.label} will likely trip at power-up`,
        detail:
          `Steady draw is fine at ${load.typicalW} W, but worst-case startup hits ` +
          `${load.inrushW} W against a ${load.peakCapacityW} W breaker. Sequence the rack, ` +
          `or move the biggest supply to its own circuit.`,
        deviceIds: load.deviceIds,
        circuit: circuit.label,
      });
    }
  }

  if (budget.unassignedDeviceIds.length > 0) {
    const names = budget.unassignedDeviceIds
      .map((id) => devices.get(id))
      .filter((d): d is DeviceSpec => !!d)
      .map((d) => d.model);
    out.push({
      code: "power.unassigned",
      severity: "warning",
      title: `${names.length} unit${names.length === 1 ? "" : "s"} not on a circuit`,
      detail: `${names.join(", ")} draw power but are not assigned to a circuit, so they are missing from the load totals.`,
      deviceIds: budget.unassignedDeviceIds,
    });
  }

  return out;
}

// ----------------------------------------------------------------- weight

function checkWeight(
  rack: RackSpec,
  budget: RackBudget,
  devices: Map<string, DeviceSpec>,
): CheckResult[] {
  const out: CheckResult[] = [];

  if (rack.case.maxLoadLb != null && budget.weightLb > rack.case.maxLoadLb) {
    out.push({
      code: "weight.over-case-rating",
      severity: "error",
      title: "Over the case load rating",
      detail:
        `${budget.weightLb} lb of gear in a case rated for ${rack.case.maxLoadLb} lb. ` +
        `The rating is about the rails and casters, not just the shell.`,
    });
  }

  if (budget.cogFraction != null && budget.cogFraction > COG_WARN_FRACTION) {
    out.push({
      code: "weight.top-heavy",
      severity: "warning",
      title: "Centre of gravity is high",
      detail:
        `The loaded centre of gravity sits at ${Math.round(budget.cogFraction * 100)}% of the ` +
        `rack's height. Above about 55% a case on casters wants to go over on a ramp. ` +
        `Move the heavy units down.`,
    });
  }

  const topThirdStart = Math.ceil((rack.case.rackUnits * 2) / 3);
  for (const p of rack.placements) {
    const device = devices.get(p.deviceId);
    if (!device || device.weightLb == null) continue;
    if (device.weightLb >= HEAVY_UNIT_LB && p.position >= topThirdStart) {
      out.push({
        code: "weight.heavy-up-high",
        severity: "warning",
        title: `${device.model} is heavy and near the top`,
        detail: `${device.weightLb} lb at U${p.position}. Heavy units belong in the bottom third.`,
        deviceIds: [device.id],
        positions: [p.position],
      });
    }
  }

  return out;
}

// ---------------------------------------------------------------- thermal

function checkThermal(budget: RackBudget): CheckResult[] {
  if (budget.heatW <= 0) return [];
  if (budget.heatWPerRu <= PASSIVE_THERMAL_W_PER_RU) return [];
  if (budget.hasForcedAir) {
    return [
      {
        code: "thermal.verify-airflow",
        severity: "info",
        title: "Forced air present — check the path",
        detail:
          `${budget.heatW} W over ${budget.unitsTotal}U is ${budget.heatWPerRu} W/U. ` +
          `There is a fan in the rack; make sure it pulls from the front and exhausts clear of the next unit's intake.`,
      },
    ];
  }
  return [
    {
      code: "thermal.needs-airflow",
      severity: "warning",
      title: "No forced air for this heat load",
      detail:
        `${budget.heatW} W over ${budget.unitsTotal}U is ${budget.heatWPerRu} W/U, past what a ` +
        `closed case sheds on its own. Add a fan panel, or vent panels above and below the hot units.`,
    },
  ];
}

// ----------------------------------------------------------- completeness

function checkCompleteness(
  budget: RackBudget,
  devices: Map<string, DeviceSpec>,
): CheckResult[] {
  if (budget.incomplete.length === 0) return [];
  const lines = budget.incomplete.map((i) => {
    const d = devices.get(i.deviceId);
    return `${d ? d.model : i.deviceId} (${i.missing.join(", ")})`;
  });
  return [
    {
      code: "data.incomplete",
      severity: "info",
      title: `${budget.incomplete.length} unit${budget.incomplete.length === 1 ? "" : "s"} missing a figure`,
      detail:
        `${lines.join("; ")}. The totals below are missing these, so treat them as a floor, ` +
        `not a number to hand to the power company.`,
      deviceIds: budget.incomplete.map((i) => i.deviceId),
    },
  ];
}
