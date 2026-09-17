/**
 * Turning a researched record into something the engine can place in a rack.
 *
 * These are two different shapes for good reasons. `Device` in schema.ts is
 * what a researcher can establish from a document: brand, model, dimensions,
 * a port list, a price. `DeviceSpec` in rack/types.ts is what the feasibility
 * engine needs to do arithmetic: an id to key placements by, whether the
 * category is passive, an inrush factor, and whether the printed depth was
 * overall or behind the rails.
 *
 * The gap between them is exactly the set of things no manufacturer prints,
 * and every one of them is filled here in the open rather than guessed at
 * three call sites:
 *
 *   - `passive` comes from the category, which is where the rule already lives.
 *   - `depthIsOverall` is true, always. Manufacturers publish overall depth
 *     and almost never publish depth behind the rails; assuming otherwise
 *     would make every researched device shallower than it is, which is the
 *     one direction of error that strands a build.
 *   - `inrushFactor` is the house default. It is not a researched figure and
 *     is reported as unresolved so the sheet says so.
 *   - `panel` is null. Panel layouts come from a manufacturer's numbered
 *     callout list, which the researcher does not collect.
 */

import type { DeviceSpec, FormFactor, PortSpec } from "@/lib/rack/types";
import { PASSIVE_CATEGORY_NAMES } from "./catalog";
import type { Device, Provenance } from "./schema";

/** House assumption for gear with no published inrush figure. */
export const DEFAULT_INRUSH = 1.5;
/** Passive gear does not surge, because it does not draw. */
export const PASSIVE_INRUSH = 1;

/**
 * A device the catalog has not vetted, carried with its evidence.
 *
 * It travels with everything needed to render it honestly — where each figure
 * came from, what could not be established, and the fact that no person has
 * looked at it. The planner keeps these in the browser; nothing here has been
 * published to anybody.
 */
export interface ProvisionalDevice extends CatalogDevice {
  provisional: true;
  /** What the user typed to ask for it. */
  requestedAs: string;
  /** ISO timestamp of the research run. */
  researchedAt: string;
  notes: string | null;
}

/** Lowercase, hyphenated, safe as an id fragment. */
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export interface ToDeviceSpecOptions {
  requestedAs: string;
  provenance?: Provenance[];
  unresolved?: string[];
  notes?: string | null;
  researchedAt?: string;
  /** Ids already in use, so a second request for the same box does not collide. */
  taken?: Iterable<string>;
}

/**
 * A researched device in the shape the catalog stores: what the engine needs,
 * plus the evidence that has to travel with it onto the printed sheet.
 */
export interface CatalogDevice extends DeviceSpec {
  description: string;
  status: Device["status"];
  statusNote: string | null;
  productUrl: string | null;
  datasheetUrl: string | null;
  provenance: Provenance[];
  unresolved: string[];
}

/**
 * The shared half of both conversions. Everything a researcher cannot read is
 * filled here and nowhere else, so the catalog backfill and a one-off request
 * cannot drift into different assumptions about the same box.
 */
function buildDevice(
  device: Device,
  id: string,
  provenance: Provenance[],
  unresolvedIn: string[],
): CatalogDevice {
  const passive = PASSIVE_CATEGORY_NAMES.has(device.category);

  const ports: PortSpec[] = device.ports.map((p) => ({
    label: p.label,
    connector: p.connector,
    direction: p.direction,
    signal: p.signal,
    channels: p.channels,
    count: p.count,
    face: p.face,
    // Never researched. Null means "use the connector table", which is the
    // same treatment every seeded device gets.
    projectionMm: null,
  }));

  const unresolved = [...unresolvedIn];
  if (!passive) {
    unresolved.push("inrushFactor is the house default, not a researched figure.");
  }
  unresolved.push(
    "panel — no layout was researched, so this is drawn from the category template.",
  );
  if (device.depthMm != null) {
    unresolved.push(
      "depth behind rails — treated as overall depth, which is what manufacturers print.",
    );
  }

  return {
    id,
    slug: slugify(`${device.brand}-${device.model}`) || id,
    brand: device.brand,
    model: device.model,
    category: device.category,
    formFactor: device.formFactor as FormFactor,
    passive,
    rackUnits: device.rackUnits,
    depthMm: device.depthMm,
    depthIsOverall: true,
    weightLb: device.weightLb,
    powerTypicalW: device.powerTypicalW,
    powerMaxW: device.powerMaxW,
    inrushFactor: passive ? PASSIVE_INRUSH : DEFAULT_INRUSH,
    poePowered: device.poePowered,
    ports,
    panel: null,
    description: device.description,
    status: device.status,
    statusNote: device.statusNote,
    productUrl: device.productUrl,
    datasheetUrl: device.datasheetUrl,
    provenance,
    unresolved,
  };
}

/** The catalog id for a device: brand and model, and nothing that can change. */
export function catalogId(device: Pick<Device, "brand" | "model">): string {
  return slugify(`${device.brand} ${device.model}`) || "device";
}

/**
 * A verified research record, as it enters the shared catalog.
 *
 * Only for records that have been through scripts/check-research.ts and a
 * person's review. That review is the promotion step: this function does not
 * make a record trustworthy, it only makes it placeable.
 */
export function toCatalogDevice(
  record: { device: Device; provenance: Provenance[]; unresolved: string[] },
): CatalogDevice {
  return buildDevice(record.device, catalogId(record.device), record.provenance, record.unresolved);
}

export function toProvisionalDevice(
  device: Device,
  opts: ToDeviceSpecOptions,
): ProvisionalDevice {
  const base = `prov-${catalogId(device)}`;
  const taken = new Set(opts.taken ?? []);
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;

  return {
    ...buildDevice(device, id, opts.provenance ?? [], opts.unresolved ?? []),
    provisional: true,
    requestedAs: opts.requestedAs,
    researchedAt: opts.researchedAt ?? new Date().toISOString(),
    notes: opts.notes ?? null,
  };
}

/** Narrow an arbitrary device to one of these, for code that has both. */
export function isProvisional(d: unknown): d is ProvisionalDevice {
  return !!d && typeof d === "object" && (d as { provisional?: unknown }).provisional === true;
}
