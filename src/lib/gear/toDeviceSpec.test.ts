/**
 * The seam between what a researcher can read and what the engine can place.
 *
 * Everything asserted here is a field no manufacturer prints. Getting one of
 * them silently wrong is how a researched device ends up looking shallower,
 * lighter or calmer than the real box.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { requiredDepth } from "@/lib/rack/geometry";
import type { Device } from "./schema";
import {
  DEFAULT_INRUSH,
  PASSIVE_INRUSH,
  isProvisional,
  toProvisionalDevice,
} from "./toDeviceSpec";

function device(over: Partial<Device> = {}): Device {
  return {
    brand: "Furman",
    model: "PL-Plus C",
    category: "Power Conditioner",
    description: "A rack power conditioner with lights and a voltmeter, used for testing.",
    formFactor: "full-rack",
    rackUnits: 1,
    depthMm: 254,
    weightLb: 12,
    powerTypicalW: null,
    powerMaxW: 20,
    powerInput: "Edison",
    voltage: "120VAC",
    poePowered: false,
    ports: [
      { label: "AC In", connector: "Edison", direction: "input", signal: "power", channels: null, count: 1, face: "rear" },
    ],
    status: "current",
    statusNote: null,
    priceUsd: null,
    priceKind: null,
    priceVerifiedAt: null,
    productUrl: null,
    datasheetUrl: null,
    ...over,
  } as Device;
}

test("a researched device becomes something the engine can measure", () => {
  const d = toProvisionalDevice(device(), { requestedAs: "Furman PL-Plus C" });
  assert.equal(d.brand, "Furman");
  assert.equal(d.rackUnits, 1);
  assert.equal(d.ports.length, 1);
  // The point of the conversion: geometry can now run on it.
  assert.equal(typeof requiredDepth(d).requiredMm, "number");
});

test("published depth is treated as overall, never as depth behind the rails", () => {
  const d = toProvisionalDevice(device({ depthMm: 254 }), { requestedAs: "x" });
  assert.equal(d.depthIsOverall, true, "assuming otherwise makes every device shallower than it is");
  assert.ok(
    d.unresolved.some((u) => u.includes("depth behind rails")),
    "the assumption has to be visible on the sheet",
  );
});

test("inrush is the house default and says so", () => {
  const d = toProvisionalDevice(device(), { requestedAs: "x" });
  assert.equal(d.inrushFactor, DEFAULT_INRUSH);
  assert.ok(d.unresolved.some((u) => u.includes("inrushFactor")));
});

test("passive categories come out passive, and do not surge", () => {
  const d = toProvisionalDevice(device({ category: "Patch Bay" }), { requestedAs: "x" });
  assert.equal(d.passive, true);
  assert.equal(d.inrushFactor, PASSIVE_INRUSH);

  const active = toProvisionalDevice(device({ category: "Power Conditioner" }), { requestedAs: "x" });
  assert.equal(active.passive, false);
});

test("no panel is claimed, and the gap is recorded", () => {
  const d = toProvisionalDevice(device(), { requestedAs: "x" });
  assert.equal(d.panel, null);
  assert.ok(
    d.unresolved.some((u) => u.includes("panel")),
    "panels.test.ts holds seeded devices to this; researched ones are no different",
  );
});

test("ids do not collide when the same box is asked for twice", () => {
  const first = toProvisionalDevice(device(), { requestedAs: "x" });
  const second = toProvisionalDevice(device(), { requestedAs: "x", taken: [first.id] });
  assert.notEqual(first.id, second.id);
  assert.ok(second.id.startsWith(first.id), `${second.id} should be a variant of ${first.id}`);
});

test("a provisional device is marked as one and carries its evidence", () => {
  const d = toProvisionalDevice(device(), {
    requestedAs: "Furman PL-Plus C",
    provenance: [
      { field: "depthMm", sourceUrl: "https://furmanpower.com/x", quote: "10 in", confidence: 0.8, derivation: null },
    ],
    notes: "read off the product page",
  });
  assert.equal(isProvisional(d), true);
  assert.equal(d.requestedAs, "Furman PL-Plus C");
  assert.equal(d.provenance.length, 1);
  assert.equal(d.notes, "read off the product page");
  assert.ok(Date.parse(d.researchedAt) > 0, "researchedAt must be a real timestamp");
});

test("a seeded device is not mistaken for a provisional one", () => {
  assert.equal(isProvisional({ id: "shure-ad600" }), false);
  assert.equal(isProvisional(null), false);
  assert.equal(isProvisional("prov-anything"), false);
});
