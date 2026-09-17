/**
 * Every researched record, re-checked on every test run.
 *
 * scripts/check-research.ts gates a batch on the way in. This gates the file
 * as it sits in the tree, so a hand edit, a bad merge, or a rule tightened
 * later cannot leave a record in the catalog that would no longer pass.
 *
 * One difference from the script: no --extra-hosts here. A manufacturer
 * domain admitted during research has to be on MANUFACTURER_DOMAINS before
 * its records ship.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { CATEGORY_NAMES } from "@/lib/gear/catalog";
import { ResearchResultSchema } from "@/lib/gear/schema";
import { isManufacturerHost } from "@/lib/gear/sources";
import { triage } from "@/lib/gear/validate";
import { HAND_DEVICES, SEED_DEVICES } from "@/lib/seed-data";

import { RESEARCHED_DEVICES, RESEARCHED_RECORDS } from "./index";

const name = (r: { device: { brand: string; model: string } }) => `${r.device.brand} ${r.device.model}`;
const host = (url: string) => new URL(url).hostname.toLowerCase();

test("every researched record still matches the research schema", () => {
  for (const r of RESEARCHED_RECORDS) {
    const parsed = ResearchResultSchema.safeParse(r);
    assert.ok(parsed.success, `${name(r)}: ${parsed.success ? "" : parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`);
  }
});

test("every researched record passes triage and sits in the taxonomy", () => {
  for (const r of RESEARCHED_RECORDS) {
    assert.ok(CATEGORY_NAMES.includes(r.device.category), `${name(r)}: category ${r.device.category}`);
    const { disposition, issues } = triage(r);
    assert.notEqual(
      disposition,
      "reject",
      `${name(r)}: ${issues.filter((i) => i.severity === "error").map((i) => `${i.field} ${i.message}`).join("; ")}`,
    );
  }
});

test("every citation is on a manufacturer's own domain", () => {
  for (const r of RESEARCHED_RECORDS) {
    const urls = [
      ...r.provenance.map((p) => p.sourceUrl),
      r.device.productUrl,
      r.device.datasheetUrl,
    ].filter((u): u is string => !!u);
    for (const url of urls) {
      assert.ok(
        isManufacturerHost(host(url)),
        `${name(r)} cites ${host(url)}, which is not on MANUFACTURER_DOMAINS`,
      );
    }
  }
});

test("researched gear takes real rack space", () => {
  // The engine draws anything under 1U as 1U. A Mac mini on a shelf does not
  // own a rack unit, so desktop gear stays out until the planner can place it
  // on something.
  for (const d of RESEARCHED_DEVICES) {
    assert.ok(d.rackUnits >= 1, `${d.brand} ${d.model} is ${d.rackUnits}U`);
  }
});

test("no device is in the catalog twice", () => {
  const ids = SEED_DEVICES.map((d) => d.id);
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  assert.deepEqual(dupes, [], `duplicate ids: ${dupes.join(", ")}`);

  const key = (b: string, m: string) => `${b} ${m}`.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const hand = new Set(HAND_DEVICES.map((d) => key(d.brand, d.model)));
  for (const d of RESEARCHED_DEVICES) {
    assert.ok(!hand.has(key(d.brand, d.model)), `${d.brand} ${d.model} is already hand-entered`);
  }
});

test("a researched device carries its evidence to the sheet", () => {
  for (const d of RESEARCHED_DEVICES) {
    assert.ok(d.provenance.length > 0, `${d.brand} ${d.model} has no provenance`);
    assert.ok(
      d.unresolved.some((u) => u.includes("panel")),
      `${d.brand} ${d.model} is drawn from a template and must say so`,
    );
  }
});
