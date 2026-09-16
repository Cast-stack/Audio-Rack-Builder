/**
 * Render a patch sheet for one of the demo racks, to a file.
 *
 *   npx tsx scripts/patch-sheet-demo.ts wireless out.pdf
 *
 * Runs with no database: the seed catalog carries its own provenance, which
 * is the point — the sources appendix is exercised on real research output.
 */

import { writeFile } from "node:fs/promises";
import { renderPatchSheet, type SourceRow } from "@/lib/export/patchSheet";
import { htmlToPdf } from "@/lib/export/pdf";
import {
  DEMO_RACK,
  DEMO_RACK_FIXED,
  DEMO_RACK_DOUBLE,
  DEMO_RACK_MONITOR,
  DEMO_RACK_WIRELESS,
  SEED_DEVICES,
} from "@/lib/seed-data";
import type { DeviceSpec, RackSpec } from "@/lib/rack/types";

const RACKS: Record<string, RackSpec> = {
  flypack: DEMO_RACK,
  fixed: DEMO_RACK_FIXED,
  wireless: DEMO_RACK_WIRELESS,
  monitor: DEMO_RACK_MONITOR,
  double: DEMO_RACK_DOUBLE,
};

async function main() {
  const which = process.argv[2] ?? "wireless";
  const out = process.argv[3] ?? `patch-sheet-${which}.pdf`;
  const rack = RACKS[which];
  if (!rack) {
    throw new Error(`Unknown rack "${which}". Try: ${Object.keys(RACKS).join(", ")}`);
  }

  const devices = new Map<string, DeviceSpec>(SEED_DEVICES.map((d) => [d.id, d]));
  const sources = new Map<string, SourceRow[]>(SEED_DEVICES.map((d) => [d.id, d.provenance]));
  const unresolved = new Map<string, string[]>(
    SEED_DEVICES.filter((d) => d.unresolved.length).map((d) => [d.id, d.unresolved]),
  );

  const html = renderPatchSheet({
    rack,
    devices,
    sources,
    unresolved,
    preparedBy: "Audio Rack Builder",
  });
  await writeFile(out.replace(/\.pdf$/, ".html"), html, "utf8");

  const pdf = await htmlToPdf(html, {
    footerLeft: `${rack.name} — ${rack.case.name} — patch sheet`,
  });
  await writeFile(out, pdf);
  console.log(`${out} — ${(pdf.length / 1024).toFixed(0)} KB`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
