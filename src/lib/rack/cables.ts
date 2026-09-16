/**
 * Cable runs, and how they are coloured.
 *
 * A cable joins two ports in the rack, or one port and a named endpoint
 * outside it — the console at FOH, the antenna on a stand, the distro in the
 * wing. Power leads count: a rack that is patched but not powered is not
 * finished, and the lead to the distro is the one people forget to pack.
 */

import { bayOf } from "./geometry";
import type { CableSpec, DeviceSpec, PortSpec, RackSpec, SignalClass } from "./types";

/**
 * The five classes a run is coloured by, in the order the legend prints them.
 * Chosen because they are the five different cables a tech physically reaches
 * for, not because the signals are five different things in theory.
 */
export const SIGNAL_CLASSES: SignalClass[] = [
  "analog audio",
  "digital audio",
  "network",
  "rf",
  "power",
];

export interface SignalStyle {
  /** Categorical hue. See the note on validation below. */
  colour: string;
  /**
   * SVG stroke-dasharray. Colour alone is not enough: the patch sheet is
   * printed, photocopied and faxed, and the copy that matters is often the
   * monochrome one taped inside the lid.
   */
  dash: string | null;
  /** Relative stroke weight. Mains leads are the fattest thing in a rack. */
  weight: number;
  label: string;
}

/**
 * The palette.
 *
 * Every hue here came out of the dataviz skill's validator rather than out of
 * taste. Five free categorical hues is past the point where sets reliably
 * work: of 575,757 five-colour combinations drawn from a 39-colour pool, only
 * 4,342 cleared the checks on white and only 211 of those also cleared them on
 * the dark planner surface. This set is the best of those — worst-case CVD
 * separation 9.7 (above the skill's target of 8) and a normal-vision floor of
 * 19.1, passing on both surfaces.
 *
 * The assignment to classes then follows what the colours already mean on a
 * stage: red is mains, blue is Cat5, amber is the antenna marking on a distro.
 * Guessing the right cable from the drawing should not require the legend.
 */
export const SIGNAL_STYLE: Record<SignalClass, SignalStyle> = {
  "analog audio": { colour: "#0D9488", dash: null, weight: 1, label: "Analog audio" },
  "digital audio": { colour: "#A21CAF", dash: "26 14", weight: 1, label: "Digital audio" },
  network: { colour: "#2563EB", dash: "6 12", weight: 1, label: "Network" },
  rf: { colour: "#D97706", dash: "32 12 6 12", weight: 1, label: "RF / antenna" },
  power: { colour: "#BE123C", dash: "46 18", weight: 1.35, label: "Power" },
};

/**
 * Swatches for a run whose colour is set by hand, for a shop that sleeves or
 * tapes to its own scheme. Drawn from the same validated pool, so a hand-picked
 * colour is still a colour that survives a photocopy.
 */
export const CABLE_SWATCHES: string[] = [
  "#BE123C", "#D97706", "#CA8A04", "#4D7C0F", "#0D9488",
  "#2563EB", "#6D28D9", "#A21CAF", "#BE185D", "#57534E",
];

/** What a port carries, reduced to the five classes cables are coloured by. */
export function signalClassOf(port: PortSpec): SignalClass {
  const s = port.signal.toLowerCase();
  if (s.includes("power")) return "power";
  if (s.includes("antenna") || s.includes("rf")) return "rf";
  if (s.includes("network") || s.includes("data")) return "network";
  if (s.includes("digital")) return "digital audio";
  if (s.includes("analog")) return "analog audio";
  // Anything unrecognised is treated as analog audio rather than given a sixth
  // colour: an unknown run still has to be drawn, and a class nobody can name
  // helps nobody.
  return "analog audio";
}

/** An end of a run, resolved against the rack. */
export interface ResolvedEnd {
  kind: "port" | "external";
  /** Set for an in-rack end. */
  device?: DeviceSpec;
  port?: PortSpec;
  position?: number;
  slot?: "full" | "left" | "right";
  bay?: number;
  /** Which connector of a multi-connector port, zero-based. */
  index: number;
  /** Display text: "Shure AD600 · A" or "FOH console".  */
  label: string;
}

export interface ResolvedCable {
  cable: CableSpec;
  /** Never null: resolveCables drops any run whose ends no longer exist. */
  from: ResolvedEnd;
  to: ResolvedEnd;
  signal: SignalClass;
  style: SignalStyle;
  /** The hand-set colour if there is one, otherwise the class colour. */
  colour: string;
}

function resolveEnd(
  end: CableSpec["from"],
  rack: RackSpec,
  devices: Map<string, DeviceSpec>,
): ResolvedEnd | null {
  if (end.kind === "external") {
    return { kind: "external", index: 0, label: end.name };
  }
  const wantSlot = end.slot ?? "full";
  const wantBay = bayOf(end);
  const placement =
    rack.placements.find(
      (p) => p.deviceId === end.deviceId && p.position === end.position &&
        (p.slot ?? "full") === wantSlot && bayOf(p) === wantBay,
    ) ??
    // A run recorded before slots and bays were required still resolves, as
    // long as the position holds only one unit of that model.
    rack.placements.find((p) => p.deviceId === end.deviceId && p.position === end.position);
  const device = devices.get(end.deviceId);
  if (!placement || !device) return null;
  const port = device.ports.find((p) => p.label === end.port);
  if (!port) return null;
  return {
    kind: "port",
    device,
    port,
    position: placement.position,
    slot: placement.slot ?? "full",
    bay: bayOf(placement),
    index: end.index ?? 0,
    label: `${device.brand} ${device.model} · ${port.label}`,
  };
}

/**
 * Resolve every run against the rack, dropping any whose ends no longer exist —
 * a device removed from the rack takes its patch with it rather than leaving a
 * line to nowhere on the drawing.
 */
export function resolveCables(
  rack: RackSpec,
  devices: Map<string, DeviceSpec>,
): ResolvedCable[] {
  const out: ResolvedCable[] = [];
  for (const cable of rack.cables ?? []) {
    const from = resolveEnd(cable.from, rack, devices);
    const to = resolveEnd(cable.to, rack, devices);
    if (!from || !to) continue;
    const port = from.port ?? to.port;
    const signal = cable.signal ?? (port ? signalClassOf(port) : "analog audio");
    const style = SIGNAL_STYLE[signal];
    out.push({ cable, from, to, signal, style, colour: cable.colour ?? style.colour });
  }
  return out;
}

/** A stable key for one physical connector, for "is this already patched". */
export function endKey(end: CableSpec["from"]): string {
  if (end.kind === "external") return `ext|${end.name}`;
  return anchorKey(
    end.deviceId,
    bayOf(end),
    end.position,
    end.slot ?? "full",
    end.port,
    end.index ?? 0,
  );
}

/**
 * One key shape for a physical connector, used by the patch, the drawing and
 * the planner alike. Bay comes before position: without it, the same model in
 * the same U of two different bays is one connector as far as the patch is
 * concerned.
 */
export function anchorKey(
  deviceId: string,
  bay: number,
  position: number,
  slot: string,
  port: string,
  index: number,
): string {
  return `${deviceId}|${bay}|${position}|${slot}|${port}|${index}`;
}

const CLASS_TAG: Record<SignalClass, string> = {
  "analog audio": "AUD",
  "digital audio": "DIG",
  network: "NET",
  rf: "RF",
  power: "PWR",
};

/**
 * The marking on the tape, for every run in a rack.
 *
 * Computed once and shared by the drawing and the schedule. They have to agree
 * character for character: a tag on the elevation that is not in the table is
 * how someone ends up chasing a cable that does not exist on paper.
 */
export function cableTags(runs: ResolvedCable[]): Map<string, string> {
  const perClass = new Map<SignalClass, number>();
  const tags = new Map<string, string>();
  for (const run of runs) {
    const written = run.cable.label?.trim();
    if (written) {
      tags.set(run.cable.id, written);
      continue;
    }
    const n = (perClass.get(run.signal) ?? 0) + 1;
    perClass.set(run.signal, n);
    tags.set(run.cable.id, `${CLASS_TAG[run.signal]} ${n}`);
  }
  return tags;
}

/** The same tag, clipped to what fits on a wrap of tape in the drawing. */
export function shortTag(tag: string): string {
  return tag.length > 7 ? tag.slice(0, 6) + "\u2026" : tag;
}
