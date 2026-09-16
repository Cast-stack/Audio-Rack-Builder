/**
 * Everything the standalone planner page needs, as one browser global.
 *
 * The planner ships as a single HTML file with no server behind it, so the
 * engine, the panel renderer and the patch-sheet renderer are bundled in. That
 * is deliberate rather than convenient: the sheet someone prints from the
 * planner has to come from the same code the server prints from, or the paper
 * and the screen start disagreeing about depth, and the whole product is the
 * claim that they don't.
 *
 * Built by scripts/build-planner.mjs into an IIFE exposing `RACK`.
 * Nothing here may import a Node built-in.
 */

export * from "@/lib/rack/types";
export * from "@/lib/rack/geometry";
export * from "@/lib/rack/budget";
export * from "@/lib/rack/checks";
export { renderPatchSheet } from "@/lib/export/patchSheet";
export { renderElevation } from "@/lib/export/elevation";
export {
  CABLE_SWATCHES,
  SIGNAL_CLASSES,
  SIGNAL_STYLE,
  cableTags,
  resolveCables,
  signalClassOf,
} from "@/lib/rack/cables";
export {
  SEED_DEVICES,
  SEED_CASES,
  DEMO_RACK,
  DEMO_RACK_FIXED,
  DEMO_RACK_WIRELESS,
  DEMO_RACK_MONITOR,
  DEMO_RACK_DOUBLE,
  DEMO_RACKS,
  DEMO_DEVICES,
} from "@/lib/seed-data";

import * as PANEL from "@/lib/rack/panels";
export { PANEL };

/**
 * The browse taxonomy. Pure data with no Node imports, so it bundles like the
 * rest — and the planner's shelves stay the same shelves the research
 * pipeline files gear under, rather than a second list that drifts.
 */
export {
  CATEGORIES,
  FAMILIES,
  FAMILY_BY_CATEGORY,
  categoriesOf,
  familyOf,
} from "@/lib/gear/catalog";
export type { CategoryDef, Family } from "@/lib/gear/catalog";

/**
 * Turning a researched device into one the engine can place. Bundled because
 * the planner is where a requested device lands, and the fields this fills in
 * are assumptions the planner has to be able to show.
 */
export { toProvisionalDevice, isProvisional, slugify } from "@/lib/gear/toDeviceSpec";
export type { ProvisionalDevice } from "@/lib/gear/toDeviceSpec";
export { vetSources, MAX_SOURCES } from "@/lib/gear/sources";

import { renderPatchSheet } from "@/lib/export/patchSheet";
import type { SourceRow } from "@/lib/export/patchSheet";
import { isProvisional } from "@/lib/gear/toDeviceSpec";
import { SEED_DEVICES } from "@/lib/seed-data";
import type { DeviceSpec, RackSpec } from "@/lib/rack/types";

/**
 * Print a patch sheet from the browser.
 *
 * With no server there is nothing to generate a PDF file, so the sheet is
 * written into a hidden same-origin iframe and handed to the browser's own
 * print dialog, where "Save as PDF" produces the same document the export
 * endpoint would. The iframe is torn down after printing rather than left in
 * the page holding a second copy of the rack.
 */
export function printPatchSheet(
  rack: RackSpec,
  devices: Map<string, DeviceSpec>,
  opts: { preparedBy?: string | null } = {},
): void {
  const sources = new Map<string, SourceRow[]>(
    SEED_DEVICES.map((d) => [d.id, d.provenance as SourceRow[]]),
  );
  const unresolved = new Map<string, string[]>(
    SEED_DEVICES.filter((d) => d.unresolved.length).map((d) => [d.id, d.unresolved]),
  );

  /**
   * A device the user had researched on request carries its own evidence, and
   * the printed sheet has to carry it too.
   *
   * The seeded maps above are keyed off SEED_DEVICES, so without this a
   * provisional unit would appear in the elevation and the schedules with an
   * empty sources appendix — the one shape of sheet this product must never
   * print, because it looks exactly like a device nobody had to check.
   */
  for (const device of devices.values()) {
    if (!isProvisional(device)) continue;
    sources.set(device.id, device.provenance as unknown as SourceRow[]);
    unresolved.set(device.id, [
      `NOT REVIEWED. Researched on request from "${device.requestedAs}" on ${device.researchedAt.slice(0, 10)} and not checked by a person.`,
      ...device.unresolved,
    ]);
  }

  const html = renderPatchSheet({
    rack,
    devices,
    sources,
    unresolved,
    preparedBy: opts.preparedBy ?? null,
  });

  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0";
  document.body.appendChild(frame);

  const doc = frame.contentDocument;
  const win = frame.contentWindow;
  if (!doc || !win) {
    frame.remove();
    return;
  }

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    frame.remove();
  };

  doc.open();
  doc.write(html);
  doc.close();

  // Chrome fires afterprint on the frame's window; Safari does not always, so
  // a timer backstops it. Removing the frame mid-print is what loses the job,
  // hence the delay rather than an immediate teardown.
  win.addEventListener("afterprint", () => window.setTimeout(cleanup, 500));
  window.setTimeout(() => {
    win.focus();
    win.print();
    window.setTimeout(cleanup, 60_000);
  }, 120);
}
