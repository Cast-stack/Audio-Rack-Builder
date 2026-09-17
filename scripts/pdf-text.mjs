/**
 * Print the text of a PDF, page by page. Downloads it first if given a URL.
 *
 *   node scripts/pdf-text.mjs <file.pdf | https://…/manual.pdf> [--pages 3-9] [--grep word]
 *
 * For researching gear by hand. Manufacturer spec sheets are overwhelmingly
 * PDFs, and a quote is only as good as the text it was read from: Shure's
 * guides embed subset fonts that a naive stream scrape turns into gibberish
 * with the digits missing, which is exactly the failure that produces a
 * confident, wrong depth. pdf.js applies the fonts' own Unicode maps.
 *
 * --grep prints only lines matching the word (case-insensitive), with the
 * page number, which is the fast way to find "Dimensions" in a 60-page guide.
 */

import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const args = process.argv.slice(2);
const target = args.find((a) => !a.startsWith("--") && args[args.indexOf(a) - 1] !== "--pages" && args[args.indexOf(a) - 1] !== "--grep");
if (!target) {
  console.error("usage: node scripts/pdf-text.mjs <file.pdf | url> [--pages 3-9] [--grep word]");
  process.exit(2);
}
const flag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

let bytes;
if (/^https?:\/\//i.test(target)) {
  const res = await fetch(target, { redirect: "follow", headers: { "user-agent": "Mozilla/5.0 (spec research)" } });
  if (!res.ok) {
    console.error(`fetch failed: HTTP ${res.status} for ${target}`);
    process.exit(1);
  }
  bytes = new Uint8Array(await res.arrayBuffer());
  const dir = await mkdtemp(join(tmpdir(), "pdf-"));
  const saved = join(dir, "doc.pdf");
  await writeFile(saved, bytes);
  console.error(`downloaded ${bytes.length} bytes from ${res.url} -> ${saved}`);
} else {
  bytes = new Uint8Array(await readFile(target));
}

if (String.fromCharCode(...bytes.slice(0, 5)) !== "%PDF-") {
  console.error("not a PDF (the URL may have returned an HTML page instead)");
  process.exit(1);
}

const doc = await getDocument({ data: bytes, useSystemFonts: true, verbosity: 0 }).promise;

let from = 1;
let to = doc.numPages;
const range = flag("--pages");
if (range) {
  const [a, b] = range.split("-").map(Number);
  from = Math.max(1, a || 1);
  to = Math.min(doc.numPages, b || a || doc.numPages);
}
const grep = flag("--grep")?.toLowerCase();

console.error(`${doc.numPages} pages; printing ${from}-${to}${grep ? ` matching "${grep}"` : ""}`);

for (let n = from; n <= to; n++) {
  const page = await doc.getPage(n);
  const content = await page.getTextContent();

  // Rebuild lines from positioned text runs: same baseline = same line.
  const lines = [];
  let current = [];
  let lastY = null;
  for (const item of content.items) {
    if (!("str" in item)) continue;
    const y = Math.round(item.transform[5]);
    if (lastY !== null && Math.abs(y - lastY) > 2) {
      lines.push(current.join(" ").replace(/\s+/g, " ").trim());
      current = [];
    }
    current.push(item.str);
    lastY = y;
    if (item.hasEOL) {
      lines.push(current.join(" ").replace(/\s+/g, " ").trim());
      current = [];
      lastY = null;
    }
  }
  if (current.length) lines.push(current.join(" ").replace(/\s+/g, " ").trim());

  // With --grep, keep each match plus the two lines after it: spec tables put
  // the label on one line and the value on the next.
  const all = lines.filter(Boolean);
  const keep = new Set();
  all.forEach((l, i) => {
    if (!grep || l.toLowerCase().includes(grep)) for (let k = i; k <= Math.min(i + 2, all.length - 1); k++) keep.add(k);
  });
  const kept = all.filter((_, i) => keep.has(i));
  if (!kept.length) continue;
  console.log(`\n=== page ${n} ===`);
  for (const l of kept) console.log(l);
}
