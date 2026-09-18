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
import {
  bayCount,
  bayOf,
  caseDepthHeadroom,
  cellSpace,
  isHalfWidth,
  mountOf,
  occupiedCells,
  occupiedPositions,
  occupiedUnits,
  requiredDepth,
} from "./geometry";
import { cableTags, endKey, resolveCables, signalClassOf } from "./cables";
import type { CheckResult, DeviceSpec, RackSpec } from "./types";

/** Above this fraction of rack height, a loaded case wants to tip on a ramp. */
export const COG_WARN_FRACTION = 0.55;

/**
 * How lopsided a multi-bay case may be before it is called out.
 *
 * A wide case is more stable front to back and less stable side to side than a
 * narrow one, and the load is easy to get wrong because each bay is planned on
 * its own. A third of the total sitting on one side is the point where a ramp
 * starts to matter.
 */
export const LATERAL_WARN_FRACTION = 0.34;
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
    ...checkRearMount(rack, devices),
    ...checkPower(rack, devices, budget),
    ...checkWeight(rack, budget, devices),
    ...checkThermal(budget),
    ...checkCompleteness(budget, devices),
    ...checkPatch(rack, devices),
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
  const occupancy = new Map<string, string[]>();

  const bays = bayCount(rack.case);
  const bayName = (b: number) => (bays > 1 ? `bay ${b} ` : "");

  for (const p of rack.placements) {
    const device = devices.get(p.deviceId);
    if (!device) continue;

    const bay = bayOf(p);
    if (bay > bays) {
      out.push({
        code: "placement.no-such-bay",
        severity: "error",
        title: "Placed in a bay this case does not have",
        detail:
          `${device.brand} ${device.model} is in bay ${bay}, and this case has ` +
          `${bays} ${bays === 1 ? "bay" : "bays"}.`,
        deviceIds: [device.id],
        positions: [p.position],
      });
      continue;
    }

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

    // Occupancy is per half-U, so two half-rack receivers can share a U while
    // a full-width unit still blocks the whole row.
    for (const cell of occupiedCells(device, p.position, p.slot, bay, mountOf(p))) {
      const list = occupancy.get(cell) ?? [];
      list.push(device.id);
      occupancy.set(cell, list);
    }
  }

  for (const [cell, ids] of occupancy) {
    if (ids.length > 1) {
      const [bStr, uStr, half, mount] = cell.split("|");
      const u = Number(uStr);
      const b = Number(bStr);
      const names = ids
        .map((id) => devices.get(id))
        .filter((d): d is DeviceSpec => !!d)
        .map((d) => `${d.brand} ${d.model}`);
      out.push({
        code: "placement.collision",
        severity: "error",
        title: `Two units in ${bayName(b)}U${u}`,
        detail:
          `${names.join(" and ")} both occupy the ${half} side of ${bayName(b)}U${u}` +
          `${mount === "rear" ? " on the rear rails" : ""}.`,
        deviceIds: ids,
        positions: [u],
      });
    }
  }

  // A lone half-rack unit leaves an open half. That is legal, but it is also
  // a hole in the airflow path and a place for cables to migrate into.
  const halfCells = new Map<string, { ids: string[]; halves: Set<string>; u: number; bay: number }>();
  for (const p of rack.placements) {
    const device = devices.get(p.deviceId);
    if (!device || !isHalfWidth(device)) continue;
    for (const cell of occupiedCells(device, p.position, p.slot, bayOf(p), mountOf(p))) {
      const [bStr, uStr, half] = cell.split("|");
      const key = `${bStr}|${uStr}`;
      const entry = halfCells.get(key) ??
        { ids: [], halves: new Set<string>(), u: Number(uStr), bay: Number(bStr) };
      entry.ids.push(device.id);
      entry.halves.add(half!);
      halfCells.set(key, entry);
    }
  }
  for (const entry of halfCells.values()) {
    const blockedByFull = rack.placements.some((p) => {
      const d = devices.get(p.deviceId);
      if (!d || isHalfWidth(d)) return false;
      return bayOf(p) === entry.bay && occupiedPositions(d, p.position).includes(entry.u);
    });
    if (!blockedByFull && entry.halves.size === 1) {
      out.push({
        code: "placement.half-open",
        severity: "info",
        title: `${bayName(entry.bay) || ""}U${entry.u} has one half empty`.replace(/^b/, "B"),
        detail:
          `Only the ${[...entry.halves][0]} side of ${bayName(entry.bay)}U${entry.u} is filled. ` +
          `Pair it with another half-rack unit, or fit the blanking plate that came with the ` +
          `mounting kit — an open half lets air bypass the gear it was meant to cool.`,
        deviceIds: entry.ids,
        positions: [entry.u],
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

    /**
     * No published depth means no depth check for this unit — and the rack has
     * to say so. caseDepthHeadroom() reports fits:true for an unknown depth,
     * which is the right answer to "is it too deep" and the wrong thing to let
     * a reader take as a clean bill of health. Silence here is how a rack that
     * was never measured comes out reading "this one builds".
     */
    if (breakdown.requiredMm == null) {
      out.push({
        code: "depth.unknown",
        severity: "warning",
        title: `${device.model} has no published depth`,
        detail:
          `${device.brand} publishes no chassis depth for this unit, so it has not been ` +
          `checked against the ${rack.case.usableDepthMm} mm between the rails. Measure it ` +
          `before you commit to the case — every other depth figure on this rack excludes it.`,
        deviceIds: [device.id],
        positions: [p.position],
      });
      continue;
    }

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

/**
 * Gear on the rear rails, and what it costs.
 *
 * Two things can go wrong that nothing else catches. A case with no rear rails
 * has nothing to bolt a rear-mounted unit to at all. And a unit on the front
 * rails and one behind it in the same U are not fighting for holes — they are
 * fighting for depth, back to back, and the case only has so much between the
 * rails. That second one is the whole reason this feature is worth having:
 * a patch bay behind a receiver is the classic way to discover on site that
 * the lid will not close.
 */
function checkRearMount(rack: RackSpec, devices: Map<string, DeviceSpec>): CheckResult[] {
  const out: CheckResult[] = [];
  const rear = rack.placements.filter((p) => mountOf(p) === "rear");
  if (!rear.length) return out;

  const bays = bayCount(rack.case);
  const bayName = (b: number) => (bays > 1 ? `bay ${b} ` : "");

  if (!rack.case.hasRearRails) {
    const names = rear
      .map((p) => devices.get(p.deviceId))
      .filter((d): d is DeviceSpec => !!d)
      .map((d) => `${d.brand} ${d.model}`);
    out.push({
      code: "mounting.no-rear-rails",
      severity: "error",
      title: `Nothing to bolt ${names.length === 1 ? "it" : "them"} to`,
      detail:
        `${names.join(", ")} ${names.length === 1 ? "is" : "are"} on the rear rails, and ` +
        `${rack.case.name} has front rails only. Move ${names.length === 1 ? "it" : "them"} ` +
        `to the front, or use a case with rear rails.`,
      deviceIds: rear.map((p) => p.deviceId),
      positions: rear.map((p) => p.position),
    });
  }

  // Depth is shared between whatever faces forwards and whatever faces back in
  // the same half-U.
  const bySpace = new Map<string, { front: string[]; rear: string[] }>();
  for (const p of rack.placements) {
    const device = devices.get(p.deviceId);
    if (!device) continue;
    for (const cell of occupiedCells(device, p.position, p.slot, bayOf(p), mountOf(p))) {
      const space = cellSpace(cell);
      const entry = bySpace.get(space) ?? { front: [], rear: [] };
      entry[mountOf(p)].push(p.deviceId);
      bySpace.set(space, entry);
    }
  }

  const reported = new Set<string>();
  for (const [space, entry] of bySpace) {
    if (!entry.front.length || !entry.rear.length) continue;
    const frontDevice = devices.get(entry.front[0]!);
    const rearDevice = devices.get(entry.rear[0]!);
    if (!frontDevice || !rearDevice) continue;

    const f = requiredDepth(frontDevice).requiredMm;
    const r = requiredDepth(rearDevice).requiredMm;
    if (f == null || r == null) continue;

    const together = f + r;
    if (together <= rack.case.usableDepthMm) continue;

    const key = `${frontDevice.id}|${rearDevice.id}`;
    if (reported.has(key)) continue;
    reported.add(key);

    const [bStr, uStr] = space.split("|");
    out.push({
      code: "mounting.back-to-back-depth",
      severity: "error",
      title: `${frontDevice.model} and ${rearDevice.model} meet in the middle`,
      detail:
        `In ${bayName(Number(bStr))}U${uStr} the front unit needs ${f} mm with its connectors ` +
        `and the rear one needs ${r} mm, which is ${together} mm nose to nose against ` +
        `${rack.case.usableDepthMm} mm between the rails. Over by ${together - rack.case.usableDepthMm} mm.`,
      deviceIds: [frontDevice.id, rearDevice.id],
      positions: [Number(uStr)],
    });
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

  if (budget.lateralImbalance > LATERAL_WARN_FRACTION) {
    const heaviest = [...budget.bays].sort((a, b) => b.weightLb - a.weightLb)[0];
    out.push({
      code: "weight.lopsided",
      severity: "warning",
      title: "The load is lopsided across the bays",
      detail:
        `Bay ${heaviest?.bay} carries ${heaviest?.weightLb} lb of the ${budget.weightLb} lb in ` +
        `this case. A wide case tips sideways on a ramp before a narrow one does — ` +
        `${budget.bays.map((b) => `bay ${b.bay}: ${b.weightLb} lb`).join(", ")}.`,
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

/**
 * Patch checks.
 *
 * These are the mistakes that are invisible on a screen and obvious at the
 * worst moment: a connector wired twice, two outputs facing each other, a run
 * whose two ends cannot physically mate. None of them fall out of counting
 * ports, which is why the patch is checked separately from the rack.
 */
function checkPatch(rack: RackSpec, devices: Map<string, DeviceSpec>): CheckResult[] {
  const runs = resolveCables(rack, devices);
  if (!runs.length) return [];

  const out: CheckResult[] = [];
  const tags = cableTags(runs);
  const seen = new Map<string, string[]>();

  for (const run of runs) {
    const tag = tags.get(run.cable.id) ?? run.cable.id;

    for (const end of [run.cable.from, run.cable.to]) {
      if (end.kind !== "port") continue;
      const key = endKey(end);
      const list = seen.get(key) ?? [];
      list.push(tag);
      seen.set(key, list);
    }

    const a = run.from.port;
    const b = run.to.port;
    if (!a || !b) continue;
    const ids = [run.from.device?.id, run.to.device?.id].filter((x): x is string => !!x);

    // Two outputs, or two inputs, facing each other. A bidirectional port pairs
    // with anything, which is the whole point of one.
    const oneWay = (d: string) => d === "input" || d === "output";
    if (oneWay(a.direction) && oneWay(b.direction) && a.direction === b.direction) {
      out.push({
        code: "patch.direction",
        severity: "error",
        title: `${tag} joins two ${a.direction}s`,
        detail: `${run.from.label} and ${run.to.label} are both ${a.direction}s. One end of a run has to be the other kind.`,
        deviceIds: ids,
      });
    }

    if (!connectorsMate(a.connector, b.connector)) {
      out.push({
        code: "patch.connector",
        severity: "warning",
        title: `${tag} needs an adapter`,
        detail: `${run.from.label} is ${a.connector} and ${run.to.label} is ${b.connector}. The run is possible but not with one cable.`,
        deviceIds: ids,
      });
    }

    if (signalClassOf(a) !== signalClassOf(b)) {
      out.push({
        code: "patch.signal",
        severity: "warning",
        title: `${tag} changes signal type`,
        detail: `${run.from.label} carries ${a.signal} and ${run.to.label} carries ${b.signal}. Check that is deliberate.`,
        deviceIds: ids,
      });
    }
  }

  for (const [key, tagList] of seen) {
    if (tagList.length < 2) continue;
    // deviceId | bay | position | slot | port | index
    const port = key.split("|")[4] ?? "a connector";
    out.push({
      code: "patch.double-patched",
      severity: "error",
      title: `${port} is patched ${tagList.length} times`,
      detail: `${tagList.join(", ")} all land on the same physical connector. Only one cable fits.`,
    });
  }

  return out;
}

/** Whether two connector types mate without an adapter. */
function connectorsMate(a: string, b: string): boolean {
  if (a === b) return true;
  const COMBO = new Set(["XLR/TRS combo", "XLR3", "TRS", "TS"]);
  if (a === "XLR/TRS combo" && COMBO.has(b)) return true;
  if (b === "XLR/TRS combo" && COMBO.has(a)) return true;
  // A TRS plug goes into a TS socket and the reverse. Whether that is the right
  // thing to do is a wiring question, not a mechanical one, so it is not
  // flagged here.
  const JACK = new Set(["TRS", "TS"]);
  if (JACK.has(a) && JACK.has(b)) return true;
  const RJ = new Set(["RJ45", "Dante RJ45", "AES50 RJ45", "etherCON"]);
  if (RJ.has(a) && RJ.has(b)) return true;
  // "Other" is the catalog admitting it does not know what the connector is,
  // so it cannot disagree with anything.
  return a === "Other" || b === "Other";
}
