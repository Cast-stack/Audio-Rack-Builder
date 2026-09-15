/**
 * Rack geometry and the depth question nobody else answers.
 *
 * Every rack planner stores one depth number per device and compares it to one
 * depth number per case. That comparison is wrong often enough to matter,
 * because the number manufacturers print is the chassis, and the thing that has
 * to fit is the chassis plus whatever is hanging off the back of it plus enough
 * room to bend the cable. A 286 mm Shure AD600 does not go in a 300 mm case:
 * six BNCs with right-angle-averse coax and a locking IEC need another 100 mm.
 */

import type { CaseSpec, DeviceSpec, PortSpec, Slot } from "./types";

/** EIA-310: one rack unit is 1.75 in. */
export const MM_PER_RU = 44.45;
/** Rail-to-rail mounting width. */
export const RACK_WIDTH_MM = 482.6;

export const MM_PER_IN = 25.4;
export const LB_PER_KG = 2.20462;

/**
 * How far a mated connector sits behind the panel, millimetres. Measured from
 * the panel face to the back of the plug body, excluding the cable.
 *
 * These are conservative working numbers for planning, not datasheet values —
 * a device's own `projectionMm` overrides them whenever it is known.
 */
export const CONNECTOR_PROJECTION_MM: Record<string, number> = {
  "XLR3": 55,
  "XLR4": 55,
  "XLR5": 58,
  "XLR/TRS combo": 55,
  "TRS": 45,
  "TS": 45,
  "RCA": 35,
  "DB25": 70,
  "DB25 (Tascam)": 70,
  "EDAC": 85,
  "Speakon": 60,
  "BNC": 45,
  "TNC": 45,
  "SMA": 35,
  "RJ45": 50,
  "Dante RJ45": 50,
  "AES50 RJ45": 50,
  "etherCON": 65,
  "SFP": 60,
  "USB-A": 45,
  "USB-B": 45,
  "USB-C": 35,
  "Thunderbolt": 35,
  "HDMI": 50,
  "MIDI DIN": 50,
  "IEC C14": 45,
  "IEC C20": 50,
  "powerCON": 65,
  "powerCON TRUE1": 70,
  "Edison": 50,
  "Terminal block": 30,
  "Other": 50,
};

/**
 * Minimum bend allowance behind the connector, millimetres — the room a cable
 * needs to turn without being kinked. Driven by the stiffest cable on the unit,
 * so one DB25 loom sets the number for the whole device.
 */
export const BEND_ALLOWANCE_MM: Record<string, number> = {
  stiff: 90, // DB25 looms, multipair, heavy coax bundles
  medium: 60, // XLR, etherCON, powerCON, IEC
  light: 35, // Cat5e patch, USB, thin coax
  none: 0,
};

const STIFF = new Set(["DB25", "DB25 (Tascam)", "EDAC", "Speakon", "IEC C20", "powerCON TRUE1"]);
const LIGHT = new Set(["USB-A", "USB-B", "USB-C", "Thunderbolt", "SMA", "RCA", "Terminal block"]);

export function portProjectionMm(port: PortSpec): number {
  if (port.projectionMm != null) return port.projectionMm;
  return CONNECTOR_PROJECTION_MM[port.connector] ?? CONNECTOR_PROJECTION_MM["Other"]!;
}

export function bendAllowanceFor(ports: PortSpec[]): number {
  const rear = ports.filter((p) => p.face === "rear");
  if (rear.length === 0) return BEND_ALLOWANCE_MM["none"]!;
  if (rear.some((p) => STIFF.has(p.connector))) return BEND_ALLOWANCE_MM["stiff"]!;
  if (rear.every((p) => LIGHT.has(p.connector))) return BEND_ALLOWANCE_MM["light"]!;
  return BEND_ALLOWANCE_MM["medium"]!;
}

export interface DepthBreakdown {
  /** What the manufacturer publishes. */
  chassisMm: number | null;
  /** Deepest rear connector plus its plug. */
  connectorMm: number;
  /** Room for the cable to turn. */
  bendMm: number;
  /** What the case actually has to give it. */
  requiredMm: number | null;
  /** Which connector set the connector figure, for the UI to name. */
  drivenBy: string | null;
}

/**
 * Total depth a device needs behind the front rails.
 *
 * When the published figure is an overall dimension it includes front-panel
 * knobs and handles, which live in front of the rails and do not consume case
 * depth. We do not subtract for them: the amount is unknown and guessing low
 * is the failure that strands a build on site. Erring deep costs nothing but a
 * slightly larger case.
 */
export function requiredDepth(device: DeviceSpec): DepthBreakdown {
  const rear = device.ports.filter((p) => p.face === "rear");
  let connectorMm = 0;
  let drivenBy: string | null = null;
  for (const p of rear) {
    const mm = portProjectionMm(p);
    if (mm > connectorMm) {
      connectorMm = mm;
      drivenBy = p.connector;
    }
  }
  const bendMm = bendAllowanceFor(device.ports);
  const requiredMm =
    device.depthMm == null ? null : Math.round(device.depthMm + connectorMm + bendMm);
  return { chassisMm: device.depthMm, connectorMm, bendMm, requiredMm, drivenBy };
}

/**
 * Half-rack gear shares a U. Third- and quarter-rack chassis are rare enough
 * that the planner treats them as half-width too — conservative, and it stops
 * the layout claiming three will fit where the mounting kit only takes two.
 */
export function isHalfWidth(device: DeviceSpec): boolean {
  return device.formFactor === "half-rack" ||
    device.formFactor === "third-rack" ||
    device.formFactor === "quarter-rack";
}

/** The half (or halves) a placement covers. */
export function slotsFor(device: DeviceSpec, slot: Slot | undefined): ("left" | "right")[] {
  if (!isHalfWidth(device)) return ["left", "right"];
  const chosen = slot === "right" ? "right" : "left";
  return [chosen];
}

/** Every (U, half) cell a placement occupies, as stable keys. */
export function occupiedCells(
  device: DeviceSpec,
  position: number,
  slot: Slot | undefined,
): string[] {
  const halves = slotsFor(device, slot);
  const cells: string[] = [];
  for (const u of occupiedPositions(device, position)) {
    for (const half of halves) cells.push(`${u}|${half}`);
  }
  return cells;
}

/** Rack units a device occupies, rounded up to a whole U for placement. */
export function occupiedUnits(device: DeviceSpec): number {
  return Math.max(1, Math.ceil(device.rackUnits));
}

/** The U positions a device covers, given a bottom-origin start position. */
export function occupiedPositions(device: DeviceSpec, position: number): number[] {
  const n = occupiedUnits(device);
  return Array.from({ length: n }, (_, i) => position + i);
}

export function caseDepthHeadroom(
  device: DeviceSpec,
  rackCase: CaseSpec,
): { fits: boolean; headroomMm: number | null; breakdown: DepthBreakdown } {
  const breakdown = requiredDepth(device);
  if (breakdown.requiredMm == null) {
    return { fits: true, headroomMm: null, breakdown };
  }
  const headroomMm = rackCase.usableDepthMm - breakdown.requiredMm;
  return { fits: headroomMm >= 0, headroomMm, breakdown };
}

export const inToMm = (v: number) => Math.round(v * MM_PER_IN);
export const kgToLb = (v: number) => Math.round(v * LB_PER_KG * 10) / 10;
export const ruToMm = (ru: number) => Math.round(ru * MM_PER_RU);
