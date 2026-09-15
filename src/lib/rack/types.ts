/**
 * Plain types for the feasibility engine.
 *
 * Deliberately independent of Prisma so the engine runs in tests, in a worker,
 * and in the browser for live feedback while someone drags a unit around.
 */

export interface PortSpec {
  label: string;
  connector: string;
  direction: "input" | "output" | "bidirectional";
  signal: string;
  channels: number | null;
  count: number;
  face: "front" | "rear";
  /** Connector + mated plug depth behind the panel, mm. Null = use the table. */
  projectionMm: number | null;
}

/**
 * What a panel element is, as a rack tech would name it.
 *
 * The vocabulary is deliberately small and physical. It exists to express what
 * a manufacturer's own panel callout list describes, and nothing more — if a
 * manual does not name a thing, it does not get drawn.
 */
export type PanelElementKind =
  | "display"      // LCD or OLED window
  | "led"          // single indicator
  | "ledBar"       // segmented level or signal meter
  | "knob"         // rotary control, often with push
  | "button"       // momentary
  | "switch"       // toggle, slide or rocker
  | "powerSwitch"  // mains or standby
  | "window"       // IR port, sensor aperture
  | "bay"          // battery or card bay
  | "vent"         // slots or holes
  | "fan"          // fan cutout
  | "handle"       // rack handle
  | "shelfLip"     // shelf front edge
  | "labelStrip"   // write-on channel strip
  | "jack"         // a connector, drawn from the matching PortSpec
  | "logo";        // brand plate

export interface PanelElement {
  kind: PanelElementKind;
  /** Silkscreen as printed on the panel, or null where the panel carries none. */
  label?: string | null;
  /** Several of the same part treated as one group — a bank of four buttons. */
  count?: number;
  /** How the group runs. Function-button columns stack vertically. */
  stack?: "h" | "v";
  /** Relative width when the renderer shares out the panel face. */
  size?: "sm" | "md" | "lg";
  /**
   * For kind "jack": the PortSpec.label this element stands for, so the real
   * connector glyph is drawn in its true position on the face.
   */
  port?: string | null;
  /**
   * Fields printed inside a display. These are readouts, not parts: six of the
   * Shure ULXS4's twelve front callouts are fields of one LCD, and drawing one
   * box per callout would put six screens on a receiver that has one.
   */
  readouts?: string[];
  /** Callout numbers in the source manual, so a drawing can be audited. */
  callouts?: number[];
}

/** A researched panel layout. Absent means fall back to the category template. */
export interface PanelFace {
  elements: PanelElement[];
}

export interface PanelLayout {
  front?: PanelFace | null;
  rear?: PanelFace | null;
}

export type FormFactor =
  | "full-rack" | "half-rack" | "third-rack" | "quarter-rack" | "desktop" | "accessory";

export interface DeviceSpec {
  id: string;
  slug: string;
  brand: string;
  model: string;
  category: string;
  /**
   * Width class. A half-rack unit still consumes a whole U of height — two of
   * them share that U side by side, which is how a rack of wireless receivers
   * is actually built.
   */
  formFactor: FormFactor;
  /** Categories flagged passive must draw no power. */
  passive: boolean;

  rackUnits: number;
  depthMm: number | null;
  /** Published depth includes front-panel projections (the usual case). */
  depthIsOverall: boolean;
  weightLb: number | null;

  powerTypicalW: number | null;
  powerMaxW: number | null;
  inrushFactor: number;
  poePowered: boolean;

  ports: PortSpec[];

  /**
   * Panel layout read from the manufacturer's own callout list. When present
   * the renderer draws this device's actual panel; when absent it falls back
   * to a generic layout for the category, which looks like the class of gear
   * rather than the unit.
   */
  panel?: PanelLayout | null;
}

export interface CaseSpec {
  slug: string;
  name: string;
  rackUnits: number;
  /** Usable depth between the rails — not the outside dimension. */
  usableDepthMm: number;
  hasRearRails: boolean;
  maxLoadLb: number | null;
  emptyWeightLb: number | null;
}

export interface Circuit {
  label: string;
  volts: number;
  amps: number;
}

/** Which half of the U a unit sits in. Full-width gear takes both. */
export type Slot = "full" | "left" | "right";

export interface PlacementSpec {
  deviceId: string;
  /** 1 = bottom U. Bottom-origin, because that is how weight is reasoned about. */
  position: number;
  /** Omitted means "full" for full-width gear, "left" for half-rack. */
  slot?: Slot;
  circuit: string | null;
  label?: string | null;
}

export interface RackSpec {
  name: string;
  case: CaseSpec;
  circuits: Circuit[];
  placements: PlacementSpec[];
}

export type Severity = "error" | "warning" | "info";

export interface CheckResult {
  /** Stable id so the UI can dedupe, link and suppress. */
  code: string;
  severity: Severity;
  title: string;
  /** One sentence, in the language a rack tech uses. */
  detail: string;
  /** Devices or positions this points at, for highlighting on the canvas. */
  deviceIds?: string[];
  positions?: number[];
  circuit?: string;
}
