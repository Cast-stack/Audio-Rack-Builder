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
      shelves: document.querySelectorAll("#palette .pal-shelf-row").length,
      caseOptions: document.querySelectorAll("#caseSel option").length,
      presetOptions: document.querySelectorAll("#presetSel option").length,
    };
  });
}

await page.goto(target, { waitUntil: "networkidle" });

const DEVICE_COUNT = await page.evaluate(() => window.RACK.SEED_DEVICES.length);

const first = await snapshot();
check(first.caseOptions > 0, "the case selector came up empty");
check(first.presetOptions > 0, "the preset selector came up empty");
check(first.shelves > 0, "the catalog drew no shelves to browse");
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
  (await page.isVisible("#addGearBtn")) === !isFile,
  isFile
    ? "the add-a-device action must stay hidden on file://, where no endpoint exists"
    : "the add-a-device action should be offered when the planner is served",
);

// The button being hidden is not enough: the form it opens has to be hidden
// too, and a class that sets display will silently defeat the attribute.
check(
  !(await page.isVisible("#addGear")),
  "the add-a-device form must not show until it is asked for",
);

check(
  isFile ? home.link === true && home.plain === false : home.link === false && home.plain === true,
  isFile
    ? "the home link should stay hidden on file://, where there is no home"
    : "the home link should be showing when the planner is served",
);

// Theme. Asserting the attribute flips would prove nothing — what matters is
// that the page actually changes colour, that the choice outlives a reload,
// and that Auto really does hand control back to the operating system.
async function bodyInk() {
  return page.evaluate(() => {
    const cs = getComputedStyle(document.body);
    return `${cs.backgroundColor}|${cs.color}`;
  });
}

const beforeTheme = await bodyInk();
await page.click('#themeSeg button[data-theme-set="dark"]');
const darkInk = await bodyInk();
check(
  (await page.getAttribute("html", "data-theme")) === "dark",
  "choosing Dark should set data-theme on the root",
);

await page.click('#themeSeg button[data-theme-set="light"]');
const lightInk = await bodyInk();
check(darkInk !== lightInk, `dark and light should not paint the same: both were ${darkInk}`);
check(
  (await page.$eval('#themeSeg button[data-theme-set="light"]', (b) => b.getAttribute("aria-pressed"))) === "true",
  "the chosen theme should be the pressed one",
);

// A theme that forgets itself on reload is worse than no theme.
await page.click('#themeSeg button[data-theme-set="dark"]');
await page.reload({ waitUntil: "networkidle" });
check(
  (await page.getAttribute("html", "data-theme")) === "dark",
  "the chosen theme should survive a reload",
);
check(
  (await bodyInk()) === darkInk,
  "the reloaded page should come back in the theme that was chosen",
);

// Auto means auto: the attribute goes away entirely rather than being pinned
// to whatever the OS happens to be right now.
await page.click('#themeSeg button[data-theme-set="auto"]');
check(
  (await page.getAttribute("html", "data-theme")) === null,
  "Auto should remove data-theme, not freeze the current appearance",
);
check(
  (await bodyInk()) === beforeTheme,
  "Auto should return the page to how it looked before any choice was made",
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

// The catalog browses two levels deep and both ways up. Opening a shelf has to
// produce gear, and Brand has to cover the same catalog Type does — a device
// reachable under one grouping and not the other is a device nobody finds.
for (const by of ["Type", "Brand"]) {
  await page.click(`#palette .pal-by button:has-text("${by}")`);
  const shelfCount = await page.$$eval("#palette .pal-shelf-row", (r) => r.length);
  check(shelfCount > 0, `browsing by ${by} offered no shelves`);

  let reachable = 0;
  for (let n = 0; n < shelfCount; n++) {
    const rows = await page.$$("#palette .pal-shelf-row");
    const name = await rows[n].getAttribute("data-shelf");
    await rows[n].click();
    const inside = await page.$$eval("#palette .pal-item", (r) => r.length);
    check(inside > 0, `shelf "${name}" (by ${by}) opened onto nothing`);
    reachable += inside;
    await page.click("#palette .pal-back");
  }
  check(
    reachable === DEVICE_COUNT,
    `browsing by ${by} reaches ${reachable} devices, the catalog has ${DEVICE_COUNT}`,
  );
}

// The filter cuts through the shelves rather than navigating them.
await page.fill("#catSearch", "ulxd");
const filtered = await page.$$eval("#palette .pal-item", (r) => r.length);
check(filtered > 0, "filtering for a known model found nothing");
await page.fill("#catSearch", "zzzznotathing");
check(
  (await page.$$eval("#palette .noports", (r) => r.length)) === 1,
  "a filter matching nothing should say so",
);
await page.fill("#catSearch", "");

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
check(emptied.shelves > 0, "Empty took the catalog with it");


// ---------------------------------------------------------------------------
// Served pass: the parts that only exist when there is a server behind the page
//
// "Add a device" calls an endpoint, so it is hidden on file:// and there is no
// way to exercise it from the default run. This serves the built page over
// http from a throwaway server and stubs the endpoint, which covers the whole
// UI path — request, badge, findings, removal — without an API key and without
// spending anything. What it does not cover is the researcher itself; that
// needs ANTHROPIC_API_KEY and a real run.

/** A plausible emit_device payload, shaped like the route's 200. */
const STUB_RESPONSE = {
  status: "provisional",
  revisionId: null,
  filedForReview: false,
  device: {
    brand: "Furman",
    model: "PL-PLUS C",
    category: "Power Conditioner",
    description: "15 A rack conditioner with voltmeter, pull-out lights and nine outlets.",
    formFactor: "full-rack",
    rackUnits: 1,
    depthMm: 254,
    weightLb: 12.0,
    powerTypicalW: null,
    powerMaxW: 20,
    powerInput: "Edison",
    voltage: "120VAC 60Hz",
    poePowered: false,
    ports: [
      { label: "AC In", connector: "Edison", direction: "input", signal: "power", channels: null, count: 1, face: "rear" },
      { label: "Switched outlets", connector: "Edison", direction: "output", signal: "power", channels: null, count: 8, face: "rear" },
    ],
    status: "current",
    statusNote: null,
    priceUsd: null,
    priceKind: null,
    priceVerifiedAt: null,
    productUrl: "https://furmanpower.com/products/pl-plus-c",
    datasheetUrl: null,
  },
  provenance: [
    {
      field: "rackUnits",
      sourceUrl: "https://furmanpower.com/products/pl-plus-c",
      quote: "1 RU",
      confidence: 0.9,
      derivation: null,
    },
  ],
  unresolved: ["powerTypicalW"],
  notes: null,
  disposition: "review",
  issues: [],
  sources: {
    read: [{ url: "https://furmanpower.com/products/pl-plus-c", host: "furmanpower.com", trusted: true }],
    rejected: [],
    allTrusted: true,
  },
};

async function servedPass() {
  const { createServer } = await import("node:http");
  const { readFile } = await import("node:fs/promises");
  const html = await readFile(built);

  const server = createServer((req, res) => {
    // Everything that is not the stubbed endpoint is the page itself.
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(html);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const origin = `http://127.0.0.1:${port}`;

  const page2 = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page2.on("console", (m) => {
    if (m.type() === "error") noise.push(`console (served): ${m.text()}`);
  });
  page2.on("pageerror", (e) => noise.push(`uncaught (served): ${e.message}`));

  let calls = 0;
  let sentBody = null;
  await page2.route("**/api/gear/request", async (route) => {
    calls++;
    sentBody = JSON.parse(route.request().postData() ?? "{}");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(STUB_RESPONSE),
    });
  });

  try {
    await page2.goto(`${origin}/planner`, { waitUntil: "networkidle" });

    // Served, so the action is there. On file:// it must not be.
    check(
      await page2.isVisible("#addGearBtn"),
      "served over http, the add-a-device action should be offered",
    );

    await page2.click("#addGearBtn");
    await page2.fill("#agName", "Furman PL-Plus C");
    await page2.fill("#agSources", "https://furmanpower.com/products/pl-plus-c");
    await page2.click("#agGo");
    await page2.waitForSelector(".ag-status.good", { timeout: 15_000 });

    check(calls === 1, `expected one request to the endpoint, saw ${calls}`);
    check(
      sentBody?.query === "Furman PL-Plus C",
      `the typed name should reach the endpoint, got ${JSON.stringify(sentBody?.query)}`,
    );
    check(
      Array.isArray(sentBody?.sources) && sentBody.sources.length === 1,
      "the supplied link should reach the endpoint",
    );

    // It has to be findable, and findable as unverified.
    await page2.fill("#catSearch", "PL-PLUS");
    const badged = await page2.$$eval("#palette .pal-item .tag.prov", (r) => r.length);
    check(badged === 1, `the requested device should carry an unverified badge, saw ${badged}`);

    // Placing it must move the numbers AND say the numbers are unchecked.
    await page2.click("#palette .pal-item .add");
    await page2.waitForTimeout(400);
    const findings = await page2.textContent("#findings");
    check(
      /not been checked by a person/.test(findings ?? ""),
      "a placed unverified unit must be called out in the findings",
    );

    // It survives a reload: this is the browser's catalog now, not a session.
    await page2.reload({ waitUntil: "networkidle" });
    await page2.fill("#catSearch", "PL-PLUS");
    check(
      (await page2.$$eval("#palette .pal-item", (r) => r.length)) === 1,
      "a requested device should still be there after a reload",
    );

    // And it can be taken back out, along with anything placed from it.
    page2.once("dialog", (d) => d.accept());
    await page2.click("#palette .pal-item .drop");
    await page2.waitForTimeout(400);
    await page2.fill("#catSearch", "PL-PLUS");
    check(
      (await page2.$$eval("#palette .pal-item", (r) => r.length)) === 0,
      "forgetting a requested device should remove it from the catalog",
    );
    const after = await page2.textContent("#findings");
    check(
      !/not been checked by a person/.test(after ?? ""),
      "forgetting it should clear its finding too",
    );
  } finally {
    await page2.close();
    await new Promise((resolve) => server.close(resolve));
  }

  return true;
}

let servedRan = false;
if (isFile) {
  servedRan = await servedPass();
} else {
  // Pointed at a real server: the add action should be offered there too.
  check(
    await page.isVisible("#addGearBtn"),
    "served over http, the add-a-device action should be offered",
  );
}

for (const line of noise) failures.push(line);

await browser.close();

if (failures.length) {
  console.error(`planner check FAILED — ${failures.length} problem(s) at ${target}\n`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log(
  `planner ok — ${cases.length} case profiles x ${presets.length} presets, front and rear, at ${target}` +
    (servedRan ? ", plus the served add-a-device flow against a stubbed endpoint" : ""),
);
