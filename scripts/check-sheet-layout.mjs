/**
 * Look for text sitting on top of other text on the patch sheet.
 *
 *   node scripts/check-sheet-layout.mjs
 *
 * Page layout is the one part of the sheet the unit tests cannot judge: they
 * check what the document says, not where it lands. A section that overflows
 * its page drops its legend onto the next page's table, and the HTML is
 * perfectly valid the whole time. This renders every demo rack in print media
 * and reports overlapping text boxes, which is how that failure actually
 * shows up.
 *
 * Needs a browser, so it is a separate command rather than part of `npm test`.
 */

import { writeFile } from "node:fs/promises";
import { chromium } from "playwright-core";

import { resolveChromium } from "../src/lib/export/pdf.ts";
import { renderPatchSheet } from "../src/lib/export/patchSheet.ts";
import { DEMO_RACKS, SEED_CASES, SEED_DEVICES } from "../src/lib/seed-data.ts";

/**
 * Every case profile gets a sheet too, not just the demo racks.
 *
 * A layout bug belongs to the case shape — how many bays, how many U — not to
 * the gear in it, and the triple-wide has no demo rack of its own. Filling
 * each profile with a repeating load exercises its geometry.
 */
function racksForEveryCase() {
  const filler = ["shure-ad600", "shure-slxd4", "generic-fan-1u", "radial-sw8"];
  return SEED_CASES.map((rackCase) => {
    const bays = Math.max(1, rackCase.bays ?? 1);
    const placements = [];
    for (let bay = 1; bay <= bays; bay++) {
      for (let u = 1; u <= rackCase.rackUnits; u++) {
        const id = filler[(u + bay) % filler.length];
        placements.push({ deviceId: id, bay, position: u, slot: "full", circuit: "A" });
      }
    }
    return {
      name: `${rackCase.name} — every U filled`,
      case: rackCase,
      circuits: [{ label: "A", volts: 120, amps: 20 }],
      placements,
    };
  });
}

/** Page box at 96 CSS px per inch, matching the sheet's own @page rule. */
const PAGE = { width: 1056, height: 816 };

/**
 * How much two text boxes may share before it counts as a collision.
 *
 * Not zero: inline elements legitimately sit inside each other's line boxes,
 * and a couple of pixels of kerning slop is normal. A fifth of the smaller box
 * is well past anything that happens by accident.
 */
const TOLERANCE = 0.18;

const findOverlaps = (tolerance) => {
  const nodes = [...document.querySelectorAll("body *")].filter((n) => {
    if (n.children.length && n.tagName !== "text") return false;
    return (n.textContent || "").trim().length > 0;
  });
  const boxes = nodes
    .map((n) => {
      const r = n.getBoundingClientRect();
      const cls = typeof n.className === "string" ? n.className : n.className.baseVal;
      return { n, r, text: (n.textContent || "").trim().slice(0, 44), cls: cls || "" };
    })
    .filter((b) => b.r.width > 1 && b.r.height > 1);

  const out = [];
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i];
      const b = boxes[j];
      if (a.n.contains(b.n) || b.n.contains(a.n)) continue;
      const ox = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
      const oy = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
      if (ox <= 1.5 || oy <= 1.5) continue;
      const smaller = Math.min(a.r.width * a.r.height, b.r.width * b.r.height);
      const share = (ox * oy) / smaller;
      if (share < tolerance) continue;
      out.push({
        a: a.text,
        aClass: a.cls,
        b: b.text,
        bClass: b.cls,
        share: Math.round(share * 100),
        y: Math.round(Math.min(a.r.top, b.r.top)),
      });
    }
  }
  return out;
};

const findOverflow = () =>
  [...document.querySelectorAll("section.sheet")]
    .map((s, i) => ({
      index: i,
      title: (s.querySelector("h1, h2")?.textContent || "").trim(),
      overflow: s.scrollHeight - s.clientHeight,
    }))
    .filter((s) => s.overflow > 2);

async function main() {
  const devices = new Map(SEED_DEVICES.map((d) => [d.id, d]));
  const sources = new Map(SEED_DEVICES.map((d) => [d.id, d.provenance]));

  const browser = await chromium.launch({
    // Shared with the PDF export, so the browser this is checked in is the
    // browser the document is printed with, on whichever machine is running.
    executablePath: await resolveChromium(),
    args: ["--no-sandbox"],
  });
  let failures = 0;
  try {
    const page = await browser.newPage({ viewport: PAGE });
    // Print media, because that is the layout the reader gets. The screen
    // layout of this document is not a thing anyone sees.
    await page.emulateMedia({ media: "print" });

    const suite = [...DEMO_RACKS, ...racksForEveryCase()];
    for (const rack of suite) {
      const html = renderPatchSheet({ rack, devices, sources });
      await page.setContent(html, { waitUntil: "load" });
      await page.waitForTimeout(150);

      const overlaps = await page.evaluate(findOverlaps, TOLERANCE);
      const overflow = await page.evaluate(findOverflow);

      if (!overlaps.length && !overflow.length) {
        console.log(`  ok    ${rack.name}`);
        continue;
      }
      failures++;
      console.log(`  FAIL  ${rack.name}`);
      for (const s of overflow) {
        console.log(`          section "${s.title}" overflows its page by ${s.overflow}px`);
      }
      for (const o of overlaps.slice(0, 6)) {
        console.log(
          `          "${o.a}" (${o.aClass}) over "${o.b}" (${o.bClass}) — ${o.share}% at y=${o.y}`,
        );
      }
      if (overlaps.length > 6) console.log(`          …and ${overlaps.length - 6} more`);
      await writeFile(
        `/tmp/sheet-layout-${rack.name.replace(/\W+/g, "-").toLowerCase()}.html`,
        html,
        "utf8",
      );
    }
  } finally {
    await browser.close();
  }

  if (failures) {
    console.error(`\n${failures} sheets have colliding text.`);
    process.exit(1);
  }
  console.log("\nEvery sheet lays out cleanly.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
