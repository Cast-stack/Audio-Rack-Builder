/**
 * Structural tests for the patch sheet.
 *
 * These assert the things that silently go wrong and that nobody notices until
 * a rack is half-built: a port missing from the connection schedule, a figure
 * printed without its source, a mirrored rear elevation that puts both rack
 * ears in the middle. The visual quality of the page is not testable here and
 * is checked by eye against a rendered PDF.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { renderPatchSheet, type SourceRow } from "./patchSheet";
import { renderElevation } from "./elevation";
import { W } from "@/lib/rack/panels";
import { DEMO_RACK_WIRELESS, SEED_DEVICES } from "@/lib/seed-data";
import type { DeviceSpec } from "@/lib/rack/types";

const devices = new Map<string, DeviceSpec>(SEED_DEVICES.map((d) => [d.id, d]));
const sources = new Map<string, SourceRow[]>(SEED_DEVICES.map((d) => [d.id, d.provenance]));
const unresolved = new Map<string, string[]>(
  SEED_DEVICES.filter((d) => d.unresolved.length).map((d) => [d.id, d.unresolved]),
);

const rack = DEMO_RACK_WIRELESS;
const html = renderPatchSheet({ rack, devices, sources, unresolved });

/** Devices actually placed in the rack, deduped. */
function placedDevices(): DeviceSpec[] {
  const seen = new Set<string>();
  const out: DeviceSpec[] = [];
  for (const p of rack.placements) {
    const d = devices.get(p.deviceId);
    if (d && !seen.has(d.id)) {
      seen.add(d.id);
      out.push(d);
    }
  }
  return out;
}

test("every placed device appears on the sheet", () => {
  for (const d of placedDevices()) {
    assert.ok(
      html.includes(`${d.brand}</b> ${d.model}`) || html.includes(`${d.brand} ${d.model}`),
      `${d.brand} ${d.model} is missing from the sheet`,
    );
  }
});

test("every port of every placed device reaches the connection schedule", () => {
  for (const d of placedDevices()) {
    for (const port of d.ports) {
      assert.ok(
        html.includes(`<td>${port.label}</td>`) ||
          html.includes(port.label.replace(/&/g, "&amp;").replace(/"/g, "&quot;")),
        `${d.brand} ${d.model} port "${port.label}" is missing`,
      );
    }
  }
});

test("the connection schedule leaves a blank column to write in", () => {
  assert.match(html, /class="fillhead">Patched to</);
  assert.ok(html.includes('class="fill"'), "no write-in cells rendered");
});

test("every provenance quote is carried into the sources appendix", () => {
  let checked = 0;
  for (const d of placedDevices()) {
    for (const row of sources.get(d.id) ?? []) {
      // Quotes carry quotation marks and ampersands; compare on a safe slice.
      const needle = row.quote.slice(0, 40).replace(/[&<>"]/g, "");
      if (!needle.trim()) continue;
      assert.ok(html.includes(needle), `missing source quote for ${d.model} ${row.field}`);
      checked++;
    }
  }
  assert.ok(checked > 10, `expected a substantial appendix, checked only ${checked} quotes`);
});

test("a derived figure is labelled as derived rather than presented as published", () => {
  const derived = placedDevices()
    .flatMap((d) => sources.get(d.id) ?? [])
    .filter((r) => r.derivation);
  assert.ok(derived.length > 0, "the demo rack should exercise derived figures");
  assert.ok(html.includes("<b>Derived:</b>"), "derivations are not marked on the sheet");
});

test("fields with no published source are named, not quietly omitted", () => {
  const someUnresolved = [...unresolved.values()].flat()[0];
  assert.ok(someUnresolved, "the demo catalog should have at least one unresolved field");
  assert.ok(html.includes("No published source found for:"));
});

test("the depth ledger shows the working figures as working figures", () => {
  assert.ok(
    html.includes("not manufacturer data"),
    "the sheet must not present its own projection estimates as published data",
  );
});

test("a rear elevation mirrors the halves", () => {
  const front = renderElevation(rack, devices, "front");
  const rear = renderElevation(rack, devices, "rear");
  // U3 in the demo rack holds a half-rack pair, so the two faces must disagree
  // about which side each one is on.
  assert.notEqual(front, rear);
  const halfX = String(W / 2);
  assert.ok(front.includes(halfX), "no right-hand half drawn on the front");
  assert.ok(rear.includes(halfX), "no right-hand half drawn on the rear");
});

test("a mirrored half-rack panel flips its rack ear with it", () => {
  const pair = SEED_DEVICES.find((d) => d.formFactor === "half-rack");
  assert.ok(pair, "expected a half-rack device in the catalog");
  const one = { ...rack, placements: [{ deviceId: pair.id, position: 1, slot: "left" as const, circuit: null }] };
  const front = renderElevation(one, devices, "front");
  const rear = renderElevation(one, devices, "rear");
  // The ear is the only full-height fill on a half panel. On the front the
  // unit sits left with its ear at the left edge; mirrored to the rear it sits
  // right, and the ear must travel to the right edge rather than stay inboard.
  const earFront = /<rect x="(\d+(?:\.\d+)?)" y="0" width="118"/.exec(front);
  const earRear = /<rect x="(\d+(?:\.\d+)?)" y="0" width="118"/.exec(rear);
  assert.ok(earFront && earRear, "no rack ears drawn");
  assert.ok(
    Number(earRear[1]) > Number(earFront[1]),
    "the rear ear did not move outboard — both ears would collide mid-rack",
  );
});

test("the document is self-contained", () => {
  assert.match(html, /^<!doctype html>/);
  assert.ok(!/<script/i.test(html), "a printable sheet should carry no script");
  assert.ok(!/(src|href)="https?:/i.test(html), "the sheet must not depend on network fetches");
});
