/**
 * The two places the guardrails deliberately loosen, and the lines they must
 * not loosen past.
 *
 * Both exist because the catalog backfill hit real gear the old rules could
 * not describe: a rack drawer has no connectors, and a power conditioner's
 * maker often prints what it passes but not what it draws. Each exemption is
 * scoped to exactly those categories, and these tests are what keep it there.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import type { Device, Provenance, ResearchResult } from "./schema";
import { triage } from "./validate";

const SRC = "https://furmanpower.com/products/x";

function cite(field: string): Provenance {
  return { field, sourceUrl: SRC, quote: `${field} as printed`, confidence: 0.95, derivation: null };
}

function record(over: Partial<Device>, extraCites: string[] = []): ResearchResult {
  const device = {
    brand: "Furman",
    model: "Test Unit",
    category: "Power Conditioner",
    description: "A unit used to exercise the guardrails.",
    formFactor: "full-rack",
    rackUnits: 1,
    depthMm: 254,
    weightLb: 10,
    powerTypicalW: null,
    powerMaxW: null,
    powerInput: "Edison",
    voltage: "120V",
    poePowered: false,
    ports: [{ label: "AC In", connector: "Edison", direction: "input", signal: "power", channels: null, count: 1, face: "rear" }],
    status: "current",
    statusNote: null,
    priceUsd: null,
    priceKind: null,
    priceVerifiedAt: null,
    productUrl: SRC,
    datasheetUrl: null,
    ...over,
  } as Device;
  const fields = ["brand", "model", "category", "formFactor", "rackUnits", "depthMm", "weightLb", ...extraCites];
  if (device.ports.length) fields.push("ports");
  return { device, provenance: fields.map(cite), unresolved: [], notes: null };
}

const errors = (r: ResearchResult) => triage(r).issues.filter((i) => i.severity === "error");

test("a passive drawer with no connectors is a complete record", () => {
  const r = record({ category: "Rack Drawer", ports: [], powerInput: null, voltage: null });
  assert.deepEqual(errors(r), [], "a drawer has nothing to plug in and nothing to cite for it");
  assert.notEqual(triage(r).disposition, "reject");
});

test("active gear with no connectors is still rejected", () => {
  const r = record({ category: "Wireless Mic Receiver", ports: [], powerMaxW: 10 }, ["powerMaxW"]);
  assert.ok(
    errors(r).some((i) => i.field === "ports"),
    "an empty port list on a receiver is a research failure, not a fact",
  );
});

test("a power conditioner with no printed draw is flagged, not rejected", () => {
  const r = record({ category: "Power Conditioner" });
  assert.deepEqual(errors(r), []);
  const warn = triage(r).issues.find(
    (i) => i.field === "powerTypicalW" && /output rating/.test(i.message),
  );
  assert.ok(warn, "the missing figure still has to be raised, naming the output-rating trap");
  assert.equal(warn!.severity, "warn");
  assert.equal(triage(r).disposition, "review", "it still needs a person to look");
});

test("distros, sequencers and antenna distros get the same allowance", () => {
  for (const category of ["Power Distro", "Sequencer", "Antenna Distro"]) {
    assert.deepEqual(errors(record({ category })), [], `${category} with no own draw`);
  }
});

test("a UPS with no power figure is still rejected", () => {
  // UPS makers print their losses. One without a figure has not been read properly.
  const r = record({ category: "UPS" });
  assert.ok(errors(r).some((i) => i.field === "powerTypicalW"));
});

test("any other active gear with no power figure is still rejected", () => {
  const r = record({ category: "Network Switch" });
  assert.ok(errors(r).some((i) => i.field === "powerTypicalW"));
});
