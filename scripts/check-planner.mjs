/**
 * Boot the built planner in a browser and make sure it still works.
 *
 *   node scripts/check-planner.mjs [url]
 *
 * The planner is the product. It is also ~1,900 lines of interaction code in
 * an HTML template that `npm test` cannot see: the unit tests cover the engine
 * the page calls, not the page. A typo in the template takes the whole thing
 * down and every engine assertion stays green.
 *
 * So this drives the real page: load it, walk every case profile and every
 * preset, flip to the rear view, click a device. Any console error, any thrown
 * exception, any panel that comes back empty, fails the run.
 *
 * Defaults to the file:// hand-out copy, which is the stricter of the two —
 * no server, no origin, and the one people are given on a stick. Pass a URL to
 * check a running server instead:
 *
 *   node scripts/check-planner.mjs http://localhost:3000/planner
 *
 * Needs a browser, so like sheet:check it is a separate command.
 */

import { access } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { chromium } from "playwright-core";

import { resolveChromium } from "../src/lib/export/pdf.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const built = resolve(root, "planner/planner.html");

const target = process.argv[2] ?? pathToFileURL(built).href;
const isFile = target.startsWith("file:");

if (isFile) {
  try {
    await access(built);
  } catch {
    console.error("planner/planner.html is not built. Run `npm run planner:build` first.");
    process.exit(1);
  }
}

const failures = [];
function check(condition, message) {
  if (!condition) failures.push(message);
}

const browser = await chromium.launch({
  // Same resolution as the PDF export and the sheet layout check: whatever
  // Chromium this machine has, with CHROMIUM_PATH overriding.
  executablePath: await resolveChromium(),
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

const noise = [];
page.on("console", (m) => {
  if (m.type() === "error") noise.push(`console: ${m.text()}`);
});
page.on("pageerror", (e) => noise.push(`uncaught: ${e.message}`));

/** What the page looks like right now, from the page's own point of view. */
async function snapshot() {
  return page.evaluate(() => {
    const text = (sel) => document.querySelector(sel)?.textContent?.trim() ?? "";
    return {
      units: document.querySelectorAll("#rack .unit").length,
      svgs: document.querySelectorAll("#rack svg").length,
      findings: text("#findings").length,
      budget: text("#budget").length,
      ledger: text("#ledger").length,
      catalog: document.querySelectorAll("#palette .pal-item").length,
      caseOptions: document.querySelectorAll("#caseSel option").length,
      presetOptions: document.querySelectorAll("#presetSel option").length,
    };
  });
}

await page.goto(target, { waitUntil: "networkidle" });

const first = await snapshot();
check(first.caseOptions > 0, "the case selector came up empty");
check(first.presetOptions > 0, "the preset selector came up empty");
check(first.catalog > 0, "the catalog drew no gear");
check(first.units > 0, "the starting rack drew no units");
check(first.svgs > 0, "no device panel was drawn");
check(first.budget > 0, "the budget rail is blank");

// The wordmark is a link home only where there is a home to go to. On file://
// an href="/" lands in the filesystem root, so it stays hidden.
const home = await page.evaluate(() => ({
  link: document.getElementById("homeLink")?.hidden,
  plain: document.getElementById("homeText")?.hidden,
}));
check(
  isFile ? home.link === true && home.plain === false : home.link === false && home.plain === true,
  isFile
    ? "the home link should stay hidden on file://, where there is no home"
    : "the home link should be showing when the planner is served",
);

// Every preset, on every case profile it will be asked to sit in. This is where
// a template typo in the redraw path surfaces: the first load can be fine and
// the second draw throw.
const cases = await page.$$eval("#caseSel option", (os) => os.map((o) => o.value));
const presets = await page.$$eval("#presetSel option", (os) => os.map((o) => o.value));

for (const caseValue of cases) {
  await page.selectOption("#caseSel", caseValue);
  for (const preset of presets) {
    await page.selectOption("#presetSel", preset);
    const shot = await snapshot();
    check(shot.svgs > 0, `no panel drawn on case "${caseValue}", preset "${preset}"`);
    check(shot.findings > 0, `the findings panel is blank on case "${caseValue}", preset "${preset}"`);
  }
}

// The rear view draws a different set of panels from a different layout list,
// and four devices are the only ones that have one.
await page.click("#viewRear");
const rear = await snapshot();
check(rear.svgs > 0, "the rear view drew nothing");
check(
  await page.getAttribute("#viewRear", "aria-pressed") === "true",
  "the rear view button did not take the pressed state",
);
await page.click("#viewFront");

// Clicking a placed unit opens the inspector. If the port list is empty the
// click-to-patch flow has nothing to start from.
const unit = await page.$("#rack .unit");
if (!unit) {
  failures.push("no placed unit to click");
} else {
  await unit.click();
  const detail = await page.evaluate(
    () => document.querySelector("#detail")?.textContent?.trim().length ?? 0,
  );
  check(detail > 0, "clicking a unit opened an empty inspector");
}

// Emptying the rack has to leave a working page, not a stack trace. The
// findings panel still has something to say about an empty case.
await page.click("#clearBtn");
const emptied = await snapshot();
check(emptied.units === 0, "Empty left units in the rack");
check(emptied.catalog > 0, "Empty took the catalog with it");

for (const line of noise) failures.push(line);

await browser.close();

if (failures.length) {
  console.error(`planner check FAILED — ${failures.length} problem(s) at ${target}\n`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log(
  `planner ok — ${cases.length} case profiles x ${presets.length} presets, front and rear, at ${target}`,
);
