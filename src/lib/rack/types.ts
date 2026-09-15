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

export interface DeviceSpec {
  id: string;
  slug: string;
  brand: string;
  model: string;
  category: string;
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

export interface PlacementSpec {
  deviceId: string;
  /** 1 = bottom U. Bottom-origin, because that is how weight is reasoned about. */
  position: number;
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
