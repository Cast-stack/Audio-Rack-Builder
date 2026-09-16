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
  /**
   * Columns of 19-inch rails in this case, side by side. One physical
   * assembly either way: a two-bay shock case has one load rating, one centre
   * of gravity and one set of casters, so it is planned and wheeled as one
   * thing even though gear sits in two columns.
   */
  bays?: number;
  /** Rack units in EACH bay, not across the case. */
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
  /** Which column of rails, 1-based. Omitted means the first bay. */
  bay?: number;
  /** 1 = bottom U. Bottom-origin, because that is how weight is reasoned about. */
  position: number;
  /** Omitted means "full" for full-width gear, "left" for half-rack. */
  slot?: Slot;
  circuit: string | null;
  label?: string | null;
}

/** The five classes a cable run is coloured by. */
export type SignalClass = "analog audio" | "digital audio" | "network" | "rf" | "power";

/**
 * One end of a run. Either a connector on a device in this rack, or somewhere
 * outside it that the person names — "FOH console", "SL antenna", "house
 * distro". The outside ends matter as much as the inside ones: they are the
 * tails that have to be packed, and the reason a rack arrives and does not
 * work.
 */
export type CableEnd =
  | {
      kind: "port";
      deviceId: string;
      /** Which column of rails, 1-based. Omitted means the first bay. */
      bay?: number;
      /** Which placement, since the same model can appear twice in a rack. */
      position: number;
      /**
       * Which half of the U. Required to identify a placement: a pair of
       * identical half-rack units share a position, so deviceId and position
       * together do not name one of them.
       */
      slot?: Slot;
      /** PortSpec.label. */
      port: string;
      /** Which connector of a multi-connector port, zero-based. */
      index?: number;
    }
  | { kind: "external"; name: string };

export interface CableSpec {
  id: string;
  from: CableEnd;
  to: CableEnd;
  /** Overrides the class derived from the port, when the two ends disagree. */
  signal?: SignalClass;
  /** A hand-set colour, for a shop that sleeves or tapes to its own scheme. */
  colour?: string | null;
  /** What is written on the tape at each end. */
  label?: string | null;
  /** Measured or specified length, metres. Left null to fill in on paper. */
  lengthM?: number | null;
  note?: string | null;
}

export interface RackSpec {
  name: string;
  case: CaseSpec;
  circuits: Circuit[];
  placements: PlacementSpec[];
  /** Patch. Absent on a rack nobody has wired yet. */
  cables?: CableSpec[];
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
