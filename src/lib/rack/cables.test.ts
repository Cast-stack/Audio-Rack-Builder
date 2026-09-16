/**
 * Patch tests.
 *
 * The checks here catch what a screen hides: a connector wired twice, two
 * outputs facing each other, a run that needs an adapter nobody packed. Each
 * one is asserted against a rack built to contain exactly that mistake, and a
 * clean rack is asserted to raise none of them.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { checkRack } from "./checks";
import { cableTags, resolveCables, signalClassOf, SIGNAL_STYLE } from "./cables";
import { DEMO_DEVICES, DEMO_RACK_DOUBLE, DEMO_RACK_MONITOR, SEED_CASES } from "@/lib/seed-data";
import type { CableSpec, DeviceSpec, PortSpec, RackSpec } from "./types";

const CASE = SEED_CASES[0]!;

function port(over: Partial<PortSpec>): PortSpec {
  return {
    label: "OUT",
    connector: "XLR3",
    direction: "output",
    signal: "analog audio",
    channels: 1,
    count: 1,
    face: "rear",
    projectionMm: null,
    ...over,
  };
}

function device(id: string, ports: PortSpec[]): DeviceSpec {
  return {
    id,
    slug: id,
    brand: "Test",
    model: id,
    category: "Audio Interface",
    formFactor: "full-rack",
    passive: false,
    rackUnits: 1,
    depthMm: 200,
    depthIsOverall: true,
    weightLb: 5,
    powerTypicalW: 10,
    powerMaxW: 12,
    inrushFactor: 1,
    poePowered: false,
    ports,
  };
}

function rackWith(devices: DeviceSpec[], cables: CableSpec[]): {
  rack: RackSpec;
  map: Map<string, DeviceSpec>;
} {
  return {
    rack: {
      name: "test",
      case: CASE,
      circuits: [{ label: "A", volts: 120, amps: 20 }],
      placements: devices.map((d, i) => ({
        deviceId: d.id,
        position: i + 1,
        slot: "full" as const,
        circuit: "A",
      })),
      cables,
    },
    map: new Map(devices.map((d) => [d.id, d])),
  };
}

function codes(rack: RackSpec, map: Map<string, DeviceSpec>): string[] {
  return checkRack(rack, map)
    .results.filter((r) => r.code.startsWith("patch."))
    .map((r) => r.code);
}

test("an output wired to an output is an error", () => {
  const a = device("a", [port({ label: "OUT", direction: "output" })]);
  const b = device("b", [port({ label: "OUT", direction: "output" })]);
  const { rack, map } = rackWith(
    [a, b],
    [
      {
        id: "x",
        from: { kind: "port", deviceId: "a", position: 1, port: "OUT" },
        to: { kind: "port", deviceId: "b", position: 2, port: "OUT" },
      },
    ],
  );
  assert.ok(codes(rack, map).includes("patch.direction"));
});

test("an output wired to an input raises nothing", () => {
  const a = device("a", [port({ label: "OUT", direction: "output" })]);
  const b = device("b", [port({ label: "IN", direction: "input" })]);
  const { rack, map } = rackWith(
    [a, b],
    [
      {
        id: "x",
        from: { kind: "port", deviceId: "a", position: 1, port: "OUT" },
        to: { kind: "port", deviceId: "b", position: 2, port: "IN" },
      },
    ],
  );
  assert.deepEqual(codes(rack, map), []);
});

test("a bidirectional port pairs with either kind", () => {
  const a = device("a", [port({ label: "NET", direction: "bidirectional", connector: "RJ45", signal: "network" })]);
  const b = device("b", [port({ label: "NET", direction: "bidirectional", connector: "RJ45", signal: "network" })]);
  const { rack, map } = rackWith(
    [a, b],
    [
      {
        id: "x",
        from: { kind: "port", deviceId: "a", position: 1, port: "NET" },
        to: { kind: "port", deviceId: "b", position: 2, port: "NET" },
      },
    ],
  );
  assert.deepEqual(codes(rack, map), []);
});

test("one connector patched twice is an error", () => {
  const a = device("a", [port({ label: "OUT", direction: "output" })]);
  const b = device("b", [port({ label: "IN", direction: "input" }), port({ label: "IN2", direction: "input" })]);
  const { rack, map } = rackWith(
    [a, b],
    [
      {
        id: "x",
        from: { kind: "port", deviceId: "a", position: 1, port: "OUT" },
        to: { kind: "port", deviceId: "b", position: 2, port: "IN" },
      },
      {
        id: "y",
        from: { kind: "port", deviceId: "a", position: 1, port: "OUT" },
        to: { kind: "port", deviceId: "b", position: 2, port: "IN2" },
      },
    ],
  );
  assert.ok(codes(rack, map).includes("patch.double-patched"));
});

test("two connectors of the SAME port are two different sockets", () => {
  // An eight-way XLR strip is one PortSpec with count 8. Patching #1 and #2 is
  // normal; treating them as the same connector would make every loom an error.
  const a = device("a", [port({ label: "OUT", direction: "output", count: 8 })]);
  const b = device("b", [port({ label: "IN", direction: "input", count: 8 })]);
  const { rack, map } = rackWith(
    [a, b],
    [
      {
        id: "x",
        from: { kind: "port", deviceId: "a", position: 1, port: "OUT", index: 0 },
        to: { kind: "port", deviceId: "b", position: 2, port: "IN", index: 0 },
      },
      {
        id: "y",
        from: { kind: "port", deviceId: "a", position: 1, port: "OUT", index: 1 },
        to: { kind: "port", deviceId: "b", position: 2, port: "IN", index: 1 },
      },
    ],
  );
  assert.deepEqual(codes(rack, map), []);
});

test("a connector mismatch warns rather than errors", () => {
  const a = device("a", [port({ label: "OUT", direction: "output", connector: "XLR3" })]);
  const b = device("b", [port({ label: "IN", direction: "input", connector: "BNC", signal: "analog audio" })]);
  const { rack, map } = rackWith(
    [a, b],
    [
      {
        id: "x",
        from: { kind: "port", deviceId: "a", position: 1, port: "OUT" },
        to: { kind: "port", deviceId: "b", position: 2, port: "IN" },
      },
    ],
  );
  const found = codes(rack, map);
  assert.ok(found.includes("patch.connector"));
  assert.ok(!found.includes("patch.direction"));
});

test("a combo socket takes an XLR without an adapter warning", () => {
  const a = device("a", [port({ label: "OUT", direction: "output", connector: "XLR3" })]);
  const b = device("b", [port({ label: "IN", direction: "input", connector: "XLR/TRS combo" })]);
  const { rack, map } = rackWith(
    [a, b],
    [
      {
        id: "x",
        from: { kind: "port", deviceId: "a", position: 1, port: "OUT" },
        to: { kind: "port", deviceId: "b", position: 2, port: "IN" },
      },
    ],
  );
  assert.deepEqual(codes(rack, map), []);
});

test("a run to somewhere outside the rack is checked, not skipped", () => {
  const a = device("a", [port({ label: "OUT", direction: "output" })]);
  const { rack, map } = rackWith(
    [a],
    [
      {
        id: "x",
        from: { kind: "port", deviceId: "a", position: 1, port: "OUT" },
        to: { kind: "external", name: "FOH console" },
      },
      {
        id: "y",
        from: { kind: "port", deviceId: "a", position: 1, port: "OUT" },
        to: { kind: "external", name: "Monitor console" },
      },
    ],
  );
  // The same socket cannot feed two places, wherever those places are.
  assert.ok(codes(rack, map).includes("patch.double-patched"));
});

test("a run whose device left the rack is dropped, not drawn to nowhere", () => {
  const a = device("a", [port({ label: "OUT", direction: "output" })]);
  const { rack, map } = rackWith(
    [a],
    [
      {
        id: "x",
        from: { kind: "port", deviceId: "a", position: 1, port: "OUT" },
        to: { kind: "port", deviceId: "gone", position: 4, port: "IN" },
      },
    ],
  );
  assert.equal(resolveCables(rack, map).length, 0);
  assert.deepEqual(codes(rack, map), []);
});

test("half-rack units sharing a U are told apart by slot", () => {
  // deviceId and position alone do not name a placement when an identical pair
  // shares the row, which is the normal case for wireless.
  const runs = resolveCables(DEMO_RACK_MONITOR, DEMO_DEVICES);
  const loops = runs.filter((r) => r.cable.id === "c7" || r.cable.id === "c8");
  assert.equal(loops.length, 2);
  for (const l of loops) {
    assert.equal(l.from.slot, "left");
    assert.equal(l.to.slot, "right");
  }
});

test("the demo patch is clean", () => {
  assert.deepEqual(codes(DEMO_RACK_MONITOR, DEMO_DEVICES), []);
});

test("every signal class has a distinct colour and its own dash", () => {
  const styles = Object.values(SIGNAL_STYLE);
  const colours = new Set(styles.map((s) => s.colour));
  assert.equal(colours.size, styles.length, "two classes share a colour");
  const dashes = new Set(styles.map((s) => String(s.dash)));
  assert.equal(dashes.size, styles.length, "two classes share a dash pattern — the sheet is photocopied");
});

test("the tag on the drawing is the tag in the schedule", () => {
  const runs = resolveCables(DEMO_RACK_MONITOR, DEMO_DEVICES);
  const tags = cableTags(runs);
  assert.equal(tags.size, runs.length, "a run went untagged");
  for (const run of runs) {
    const tag = tags.get(run.cable.id);
    assert.ok(tag && tag.trim().length, `${run.cable.id} has an empty tag`);
    assert.ok(!/^c\d+$/.test(tag), `${run.cable.id} is tagged with its internal id`);
  }
  assert.equal(new Set(tags.values()).size, tags.size, "two runs carry the same tag");
});

test("signal class comes from the port, not from a guess", () => {
  assert.equal(signalClassOf(port({ signal: "power" })), "power");
  assert.equal(signalClassOf(port({ signal: "antenna" })), "rf");
  assert.equal(signalClassOf(port({ signal: "network" })), "network");
  assert.equal(signalClassOf(port({ signal: "digital audio" })), "digital audio");
  assert.equal(signalClassOf(port({ signal: "analog audio" })), "analog audio");
});

// ------------------------------------------------------------------- bays

test("the same U in two bays holds two units, not one", () => {
  const a = device("a", [port({ label: "OUT" })]);
  const two = {
    ...CASE,
    bays: 2,
    slug: "two-bay",
    name: "two bay",
  };
  const rack: RackSpec = {
    name: "t",
    case: two,
    circuits: [{ label: "A", volts: 120, amps: 20 }],
    placements: [
      { deviceId: "a", bay: 1, position: 1, slot: "full", circuit: "A" },
      { deviceId: "a", bay: 2, position: 1, slot: "full", circuit: "A" },
    ],
  };
  const map = new Map([["a", a]]);
  const report = checkRack(rack, map);
  assert.deepEqual(
    report.results.filter((r) => r.code === "placement.collision"),
    [],
    "two bays were treated as one column",
  );
  assert.equal(report.budget.unitsTotal, CASE.rackUnits * 2);
  assert.equal(report.budget.unitsUsed, 2);
});

test("a unit in a bay the case does not have is an error", () => {
  const a = device("a", [port({ label: "OUT" })]);
  const rack: RackSpec = {
    name: "t",
    case: CASE,
    circuits: [],
    placements: [{ deviceId: "a", bay: 3, position: 1, slot: "full", circuit: null }],
  };
  const codes = checkRack(rack, new Map([["a", a]])).results.map((r) => r.code);
  assert.ok(codes.includes("placement.no-such-bay"));
});

test("a lopsided wide case is called out, an even one is not", () => {
  const heavy = { ...device("h", [port({ label: "OUT" })]), weightLb: 60 };
  const light = { ...device("l", [port({ label: "IN", direction: "input" as const })]), weightLb: 4 };
  const two = { ...CASE, bays: 2, slug: "two-bay", name: "two bay", maxLoadLb: 400 };
  const map = new Map([["h", heavy], ["l", light]]);

  const lopsided: RackSpec = {
    name: "t",
    case: two,
    circuits: [{ label: "A", volts: 120, amps: 20 }],
    placements: [
      { deviceId: "h", bay: 1, position: 1, slot: "full", circuit: "A" },
      { deviceId: "l", bay: 2, position: 1, slot: "full", circuit: "A" },
    ],
  };
  assert.ok(
    checkRack(lopsided, map).results.some((r) => r.code === "weight.lopsided"),
    "all the weight in one bay went unremarked",
  );

  const even: RackSpec = {
    ...lopsided,
    placements: [
      { deviceId: "h", bay: 1, position: 1, slot: "full", circuit: "A" },
      { deviceId: "h", bay: 2, position: 1, slot: "full", circuit: "A" },
    ],
  };
  assert.ok(!checkRack(even, map).results.some((r) => r.code === "weight.lopsided"));
});

test("a single-bay case is never called lopsided", () => {
  const heavy = { ...device("h", [port({ label: "OUT" })]), weightLb: 60 };
  const rack: RackSpec = {
    name: "t",
    case: CASE,
    circuits: [{ label: "A", volts: 120, amps: 20 }],
    placements: [{ deviceId: "h", position: 1, slot: "full", circuit: "A" }],
  };
  const report = checkRack(rack, new Map([["h", heavy]]));
  assert.equal(report.budget.lateralImbalance, 0);
  assert.ok(!report.results.some((r) => r.code === "weight.lopsided"));
});

test("a run crosses bays and still resolves to both ends", () => {
  const runs = resolveCables(DEMO_RACK_DOUBLE, DEMO_DEVICES);
  const crossing = runs.filter(
    (r) => r.from.kind === "port" && r.to.kind === "port" && r.from.bay !== r.to.bay,
  );
  assert.ok(crossing.length >= 2, "the double-wide demo should patch across its bays");
  for (const r of crossing) {
    assert.ok(r.from.device && r.to.device);
  }
});

test("the same model in the same U of two bays is two connectors", () => {
  // Without the bay in the key these are one socket, and patching both would
  // read as a double-patch.
  const a = device("a", [port({ label: "OUT" }), port({ label: "IN", direction: "input" })]);
  const two = { ...CASE, bays: 2, slug: "two-bay", name: "two bay" };
  const rack: RackSpec = {
    name: "t",
    case: two,
    circuits: [],
    placements: [
      { deviceId: "a", bay: 1, position: 1, slot: "full", circuit: null },
      { deviceId: "a", bay: 2, position: 1, slot: "full", circuit: null },
    ],
    cables: [
      {
        id: "x",
        from: { kind: "port", deviceId: "a", bay: 1, position: 1, port: "OUT" },
        to: { kind: "external", name: "console 1" },
      },
      {
        id: "y",
        from: { kind: "port", deviceId: "a", bay: 2, position: 1, port: "OUT" },
        to: { kind: "external", name: "console 2" },
      },
    ],
  };
  const codes = checkRack(rack, new Map([["a", a]]))
    .results.filter((r) => r.code.startsWith("patch."))
    .map((r) => r.code);
  assert.deepEqual(codes, []);
});
