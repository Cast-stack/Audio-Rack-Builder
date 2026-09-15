import { test } from "node:test";
import assert from "node:assert/strict";

import { checkRack } from "./checks";
import { computeBudget } from "./budget";
import { requiredDepth } from "./geometry";
import type { CaseSpec, DeviceSpec, PortSpec, RackSpec } from "./types";
import { isHalfWidth, occupiedCells } from "./geometry";

// --------------------------------------------------------------- fixtures

function port(p: Partial<PortSpec> & { connector: string }): PortSpec {
  return {
    label: p.label ?? p.connector,
    connector: p.connector,
    direction: p.direction ?? "input",
    signal: p.signal ?? "analog audio",
    channels: p.channels ?? null,
    count: p.count ?? 1,
    face: p.face ?? "rear",
    projectionMm: p.projectionMm ?? null,
  };
}

/**
 * Overrides are applied by key presence, not by `??` — otherwise an explicit
 * `weightLb: null` (a device whose weight nobody publishes, which is the case
 * the completeness check exists for) silently picks up the default.
 */
function device(d: Partial<DeviceSpec> & { id: string }): DeviceSpec {
  const base: DeviceSpec = {
    id: d.id,
    slug: d.id,
    brand: "Test",
    model: d.id,
    category: "Audio Interface",
    formFactor: "full-rack",
    passive: false,
    rackUnits: 1,
    depthMm: 200,
    depthIsOverall: true,
    weightLb: 8,
    powerTypicalW: 40,
    powerMaxW: null,
    inrushFactor: 1,
    poePowered: false,
    ports: [port({ connector: "IEC C14", signal: "power" })],
  };
  return { ...base, ...d };
}

const CASE_4U: CaseSpec = {
  slug: "test-4u",
  name: "4U shock case",
  rackUnits: 4,
  usableDepthMm: 450,
  hasRearRails: true,
  maxLoadLb: 120,
  emptyWeightLb: 40,
};

function rack(over: Partial<RackSpec> = {}): RackSpec {
  return {
    name: "Test rack",
    case: over.case ?? CASE_4U,
    circuits: over.circuits ?? [{ label: "A", volts: 120, amps: 20 }],
    placements: over.placements ?? [],
  };
}

function mapOf(...ds: DeviceSpec[]): Map<string, DeviceSpec> {
  return new Map(ds.map((d) => [d.id, d]));
}

const codes = (r: ReturnType<typeof checkRack>) => r.results.map((x) => x.code);

// ------------------------------------------------------------------ depth

test("required depth is chassis plus connector plus bend, not chassis alone", () => {
  // The real Shure AD600: 286 mm chassis, six BNCs and a locking IEC on the back.
  const ad600 = device({
    id: "ad600",
    model: "AD600",
    depthMm: 286,
    ports: [
      port({ connector: "BNC", signal: "antenna", count: 6 }),
      port({ connector: "IEC C14", signal: "power" }),
      port({ connector: "Dante RJ45", signal: "digital audio" }),
    ],
  });

  const d = requiredDepth(ad600);
  assert.equal(d.chassisMm, 286);
  assert.equal(d.connectorMm, 50); // Dante RJ45 is the deepest of the three
  assert.equal(d.bendMm, 60); // medium — no stiff multipair on this unit
  assert.equal(d.requiredMm, 396);
});

test("a unit that fits on paper is caught when the connectors are counted", () => {
  const shallowCase: CaseSpec = { ...CASE_4U, usableDepthMm: 300, slug: "shallow" };
  const ad600 = device({
    id: "ad600",
    model: "AD600",
    depthMm: 286,
    ports: [port({ connector: "BNC", signal: "antenna", count: 6 })],
  });

  // Naive comparison says yes: 286 < 300.
  assert.ok(ad600.depthMm! < shallowCase.usableDepthMm);

  const report = checkRack(
    rack({ case: shallowCase, placements: [{ deviceId: "ad600", position: 1, circuit: "A" }] }),
    mapOf(ad600),
  );
  assert.ok(codes(report).includes("depth.will-not-fit"));
  assert.equal(report.errors, 1);
});

test("a DB25 loom drives the bend allowance for the whole unit", () => {
  const withDb25 = device({
    id: "db25",
    depthMm: 229,
    ports: [port({ connector: "DB25", signal: "analog audio", channels: 8 })],
  });
  assert.equal(requiredDepth(withDb25).bendMm, 90);
  assert.equal(requiredDepth(withDb25).requiredMm, 229 + 70 + 90);
});

test("tight clearance warns rather than errors", () => {
  const d = device({ id: "x", depthMm: 330, ports: [port({ connector: "RJ45", signal: "network" })] });
  // 330 + 50 + 60 = 440, against 450 usable → 10 mm headroom.
  const report = checkRack(
    rack({ placements: [{ deviceId: "x", position: 1, circuit: "A" }] }),
    mapOf(d),
  );
  assert.ok(codes(report).includes("depth.tight"));
  assert.equal(report.errors, 0);
});

// ------------------------------------------------------------- placement

test("overlapping units are an error", () => {
  const a = device({ id: "a", rackUnits: 2 });
  const b = device({ id: "b", rackUnits: 1 });
  const report = checkRack(
    rack({
      placements: [
        { deviceId: "a", position: 1, circuit: "A" },
        { deviceId: "b", position: 2, circuit: "A" },
      ],
    }),
    mapOf(a, b),
  );
  assert.ok(codes(report).includes("placement.collision"));
});

test("a unit running off the top of the case is an error", () => {
  const big = device({ id: "big", rackUnits: 3 });
  const report = checkRack(
    rack({ placements: [{ deviceId: "big", position: 3, circuit: "A" }] }),
    mapOf(big),
  );
  assert.ok(codes(report).includes("placement.overflows-case"));
});

// ----------------------------------------------------------------- power

test("continuous load is measured against 80% of the breaker, not 100%", () => {
  // Three 600 W units = 1800 W. A 20 A / 120 V circuit is 2400 W, but only
  // 1920 W of it is available to a continuous load.
  const heavy = (id: string) => device({ id, powerTypicalW: 700 });
  const report = checkRack(
    rack({
      placements: [
        { deviceId: "p1", position: 1, circuit: "A" },
        { deviceId: "p2", position: 2, circuit: "A" },
        { deviceId: "p3", position: 3, circuit: "A" },
      ],
    }),
    mapOf(heavy("p1"), heavy("p2"), heavy("p3")),
  );
  // 2100 W steady > 1920 W usable, but under the 2400 W breaker rating.
  assert.ok(codes(report).includes("power.over-continuous"));
});

test("inrush is flagged even when the steady load is comfortable", () => {
  const amp = device({ id: "amp", powerTypicalW: 400, inrushFactor: 6, category: "Power Amplifier" });
  const small = device({ id: "small", powerTypicalW: 60 });
  const report = checkRack(
    rack({
      placements: [
        { deviceId: "amp", position: 1, circuit: "A" },
        { deviceId: "small", position: 2, circuit: "A" },
      ],
    }),
    mapOf(amp, small),
  );
  const budget = computeBudget(
    rack({
      placements: [
        { deviceId: "amp", position: 1, circuit: "A" },
        { deviceId: "small", position: 2, circuit: "A" },
      ],
    }),
    mapOf(amp, small),
  );

  assert.equal(budget.circuits[0]!.typicalW, 460); // well under 1920 usable
  assert.equal(budget.circuits[0]!.inrushW, 2460); // 400*6 + 60, over the 2400 breaker
  assert.ok(codes(report).includes("power.inrush-trip"));
  assert.ok(!codes(report).includes("power.over-continuous"));
});

test("a powered unit with no circuit is called out and left out of the totals", () => {
  const d = device({ id: "d", powerTypicalW: 100 });
  const spec = rack({ placements: [{ deviceId: "d", position: 1, circuit: null }] });
  const report = checkRack(spec, mapOf(d));
  assert.ok(codes(report).includes("power.unassigned"));
  assert.equal(report.budget.circuits[0]!.typicalW, 0);
  assert.equal(report.budget.totalTypicalW, 100);
});

test("passive and PoE devices are not expected on a circuit", () => {
  const splitter = device({ id: "sp", category: "Splitter", passive: true, powerTypicalW: null });
  const poe = device({ id: "poe", poePowered: true, powerTypicalW: 12 });
  const report = checkRack(
    rack({
      placements: [
        { deviceId: "sp", position: 1, circuit: null },
        { deviceId: "poe", position: 2, circuit: null },
      ],
    }),
    mapOf(splitter, poe),
  );
  assert.ok(!codes(report).includes("power.unassigned"));
});

// ---------------------------------------------------------------- weight

test("centre of gravity rises when the heavy unit goes up top", () => {
  const heavy = device({ id: "h", weightLb: 40, powerTypicalW: 50 });
  const light = device({ id: "l", weightLb: 4, powerTypicalW: 50 });

  const low = computeBudget(
    rack({
      placements: [
        { deviceId: "h", position: 1, circuit: "A" },
        { deviceId: "l", position: 4, circuit: "A" },
      ],
    }),
    mapOf(heavy, light),
  );
  const high = computeBudget(
    rack({
      placements: [
        { deviceId: "l", position: 1, circuit: "A" },
        { deviceId: "h", position: 4, circuit: "A" },
      ],
    }),
    mapOf(heavy, light),
  );

  assert.ok(low.cogFraction! < high.cogFraction!);
  assert.ok(low.cogFraction! < 0.3);

  const report = checkRack(
    rack({
      placements: [
        { deviceId: "l", position: 1, circuit: "A" },
        { deviceId: "h", position: 4, circuit: "A" },
      ],
    }),
    mapOf(heavy, light),
  );
  assert.ok(codes(report).includes("weight.top-heavy"));
  assert.ok(codes(report).includes("weight.heavy-up-high"));
});

test("over the case load rating is an error", () => {
  const anvil = device({ id: "anvil", weightLb: 130, powerTypicalW: 50 });
  const report = checkRack(
    rack({ placements: [{ deviceId: "anvil", position: 1, circuit: "A" }] }),
    mapOf(anvil),
  );
  assert.ok(codes(report).includes("weight.over-case-rating"));
});

// --------------------------------------------------------------- thermal

test("heat past passive convection warns unless there is a fan", () => {
  const hot = device({ id: "hot", powerTypicalW: 300 });
  const placements = [{ deviceId: "hot", position: 1, circuit: "A" }];
  const noFan = checkRack(rack({ placements }), mapOf(hot));
  assert.ok(codes(noFan).includes("thermal.needs-airflow"));

  const fan = device({ id: "fan", category: "Rack Fan", powerTypicalW: 10, weightLb: 3 });
  const withFan = checkRack(
    rack({
      placements: [...placements, { deviceId: "fan", position: 2, circuit: "A" }],
    }),
    mapOf(hot, fan),
  );
  assert.ok(!codes(withFan).includes("thermal.needs-airflow"));
  assert.ok(codes(withFan).includes("thermal.verify-airflow"));
});

// ---------------------------------------------------------- completeness

test("a device missing a figure is surfaced, not silently zeroed", () => {
  const unknown = device({ id: "u", weightLb: null, powerTypicalW: null, powerMaxW: null, depthMm: null });
  const report = checkRack(
    rack({ placements: [{ deviceId: "u", position: 1, circuit: "A" }] }),
    mapOf(unknown),
  );
  assert.ok(codes(report).includes("data.incomplete"));
  assert.deepEqual(report.budget.incomplete[0]!.missing, ["weight", "depth", "power"]);
});

// ------------------------------------------------------------ clean rack

test("a well-built rack produces nothing to report", () => {
  const mixer = device({ id: "mixer", weightLb: 22, powerTypicalW: 90, depthMm: 250, rackUnits: 2 });
  const iface = device({ id: "iface", weightLb: 6, powerTypicalW: 25, depthMm: 229 });
  const report = checkRack(
    rack({
      placements: [
        { deviceId: "mixer", position: 1, circuit: "A" },
        { deviceId: "iface", position: 3, circuit: "A" },
      ],
    }),
    mapOf(mixer, iface),
  );
  assert.deepEqual(report.results, []);
  assert.equal(report.budget.unitsUsed, 3);
  assert.equal(report.budget.unitsFree, 1);
  assert.equal(report.budget.totalTypicalW, 115);
});

// --------------------------------------------------------------- half rack

test("two half-rack units share one U", () => {
  const a = device({ id: "rxA", formFactor: "half-rack", model: "SLXD4", weightLb: 1.8, powerTypicalW: 9 });
  const b = device({ id: "rxB", formFactor: "half-rack", model: "SLXD4", weightLb: 1.8, powerTypicalW: 9 });

  assert.ok(isHalfWidth(a));
  assert.deepEqual(occupiedCells(a, 1, "left"), ["1|left"]);
  assert.deepEqual(occupiedCells(a, 1, "right"), ["1|right"]);

  const report = checkRack(
    rack({
      placements: [
        { deviceId: "rxA", position: 1, slot: "left", circuit: "A" },
        { deviceId: "rxB", position: 1, slot: "right", circuit: "A" },
      ],
    }),
    mapOf(a, b),
  );
  assert.ok(!codes(report).includes("placement.collision"));
  assert.equal(report.errors, 0);
  // Both are counted, even though they share the U.
  assert.equal(report.budget.totalTypicalW, 18);
  assert.equal(report.budget.weightLb, 3.6);
  assert.equal(report.budget.unitsUsed, 1, "a shared U is one rack unit, not two");
  assert.equal(report.budget.unitsFree, 3);
});

test("two half-rack units in the SAME half collide", () => {
  const a = device({ id: "rxA", formFactor: "half-rack" });
  const b = device({ id: "rxB", formFactor: "half-rack" });
  const report = checkRack(
    rack({
      placements: [
        { deviceId: "rxA", position: 2, slot: "left", circuit: "A" },
        { deviceId: "rxB", position: 2, slot: "left", circuit: "A" },
      ],
    }),
    mapOf(a, b),
  );
  assert.ok(codes(report).includes("placement.collision"));
});

test("a full-width unit blocks both halves of its U", () => {
  const full = device({ id: "full", formFactor: "full-rack" });
  const half = device({ id: "half", formFactor: "half-rack" });
  const report = checkRack(
    rack({
      placements: [
        { deviceId: "full", position: 1, circuit: "A" },
        { deviceId: "half", position: 1, slot: "right", circuit: "A" },
      ],
    }),
    mapOf(full, half),
  );
  assert.ok(codes(report).includes("placement.collision"));
});

test("a lone half-rack unit is flagged as leaving a half open", () => {
  const half = device({ id: "half", formFactor: "half-rack" });
  const report = checkRack(
    rack({ placements: [{ deviceId: "half", position: 3, slot: "left", circuit: "A" }] }),
    mapOf(half),
  );
  const open = report.results.find((r) => r.code === "placement.half-open");
  assert.ok(open);
  assert.equal(open!.severity, "info");
  assert.equal(report.errors, 0);
  assert.match(open!.detail, /blanking plate/);
});

test("a filled pair raises no half-open note", () => {
  const a = device({ id: "a", formFactor: "half-rack" });
  const b = device({ id: "b", formFactor: "half-rack" });
  const report = checkRack(
    rack({
      placements: [
        { deviceId: "a", position: 3, slot: "left", circuit: "A" },
        { deviceId: "b", position: 3, slot: "right", circuit: "A" },
      ],
    }),
    mapOf(a, b),
  );
  assert.ok(!codes(report).includes("placement.half-open"));
});
