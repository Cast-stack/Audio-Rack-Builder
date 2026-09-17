/**
 * Check a file of researched device records before it goes near the catalog.
 *
 *   npx tsx scripts/check-research.ts <records.json> [--extra-hosts a.com,b.com]
 *
 * The file is a JSON array of ResearchResult records — the same shape
 * researchDevice() emits. Every record must pass all of:
 *
 *   - ResearchResultSchema, the schema the live pipeline validates against;
 *   - a category from the taxonomy;
 *   - triage() without a reject, which is where "no source cited" and
 *     "implausibly shallow" live;
 *   - every citation on a manufacturer's own domain. A dealer page or another
 *     planner's catalog is a lead, never a source — see CLAUDE.md, and the
 *     Gator part number one of those catalogs invented;
 *   - no brand + model already in the catalog or earlier in the file.
 *
 * --extra-hosts admits a manufacturer domain that is not on the allowlist yet.
 * It exists so a researcher can finish; anything passed through it has to be
 * added to MANUFACTURER_DOMAINS before the records are imported, and the
 * import test enforces that.
 *
 * Exits 1 if anything fails, so it can gate a merge.
 */

import { readFile } from "node:fs/promises";

import { CATEGORY_NAMES } from "../src/lib/gear/catalog";
import { ResearchResultSchema } from "../src/lib/gear/schema";
import { isManufacturerHost } from "../src/lib/gear/sources";
import { triage } from "../src/lib/gear/validate";
import { SEED_DEVICES } from "../src/lib/seed-data";

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--") && args[args.indexOf(a) - 1] !== "--extra-hosts");
if (!file) {
  console.error("usage: npx tsx scripts/check-research.ts <records.json> [--extra-hosts a.com,b.com]");
  process.exit(2);
}
const extraIdx = args.indexOf("--extra-hosts");
const extra = extraIdx >= 0 ? (args[extraIdx + 1] ?? "").split(",").map((h) => h.trim().toLowerCase()).filter(Boolean) : [];

const hostOk = (url: string): string | null => {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return `not a URL: ${url}`;
  }
  if (isManufacturerHost(host)) return null;
  if (extra.some((d) => host === d || host.endsWith(`.${d}`))) return null;
  return `${host} is not a manufacturer domain`;
};

const key = (brand: string, model: string) =>
  `${brand} ${model}`.toLowerCase().replace(/[^a-z0-9]+/g, "");

async function main(): Promise<void> {
  const raw = JSON.parse(await readFile(file as string, "utf8"));
  if (!Array.isArray(raw)) {
    console.error("expected a JSON array of records");
    process.exit(2);
  }

  const taken = new Map(SEED_DEVICES.map((d) => [key(d.brand, d.model), d.id]));
  let failed = 0;
  let reviews = 0;

  for (const [i, rec] of raw.entries()) {
    const label = `#${i} ${rec?.device?.brand ?? "?"} ${rec?.device?.model ?? "?"}`;
    const problems: string[] = [];
    const notes: string[] = [];

    const parsed = ResearchResultSchema.safeParse(rec);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        problems.push(`schema ${issue.path.join(".") || "(root)"}: ${issue.message}`);
      }
      console.log(`FAIL ${label}\n  - ${problems.join("\n  - ")}`);
      failed++;
      continue;
    }
    const r = parsed.data;

    if (!CATEGORY_NAMES.includes(r.device.category)) {
      problems.push(`category "${r.device.category}" is not in the taxonomy`);
    }

    const { disposition, issues } = triage(r);
    for (const issue of issues) {
      (issue.severity === "error" ? problems : notes).push(`${issue.field}: ${issue.message}`);
    }
    if (disposition === "review") reviews++;

    for (const p of r.provenance) {
      const bad = hostOk(p.sourceUrl);
      if (bad) problems.push(`provenance ${p.field}: ${bad}`);
    }
    for (const [field, url] of [["productUrl", r.device.productUrl], ["datasheetUrl", r.device.datasheetUrl]] as const) {
      if (url) {
        const bad = hostOk(url);
        if (bad) problems.push(`${field}: ${bad}`);
      }
    }

    const k = key(r.device.brand, r.device.model);
    if (taken.has(k)) problems.push(`duplicate of ${taken.get(k)}`);
    else taken.set(k, `record #${i}`);

    if (problems.length) {
      failed++;
      console.log(`FAIL ${label} (${disposition})\n  - ${problems.join("\n  - ")}`);
    } else {
      console.log(`ok   ${label} (${disposition})${notes.length ? `\n  · ${notes.join("\n  · ")}` : ""}`);
    }
  }

  console.log(`\n${raw.length} records: ${raw.length - failed} pass (${reviews} with open questions), ${failed} fail`);
  if (extra.length) console.log(`extra hosts admitted: ${extra.join(", ")} — add them to MANUFACTURER_DOMAINS before import`);
  process.exit(failed ? 1 : 0);
}

void main();
