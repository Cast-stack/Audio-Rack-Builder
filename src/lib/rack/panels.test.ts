/**
 * Panel-layout tests.
 *
 * The drawing itself is judged by eye against the manuals. What is testable —
 * and what breaks silently — is the wiring between a researched layout and the
 * device record it describes: a jack element pointing at a port label that no
 * longer exists draws a grey placeholder block, which looks like a connector
 * and is wrong.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { draw, W, U } from "./panels";
import { isHalfWidth } from "./geometry";
import { SEED_DEVICES } from "@/lib/seed-data";
import type { PanelElement } from "./types";

function faces(d: (typeof SEED_DEVICES)[number]): ["front" | "rear", PanelElement[]][] {
  const out: ["front" | "rear", PanelElement[]][] = [];
  if (d.panel?.front?.elements) out.push(["front", d.panel.front.elements]);
  if (d.panel?.rear?.elements) out.push(["rear", d.panel.rear.elements]);
  return out;
}

test("every jack element points at a port the device actually has", () => {
  for (const d of SEED_DEVICES) {
    const labels = new Set(d.ports.map((p) => p.label));
    for (const [face, elements] of faces(d)) {
      for (const el of elements) {
        if (el.kind !== "jack") continue;
        assert.ok(el.port, `${d.id} ${face}: jack element with no port reference`);
        assert.ok(
          labels.has(el.port),
          `${d.id} ${face}: jack points at "${el.port}", which is not one of ${[...labels].join(", ")}`,
        );
      }
    }
  }
});

test("a jack element sits on the face its port sits on", () => {
  for (const d of SEED_DEVICES) {
    const byLabel = new Map(d.ports.map((p) => [p.label, p]));
    for (const [face, elements] of faces(d)) {
      for (const el of elements) {
        if (el.kind !== "jack" || !el.port) continue;
        const port = byLabel.get(el.port);
        assert.equal(
          port?.face,
          face,
          `${d.id}: "${el.port}" is drawn on the ${face} but recorded on the ${port?.face}`,
        );
      }
    }
  }
});

test("a layout is traceable back to its manual", () => {
  for (const d of SEED_DEVICES) {
    if (!d.panel?.front?.elements?.length) continue;
    // Generic infrastructure has no manufacturer behind it and is exempt.
    if (d.brand === "Generic") continue;
    const cited = d.provenance.some((p) => p.field.startsWith("panel."));
    assert.ok(cited, `${d.id} has a researched panel layout but no provenance row for it`);
  }
});

test("a device with no layout is recorded as a gap rather than passed off as drawn", () => {
  for (const d of SEED_DEVICES) {
    if (d.brand === "Generic" || d.panel?.front?.elements?.length) continue;
    assert.ok(
      d.unresolved.some((u) => u.includes("panel")),
      `${d.id} falls back to the category panel but does not say so in unresolved`,
    );
  }
});

test("readouts are recorded on a display, never as parts of their own", () => {
  for (const d of SEED_DEVICES) {
    for (const [face, elements] of faces(d)) {
      for (const el of elements) {
        if (!el.readouts?.length) continue;
        assert.equal(
          el.kind,
          "display",
          `${d.id} ${face}: readouts belong to a display, not a ${el.kind}`,
        );
      }
    }
  }
});

test("nothing a layout draws escapes its own panel", () => {
  // Elements are laid out across the face and scaled to fit; a bad width or a
  // vertical stack that sizes from the panel height instead of its step runs
  // off the unit and over the gear above it.
  for (const d of SEED_DEVICES) {
    const half = isHalfWidth(d) ? ("left" as const) : null;
    const units = Math.max(1, Math.ceil(d.rackUnits));
    const pw = half ? W / 2 : W;
    const h = units * U;
    for (const face of ["front", "rear"] as const) {
      const svg = draw(d, face, units, { half });
      for (const m of svg.matchAll(/<rect x="(-?[\d.]+)" y="(-?[\d.]+)" width="([\d.]+)" height="([\d.]+)"/g)) {
        const [x, y, w, hh] = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])];
        assert.ok(y >= -1 && y + hh <= h + 1, `${d.id} ${face}: a rect spans ${y}..${y + hh} in a ${h}-tall panel`);
        assert.ok(x >= -1 && x + w <= pw + 1, `${d.id} ${face}: a rect spans ${x}..${x + w} in a ${pw}-wide panel`);
      }
      for (const m of svg.matchAll(/<circle cx="(-?[\d.]+)" cy="(-?[\d.]+)" r="([\d.]+)"/g)) {
        const [cy, r] = [Number(m[2]), Number(m[3])];
        assert.ok(cy - r >= -1 && cy + r <= h + 1, `${d.id} ${face}: a circle spans ${cy - r}..${cy + r} in a ${h}-tall panel`);
      }
    }
  }
});
