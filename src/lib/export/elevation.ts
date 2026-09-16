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

import { drawInner, U, W, type PortAnchor } from "@/lib/rack/panels";
import {
  anchorKey,
  cableTags,
  resolveCables,
  shortTag,
  type ResolvedCable,
  type ResolvedEnd,
} from "@/lib/rack/cables";
import { bayCount, bayOf, isHalfWidth, slotsFor } from "@/lib/rack/geometry";
import type { DeviceSpec, RackSpec } from "@/lib/rack/types";

/** Left gutter carrying the U numbers, in panel units. */
const RULER_W = 150;
/** Air between two columns of rails, where the uprights of the frame sit. */
const BAY_GAP = 120;
/** Air around the drawing so the rails are not against the page edge. */
const MARGIN = 40;

/**
 * Room to the right of the rack for runs that leave it.
 *
 * Each tail is tagged, not captioned. A shop drawing puts a short tag on the
 * cable and keeps the destination in the schedule; writing "Monitor console —
 * mix 1 L" on the drawing needs four times this width and makes the rack
 * itself small enough to be useless.
 */
const TAIL_W = 300;

export interface ElevationOptions {
  /**
   * Draw the patch. Runs are drawn on the rear by default because that is
   * where the connectors are; a front elevation with cables over the controls
   * is a worse drawing, not a more complete one.
   */
  cables?: boolean;
  /**
   * Reserve the tail margin without drawing anything in it, so a front and a
   * rear elevation printed side by side come out at the same scale.
   */
  tailRoom?: boolean;
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
  const bays = bayCount(rack.case);
  const withCables = opts.cables === true;
  const tail = withCables || opts.tailRoom === true ? TAIL_W : 0;
  const bayPitch = W + BAY_GAP;
  const allBaysW = W * bays + BAY_GAP * (bays - 1);
  const vbW = RULER_W + allBaysW + tail + MARGIN * 2;
  const vbH = height + MARGIN * 2 + (bays > 1 ? 54 : 0);

  const parts: string[] = [];
  const x0 = MARGIN + RULER_W;
  /** Left edge of a bay. Bays run left to right as you face the case. */
  const bayX = (b: number) => x0 + (b - 1) * bayPitch;

  // Open rail: every U row drawn whether or not something is in it, so the
  // gaps are as legible as the gear.
  for (let u = 1; u <= units; u++) {
    const y = MARGIN + (units - u) * U;
    for (let b = 1; b <= bays; b++) {
      parts.push(
        `<rect x="${bayX(b)}" y="${y}" width="${W}" height="${U}" fill="var(--el-void)" stroke="var(--el-rail)" stroke-width="2"/>`,
      );
    }
    parts.push(
      `<text x="${MARGIN + RULER_W - 28}" y="${y + U * 0.66}" class="el-u" text-anchor="end">${u}</text>`,
    );
  }

  /**
   * Which bay is drawn in which column, for this face.
   *
   * A rear elevation mirrors the bays as it mirrors the halves: standing
   * behind a two-bay case, bay 1 is on your right. The labels have to travel
   * with the gear — a column of bay 2 under a label saying BAY 1 is worse than
   * no label at all.
   */
  const columnFor = (bay: number) => (face === "rear" && mirror ? bays - bay + 1 : bay);

  // Bays are only named when there is more than one; a single-bay case should
  // not carry a label for a distinction it does not have.
  if (bays > 1) {
    for (let b = 1; b <= bays; b++) {
      parts.push(
        `<text x="${bayX(columnFor(b)) + W / 2}" y="${MARGIN + height + 42}" class="el-bay" text-anchor="middle">BAY ${b}</text>`,
      );
    }
  }

  // Bottom-origin: U1 is the bottom row, because that is how load is reasoned
  // about and how a tech counts up the rail with a finger.
  const anchorIndex = new Map<string, { x: number; y: number; size: number }>();

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
    const bx = bayX(Math.min(Math.max(columnFor(bayOf(p)), 1), bays));
    const anchors: PortAnchor[] = [];
    parts.push(
      `<g transform="translate(${bx + hx} ${top})">${drawInner(d, face, ru, { half, anchors })}</g>`,
    );
    // Panel-local anchors become elevation coordinates once, here, where the
    // offset is known.
    for (const a of anchors) {
      anchorIndex.set(
        anchorKey(p.deviceId, bayOf(p), p.position, p.slot ?? "full", a.portLabel, a.index),
        { x: bx + hx + a.x, y: top + a.y, size: a.size },
      );
    }
  }

  // Rack ears line, so the drawing reads as a rack and not a stack of boxes.
  for (let b = 1; b <= bays; b++) {
    parts.push(
      `<rect x="${bayX(b)}" y="${MARGIN}" width="${W}" height="${height}" fill="none" stroke="var(--el-rail)" stroke-width="5"/>`,
    );
  }
  // The case around them, so two bays read as one thing to wheel.
  if (bays > 1) {
    parts.push(
      `<rect x="${x0 - 18}" y="${MARGIN - 18}" width="${allBaysW + 36}" height="${height + 36}" rx="10" fill="none" stroke="var(--el-rail)" stroke-width="3" opacity=".55"/>`,
    );
  }

  if (withCables) {
    parts.push(
      drawCables(rack, devices, anchorIndex, {
        top: MARGIN,
        height,
        tailX: x0 + allBaysW + 90,
      }),
    );
  }

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

// ------------------------------------------------------------------ cables

type AnchorMap = Map<string, { x: number; y: number; size: number }>;

function anchorFor(end: ResolvedEnd, index: AnchorMap) {
  if (end.kind !== "port" || !end.device || !end.port) return null;
  return (
    index.get(
      anchorKey(
        end.device.id,
        end.bay ?? 1,
        end.position ?? 0,
        end.slot ?? "full",
        end.port.label,
        end.index,
      ),
    ) ?? null
  );
}

/**
 * One run, drawn as a curve between the two connectors it actually joins.
 *
 * A curve rather than a routed right-angle path, because that is what a cable
 * does: it leaves the connector, sags, and comes back. Right-angle routing
 * reads as a schematic and invites someone to believe the drawing says where
 * the cable physically lies, which it does not.
 */
function cablePath(
  a: { x: number; y: number },
  b: { x: number; y: number },
  bow: number,
  floor: number,
): string {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const span = Math.hypot(dx, dy);
  // Sag below both ends, deeper for a longer run, the way a loomed cable does.
  // Clamped to the bottom rail: a run between two units in U1 would otherwise
  // hang off the drawing, which reads as a mistake rather than as slack.
  const room = Math.max(0, floor - Math.max(a.y, b.y));
  const sag = Math.min(240, 60 + span * 0.18, room * 0.9) * bow;
  const c1 = { x: a.x + dx * 0.25, y: a.y + dy * 0.15 + sag };
  const c2 = { x: a.x + dx * 0.75, y: b.y - dy * 0.15 + sag };
  return `M${a.x} ${a.y}C${c1.x} ${c1.y} ${c2.x} ${c2.y} ${b.x} ${b.y}`;
}

function drawCables(
  rack: RackSpec,
  devices: Map<string, DeviceSpec>,
  index: AnchorMap,
  box: { top: number; height: number; tailX: number },
): string {
  const runs = resolveCables(rack, devices);
  if (!runs.length) return "";

  const leaving = runs.filter(
    (r) => !(anchorFor(r.from, index) && anchorFor(r.to, index)),
  ).length;

  const tags = cableTags(runs);
  const out: string[] = [];
  let tailRow = 0;

  runs.forEach((run: ResolvedCable, i: number) => {
    const aAnchor = anchorFor(run.from, index);
    const bAnchor = anchorFor(run.to, index);
    const stroke = run.colour;
    const dash = run.style.dash ? ` stroke-dasharray="${run.style.dash}"` : "";
    const width = 7 * run.style.weight;

    if (aAnchor && bAnchor) {
      // Alternate the bow so parallel runs between neighbouring units do not
      // lie on top of each other.
      const bow = 0.7 + ((i % 3) * 0.25);
      const d = cablePath(aAnchor, bAnchor, bow, box.top + box.height - 12);
      out.push(
        `<path d="${d}" fill="none" stroke="var(--el-void)" stroke-width="${width + 6}" stroke-linecap="round" opacity=".9"/>` +
          `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${width}"${dash} stroke-linecap="round"/>`,
      );
      return;
    }

    // One end is outside the rack: run to the right margin and label the tail.
    const inside = aAnchor ?? bAnchor;
    if (!inside) return;
    const outside = aAnchor ? run.to : run.from;
    // Tails are spread evenly down the right-hand margin rather than stacked
    // from the top, so a rack with two of them does not put both in the roof.
    const ty = box.top + (box.height * (tailRow + 0.5)) / Math.max(1, leaving);
    tailRow += 1;
    const d =
      `M${inside.x} ${inside.y}C${inside.x + 220} ${inside.y + 40} ${box.tailX - 220} ${ty} ${box.tailX} ${ty}`;
    const tag = shortTag(tags.get(run.cable.id) ?? "");
    out.push(
      `<path d="${d}" fill="none" stroke="var(--el-void)" stroke-width="${width + 6}" stroke-linecap="round" opacity=".9"/>` +
        `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${width}"${dash} stroke-linecap="round"/>` +
        `<rect x="${box.tailX}" y="${ty - 30}" width="${Math.max(96, tag.length * 30 + 26)}" height="60" rx="8" fill="var(--el-void)" stroke="${stroke}" stroke-width="4"/>` +
        `<text x="${box.tailX + 14}" y="${ty + 15}" class="el-tail">${escapeXml(tag)}</text>`,
    );
    void outside;
  });

  return out.join("");
}
