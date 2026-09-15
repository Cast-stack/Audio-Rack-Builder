/**
 * Rack elevations for print.
 *
 * The same panel renderer the planner uses on screen, stacked at true scale
 * into a single SVG with a U ruler down the side. On paper the palette flips
 * to shop-drawing line art — white face, black edges — because a patch sheet
 * gets photocopied, marked up in pen, and taped inside a case lid, and none of
 * that survives a page of dark grey toner. The connector colours stay, since
 * they carry direction, and every connector also carries its own glyph shape
 * so the sheet still reads correctly in mono.
 */

import { drawInner, U, W } from "@/lib/rack/panels";
import { isHalfWidth, slotsFor } from "@/lib/rack/geometry";
import type { DeviceSpec, RackSpec } from "@/lib/rack/types";

/** Left gutter carrying the U numbers, in panel units. */
const RULER_W = 150;
/** Air around the drawing so the rails are not against the page edge. */
const MARGIN = 40;

export interface ElevationOptions {
  /**
   * A rear elevation is what you see standing behind the rack, so the halves
   * swap sides. Set false to draw the rear in front-view order, which is
   * occasionally what a shop drawing wants.
   */
  mirrorRear?: boolean;
}

/** Where a placement's panel sits, in elevation coordinates. */
/**
 * Which half of the U a panel is drawn in, seen from this face. The flip has
 * to carry through to the panel itself, not just its x: a half-rack chassis
 * has one outer ear and one bare jointing edge, so drawing a mirrored pair
 * without flipping the ear puts both ears in the middle of the rack, where no
 * rail is.
 */
function drawnSlot(
  slot: "left" | "right",
  face: "front" | "rear",
  mirror: boolean,
): "left" | "right" {
  return face === "rear" && mirror ? (slot === "left" ? "right" : "left") : slot;
}

export function renderElevation(
  rack: RackSpec,
  devices: Map<string, DeviceSpec>,
  face: "front" | "rear",
  opts: ElevationOptions = {},
): string {
  const mirror = opts.mirrorRear !== false;
  const units = rack.case.rackUnits;
  const height = units * U;
  const vbW = RULER_W + W + MARGIN * 2;
  const vbH = height + MARGIN * 2;

  const parts: string[] = [];
  const x0 = MARGIN + RULER_W;

  // Open rail: every U row drawn whether or not something is in it, so the
  // gaps are as legible as the gear.
  for (let u = 1; u <= units; u++) {
    const y = MARGIN + (units - u) * U;
    parts.push(
      `<rect x="${x0}" y="${y}" width="${W}" height="${U}" fill="var(--el-void)" stroke="var(--el-rail)" stroke-width="2"/>`,
    );
    parts.push(
      `<text x="${MARGIN + RULER_W - 28}" y="${y + U * 0.66}" class="el-u" text-anchor="end">${u}</text>`,
    );
  }

  // Bottom-origin: U1 is the bottom row, because that is how load is reasoned
  // about and how a tech counts up the rail with a finger.
  const placed = rack.placements
    .map((p) => ({ p, d: devices.get(p.deviceId) }))
    .filter((x): x is { p: (typeof rack.placements)[number]; d: DeviceSpec } => x.d !== undefined)
    .sort((a, b) => a.p.position - b.p.position);

  for (const { p, d } of placed) {
    const ru = Math.max(1, Math.ceil(d.rackUnits));
    const top = MARGIN + (units - (p.position + ru - 1)) * U;
    const slot = isHalfWidth(d) ? slotsFor(d, p.slot)[0] ?? "left" : null;
    const half = slot ? drawnSlot(slot, face, mirror) : null;
    const hx = half === "right" ? W / 2 : 0;
    parts.push(
      `<g transform="translate(${x0 + hx} ${top})">${drawInner(d, face, ru, { half })}</g>`,
    );
  }

  // Rack ears line, so the drawing reads as a rack and not a stack of boxes.
  parts.push(
    `<rect x="${x0}" y="${MARGIN}" width="${W}" height="${height}" fill="none" stroke="var(--el-rail)" stroke-width="5"/>`,
  );

  return (
    `<svg class="elevation" viewBox="0 0 ${vbW} ${vbH}" preserveAspectRatio="xMidYMin meet" ` +
    `role="img" aria-label="${face === "front" ? "Front" : "Rear"} elevation of ${escapeXml(rack.name)}">` +
    parts.join("") +
    "</svg>"
  );
}

const XML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
};

export function escapeXml(s: unknown): string {
  return String(s).replace(/[&<>"]/g, (c) => XML_ESCAPES[c] ?? c);
}
