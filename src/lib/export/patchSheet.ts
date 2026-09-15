/**
 * The patch sheet: the document that goes in the case lid.
 *
 * This is the deliverable the whole engine exists to produce. It is rendered
 * as a self-contained HTML document sized for paper, which
 * {@link renderPatchSheetPdf} turns into a PDF. Everything on it is computed
 * from the same modules the planner uses on screen, so the sheet and the
 * screen can never disagree.
 *
 * What makes it different from every other rack export: the sources appendix.
 * Every number on the device schedule traces to a manufacturer page or manual,
 * quoted verbatim, with any derivation spelled out. A depth figure with no
 * source behind it is worth nothing to the person deciding whether the lid
 * closes, so the sheet says which figures are measured, which are published,
 * and which are inferred.
 */

import { computeBudget, type RackBudget } from "@/lib/rack/budget";
import { checkRack, type CheckReport } from "@/lib/rack/checks";
import {
  caseDepthHeadroom,
  isHalfWidth,
  occupiedPositions,
  requiredDepth,
  slotsFor,
} from "@/lib/rack/geometry";
import type { CheckResult, DeviceSpec, RackSpec } from "@/lib/rack/types";
import { escapeXml as esc, renderElevation } from "./elevation";

/** One provenance row, matching the FieldSource table and the seed catalog. */
export interface SourceRow {
  field: string;
  sourceUrl: string;
  /** The document, when the URL alone does not identify it. */
  sourceTitle?: string | null;
  quote: string;
  confidence: number;
  derivation: string | null;
}

export interface PatchSheetInput {
  rack: RackSpec;
  devices: Map<string, DeviceSpec>;
  /** deviceId -> the provenance rows behind that device's published fields. */
  sources?: Map<string, SourceRow[]>;
  /** deviceId -> fields the research pipeline could not resolve. */
  unresolved?: Map<string, string[]>;
  generatedAt?: Date;
  preparedBy?: string | null;
  /** Shown in the footer. Set to null to omit. */
  productName?: string | null;
}

const PAPER = { width: "11in", height: "8.5in" };

// ---------------------------------------------------------------- helpers

function fmt(n: number | null | undefined, digits = 0, unit = ""): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return n.toFixed(digits).replace(/\.0+$/, "") + unit;
}

function mm(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return `${Math.round(n)} mm`;
}

function dual(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return `${Math.round(n)} mm <span class="alt">${(n / 25.4).toFixed(1)}"</span>`;
}

function slotLabel(device: DeviceSpec, slot: string | undefined): string {
  if (!isHalfWidth(device)) return "";
  return slotsFor(device, slot as never)[0] === "right" ? " R" : " L";
}

function positionLabel(device: DeviceSpec, position: number, slot?: string): string {
  const us = occupiedPositions(device, position);
  const first = us[0] ?? position;
  const last = us[us.length - 1] ?? position;
  const span = first === last ? `U${first}` : `U${first}–U${last}`;
  return span + slotLabel(device, slot);
}

const SEVERITY_ORDER: Record<string, number> = { error: 0, warning: 1, info: 2 };

// ---------------------------------------------------------------- sections

function coverSection(
  input: PatchSheetInput,
  budget: RackBudget,
  report: CheckReport,
): string {
  const { rack } = input;
  const when = (input.generatedAt ?? new Date()).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const errors = report.results.filter((r) => r.severity === "error").length;
  const warnings = report.results.filter((r) => r.severity === "warning").length;

  const verdict =
    errors > 0
      ? { cls: "bad", text: `${errors} problem${errors === 1 ? "" : "s"} to resolve` }
      : warnings > 0
        ? { cls: "warn", text: `${warnings} thing${warnings === 1 ? "" : "s"} to check` }
        : { cls: "ok", text: "No problems found" };

  const stats: [string, string][] = [
    ["Space", `${budget.unitsUsed} of ${budget.unitsTotal} U used · ${budget.unitsFree} free`],
    [
      "Weight",
      budget.grossWeightLb !== null
        ? `${fmt(budget.weightLb, 1)} lb of gear · ${fmt(budget.grossWeightLb, 1)} lb all up`
        : `${fmt(budget.weightLb, 1)} lb of gear`,
    ],
    [
      "Deepest unit",
      budget.maxRequiredDepthMm !== null
        ? `${dual(budget.maxRequiredDepthMm)} needed · ${dual(budget.usableDepthMm)} available`
        : "—",
    ],
    [
      "Centre of gravity",
      budget.cogFraction !== null
        ? `${mm(budget.cogMm)} up · ${Math.round(budget.cogFraction * 100)}% of rack height`
        : "—",
    ],
    ["Steady draw", `${fmt(budget.totalTypicalW, 0)} W · ${fmt(budget.totalMaxW, 0)} W worst case`],
    [
      "Heat",
      `${fmt(budget.heatW, 0)} W · ${fmt(budget.heatWPerRu, 1)} W per U` +
        (budget.hasForcedAir ? " · forced air" : " · convection only"),
    ],
  ];

  return `
<section class="sheet cover">
  <header class="masthead">
    <div>
      <div class="kicker">Rack patch sheet</div>
      <h1>${esc(rack.name)}</h1>
      <div class="sub">${esc(rack.case.name)} · ${rack.case.rackUnits}U · ${dual(rack.case.usableDepthMm)} usable depth${rack.case.hasRearRails ? " · rear rails" : " · front rails only"}</div>
    </div>
    <div class="meta">
      <div><span>Generated</span>${esc(when)}</div>
      ${input.preparedBy ? `<div><span>Prepared by</span>${esc(input.preparedBy)}</div>` : ""}
      <div><span>Devices</span>${rack.placements.length}</div>
    </div>
  </header>

  <div class="verdict ${verdict.cls}">${esc(verdict.text)}</div>

  <div class="statgrid">
    ${stats.map(([k, v]) => `<div class="stat"><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join("")}
  </div>

  ${findingsBlock(report.results, input.devices, input.rack)}
</section>`;
}

function findingsBlock(
  results: CheckResult[],
  devices: Map<string, DeviceSpec>,
  rack: RackSpec,
): string {
  if (!results.length) {
    return `<div class="findings"><h2>Findings</h2><p class="empty">Nothing flagged. Space, depth, power, weight and heat all check out against the figures in the schedule below.</p></div>`;
  }
  const sorted = [...results].sort(
    (a, b) => (SEVERITY_ORDER[a.severity] ?? 3) - (SEVERITY_ORDER[b.severity] ?? 3),
  );
  const rows = sorted
    .map((r) => {
      const names = (r.deviceIds ?? [])
        .map((id) => devices.get(id))
        .filter((d): d is DeviceSpec => !!d)
        .map((d) => `${d.brand} ${d.model}`);
      const where = [
        names.join(", "),
        r.positions?.length ? `U${r.positions.join(", U")}` : "",
        r.circuit ? `circuit ${r.circuit}` : "",
      ]
        .filter(Boolean)
        .join(" · ");
      return `<tr class="sev-${r.severity}">
        <td class="sev"><span class="pill ${r.severity}">${r.severity}</span></td>
        <td><b>${esc(r.title)}</b><div class="detail">${esc(r.detail)}</div>${where ? `<div class="where">${esc(where)}</div>` : ""}</td>
      </tr>`;
    })
    .join("");
  void rack;
  return `<div class="findings"><h2>Findings</h2><table class="findtable"><tbody>${rows}</tbody></table></div>`;
}

function elevationSection(input: PatchSheetInput): string {
  const { rack, devices } = input;
  return `
<section class="sheet elevations">
  <h2 class="pagetitle">Elevations</h2>
  <div class="elev-pair">
    <figure>
      <figcaption>Front <span>as you face the rack</span></figcaption>
      ${renderElevation(rack, devices, "front")}
    </figure>
    <figure>
      <figcaption>Rear <span>as you stand behind it — halves swapped</span></figcaption>
      ${renderElevation(rack, devices, "rear")}
    </figure>
  </div>
  <div class="legend">
    <span class="lg"><i class="sw in"></i> Input</span>
    <span class="lg"><i class="sw out"></i> Output</span>
    <span class="lg"><i class="sw bi"></i> Bidirectional</span>
    <span class="lg note">Connector type is shown by glyph shape and silkscreen, so this page reads correctly in black and white.</span>
  </div>
  <div class="notesbox"><span>Notes</span></div>
</section>`;
}

function deviceSchedule(input: PatchSheetInput, budget: RackBudget): string {
  const { rack, devices } = input;
  const placed = [...rack.placements]
    .map((p) => ({ p, d: devices.get(p.deviceId) }))
    .filter((x): x is { p: (typeof rack.placements)[number]; d: DeviceSpec } => !!x.d)
    .sort((a, b) => b.p.position - a.p.position);

  const incomplete = new Map(budget.incomplete.map((i) => [i.deviceId, i.missing]));

  const rows = placed
    .map(({ p, d }) => {
      const depth = requiredDepth(d);
      const missing = incomplete.get(d.id) ?? [];
      return `<tr>
      <td class="u">${esc(positionLabel(d, p.position, p.slot))}</td>
      <td><b>${esc(d.brand)} ${esc(d.model)}</b>${p.label ? `<div class="where">${esc(p.label)}</div>` : ""}<div class="where">${esc(d.category)}</div></td>
      <td class="num">${fmt(d.rackUnits, 1)}${isHalfWidth(d) ? " ½W" : ""}</td>
      <td class="num">${dual(d.depthMm)}</td>
      <td class="num strong">${dual(depth.requiredMm)}</td>
      <td class="num">${fmt(d.weightLb, 1)}</td>
      <td class="num">${d.passive ? "passive" : fmt(d.powerTypicalW ?? d.powerMaxW, 0, " W")}${d.powerTypicalW === null && d.powerMaxW !== null ? ' <span class="alt">max</span>' : ""}</td>
      <td class="num">${esc(p.circuit ?? "—")}</td>
      <td class="flag">${missing.length ? `<span class="pill warning">no ${esc(missing.join(", "))}</span>` : ""}</td>
    </tr>`;
    })
    .join("");

  return `
<section class="sheet">
  <h2 class="pagetitle">Device schedule</h2>
  <table class="grid">
    <thead><tr>
      <th>Pos</th><th>Device</th><th class="num">U</th><th class="num">Chassis</th>
      <th class="num">Needs</th><th class="num">lb</th><th class="num">Draw</th>
      <th class="num">Ckt</th><th></th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <p class="foot">“Needs” is the real depth: chassis plus the deepest mated connector behind it plus a cable bend allowance. It is the number that decides whether the lid closes, and it is not a figure any manufacturer publishes.</p>
</section>`;
}

function depthLedger(input: PatchSheetInput): string {
  const { rack, devices } = input;
  const placed = [...rack.placements]
    .map((p) => ({ p, d: devices.get(p.deviceId) }))
    .filter((x): x is { p: (typeof rack.placements)[number]; d: DeviceSpec } => !!x.d)
    .sort((a, b) => {
      const da = requiredDepth(a.d).requiredMm ?? 0;
      const db = requiredDepth(b.d).requiredMm ?? 0;
      return db - da;
    });

  const rows = placed
    .map(({ p, d }) => {
      const b = requiredDepth(d);
      const head = caseDepthHeadroom(d, rack.case).headroomMm;
      const over = head !== null && head < 0;
      const tight = head !== null && head >= 0 && head < 25;
      return `<tr class="${over ? "sev-error" : tight ? "sev-warning" : ""}">
      <td class="u">${esc(positionLabel(d, p.position, p.slot))}</td>
      <td>${esc(d.brand)} ${esc(d.model)}</td>
      <td class="num">${mm(b.chassisMm)}</td>
      <td class="num">+ ${mm(b.connectorMm)}</td>
      <td class="num">+ ${mm(b.bendMm)}</td>
      <td class="num strong">${mm(b.requiredMm)}</td>
      <td class="num ${over ? "bad" : tight ? "warn" : "ok"}">${head === null ? "—" : (head < 0 ? "−" : "+") + mm(Math.abs(head))}</td>
    </tr>`;
    })
    .join("");

  return `
<section class="sheet">
  <h2 class="pagetitle">Depth ledger</h2>
  <p class="lede">Case usable depth: <b>${dual(rack.case.usableDepthMm)}</b> between the rails. Headroom is what is left once the plug and the cable bend are accounted for.</p>
  <table class="grid">
    <thead><tr>
      <th>Pos</th><th>Device</th><th class="num">Chassis</th><th class="num">Connector</th>
      <th class="num">Bend</th><th class="num">Required</th><th class="num">Headroom</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <p class="foot warnfoot">Connector projection and bend allowances are this tool's working figures, not manufacturer data. Treat a headroom under 25 mm as “measure it before you buy the case.”</p>
</section>`;
}

function connectionSchedule(input: PatchSheetInput): string {
  const { rack, devices } = input;
  const placed = [...rack.placements]
    .map((p) => ({ p, d: devices.get(p.deviceId) }))
    .filter((x): x is { p: (typeof rack.placements)[number]; d: DeviceSpec } => !!x.d)
    .sort((a, b) => b.p.position - a.p.position);

  const rows: string[] = [];
  for (const { p, d } of placed) {
    const ports = [...d.ports].sort((a, b) =>
      a.face === b.face ? 0 : a.face === "rear" ? -1 : 1,
    );
    if (!ports.length) continue;
    rows.push(
      `<tr class="devrow"><td colspan="8"><b>${esc(d.brand)} ${esc(d.model)}</b> <span class="where">${esc(positionLabel(d, p.position, p.slot))}${p.label ? ` · ${esc(p.label)}` : ""}</span></td></tr>`,
    );
    for (const port of ports) {
      const dir = port.direction === "input" ? "in" : port.direction === "output" ? "out" : "bi";
      rows.push(`<tr>
        <td class="u">${esc(port.face)}</td>
        <td>${esc(port.label)}</td>
        <td class="num">${port.count}</td>
        <td>${esc(port.connector)}</td>
        <td><span class="dir ${dir}"></span>${esc(port.direction)}</td>
        <td>${esc(port.signal)}</td>
        <td class="num">${port.channels === null ? "—" : port.channels}</td>
        <td class="fill"></td>
      </tr>`);
    }
  }

  return `
<section class="sheet">
  <h2 class="pagetitle">Connection schedule</h2>
  <p class="lede">Every connector on every unit, rear face first. The last column is deliberately blank — fill it in as the rack is patched.</p>
  <table class="grid tight">
    <thead><tr>
      <th>Face</th><th>Label</th><th class="num">Qty</th><th>Connector</th>
      <th>Direction</th><th>Signal</th><th class="num">Ch</th><th class="fillhead">Patched to</th>
    </tr></thead>
    <tbody>${rows.join("")}</tbody>
  </table>
</section>`;
}

function circuitSchedule(input: PatchSheetInput, budget: RackBudget): string {
  const { devices } = input;
  if (!budget.circuits.length && !budget.unassignedDeviceIds.length) return "";

  const rows = budget.circuits
    .map((c) => {
      const names = c.deviceIds
        .map((id) => devices.get(id))
        .filter((d): d is DeviceSpec => !!d)
        .map((d) => `${d.brand} ${d.model}`);
      const pct = Math.round(c.utilization * 100);
      const cls = c.utilization > 1 ? "sev-error" : c.utilization > 0.85 ? "sev-warning" : "";
      return `<tr class="${cls}">
      <td class="cktcell"><b>${esc(c.circuit.label)}</b><div class="where">${c.circuit.volts} V · ${c.circuit.amps} A</div></td>
      <td>${names.length ? esc(names.join(", ")) : '<span class="where">nothing assigned</span>'}</td>
      <td class="num">${fmt(c.typicalW, 0, " W")}</td>
      <td class="num">${fmt(c.capacityW, 0, " W")}</td>
      <td class="num">${fmt(c.inrushW, 0, " W")}</td>
      <td class="num strong">
        <div class="bar"><i style="width:${Math.min(100, pct)}%"></i></div>${pct}%
      </td>
    </tr>`;
    })
    .join("");

  const orphans = budget.unassignedDeviceIds
    .map((id) => devices.get(id))
    .filter((d): d is DeviceSpec => !!d)
    .map((d) => `${d.brand} ${d.model}`);

  return `
<section class="sheet">
  <h2 class="pagetitle">Circuit schedule</h2>
  <table class="grid">
    <thead><tr>
      <th>Circuit</th><th>On it</th><th class="num">Steady</th>
      <th class="num">Continuous cap</th><th class="num">Worst inrush</th><th class="num">Load</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <p class="foot">Continuous capacity is 80% of the breaker rating, per NEC 210.19(A) and 210.20(A) — a rack running all night is a continuous load. Worst inrush is the largest single unit's startup surge with everything else already drawing steady.</p>
  ${orphans.length ? `<p class="foot warnfoot">Not assigned to any circuit: ${esc(orphans.join(", "))}.</p>` : ""}
</section>`;
}

function sourcesAppendix(input: PatchSheetInput): string {
  const { rack, devices, sources, unresolved } = input;
  if (!sources || sources.size === 0) return "";

  const seen = new Set<string>();
  const blocks: string[] = [];

  for (const p of [...rack.placements].sort((a, b) => b.position - a.position)) {
    const d = devices.get(p.deviceId);
    if (!d || seen.has(d.id)) continue;
    seen.add(d.id);
    const rows = sources.get(d.id);
    if (!rows?.length) continue;

    const items = rows
      .map((r) => {
        const host = hostOf(r.sourceUrl);
        const conf =
          r.confidence >= 0.9 ? "high" : r.confidence >= 0.75 ? "good" : r.confidence >= 0.6 ? "fair" : "low";
        return `<li>
        <div class="srcfield"><code>${esc(r.field)}</code> <span class="pill conf-${conf}">${conf} confidence</span></div>
        <blockquote>${esc(r.quote)}</blockquote>
        ${r.derivation ? `<div class="deriv"><b>Derived:</b> ${esc(r.derivation)}</div>` : ""}
        ${r.sourceTitle ? `<div class="srctitle">${esc(r.sourceTitle)}</div>` : ""}
        <div class="srcurl">${esc(host)} — <span class="url">${esc(r.sourceUrl)}</span></div>
      </li>`;
      })
      .join("");

    const missing = unresolved?.get(d.id) ?? [];
    blocks.push(`<div class="srcblock">
      <h3>${esc(d.brand)} ${esc(d.model)}</h3>
      <ul class="srclist">${items}</ul>
      ${missing.length ? `<p class="foot warnfoot">No published source found for: ${esc(missing.join(", "))}.</p>` : ""}
    </div>`);
  }

  if (!blocks.length) return "";

  return `
<section class="sheet sources">
  <h2 class="pagetitle">Sources</h2>
  <p class="lede">Every figure in the schedules above, quoted from where it came from. Anything marked <b>derived</b> was computed rather than read — the arithmetic is shown so you can check it.</p>
  <div class="srcwrap">${blocks.join("")}</div>
</section>`;
}

function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}

// ------------------------------------------------------------------- CSS

const CSS = `
@page { size: ${PAPER.width} ${PAPER.height}; margin: 0.5in 0.5in 0.62in; }
*,*::before,*::after { box-sizing: border-box; }
:root {
  --ink:#14181C; --ink-2:#4A545D; --ink-3:#7C8792; --rule:#C9D1D8; --rule-2:#E4E9ED;
  --bad:#B3261E; --warn:#9A6400; --ok:#1B6E4A;
  --dir-in:#1F5FA8; --dir-out:#B4491C; --dir-bi:#14785A;
  /* Shop-drawing palette: the panel renderer's own variables, flipped to
     line art so the page photocopies and takes a pen. */
  --pf-face:#FFFFFF; --pf-ear:#F4F7F9; --pf-edge:#14181C; --pf-hole:#E7ECF0;
  --pf-pin:#4A545D; --pf-silk:#14181C; --pf-knob:#C3CCD4; --pf-btn:#EDF1F4;
  --pf-lcd:#E7ECF0; --pf-lcd-ink:#4A545D; --pf-led-on:#4A545D; --pf-led-dim:#C3CCD4; --pf-led-off:#E7ECF0;
  --el-void:#FBFCFD; --el-rail:#14181C;
  --sans:"Helvetica Neue",Helvetica,Arial,sans-serif;
  --mono:"SFMono-Regular",Menlo,Consolas,monospace;
}
html,body { margin:0; padding:0; }
body { font-family:var(--sans); color:var(--ink); font-size:9.2pt; line-height:1.4;
  -webkit-print-color-adjust:exact; print-color-adjust:exact; }
.sheet { page-break-after:always; break-after:page; }
.sheet:last-child { page-break-after:auto; break-after:auto; }

.masthead { display:flex; justify-content:space-between; align-items:flex-start; gap:24px;
  border-bottom:2.5px solid var(--ink); padding-bottom:10px; margin-bottom:16px; }
.kicker { font-family:var(--mono); font-size:7.5pt; letter-spacing:.14em; text-transform:uppercase;
  color:var(--ink-3); margin-bottom:3px; }
h1 { font-size:21pt; margin:0 0 3px; letter-spacing:-.01em; }
.sub { color:var(--ink-2); font-size:9pt; }
.meta { text-align:right; font-family:var(--mono); font-size:8pt; color:var(--ink-2); }
.meta div { margin-bottom:2px; }
.meta span { display:block; font-size:6.8pt; letter-spacing:.1em; text-transform:uppercase; color:var(--ink-3); }

.verdict { font-size:12pt; font-weight:600; padding:8px 12px; margin-bottom:14px;
  border-left:5px solid var(--ok); background:#F2F8F5; }
.verdict.warn { border-color:var(--warn); background:#FBF6EC; }
.verdict.bad { border-color:var(--bad); background:#FBF0EF; }

.statgrid { display:grid; grid-template-columns:repeat(3,1fr); gap:0; margin-bottom:18px;
  border-top:1px solid var(--rule); border-left:1px solid var(--rule); }
.stat { border-right:1px solid var(--rule); border-bottom:1px solid var(--rule); padding:8px 11px; }
.stat dt { font-family:var(--mono); font-size:6.8pt; letter-spacing:.11em; text-transform:uppercase;
  color:var(--ink-3); margin-bottom:3px; }
.stat dd { margin:0; font-size:10pt; }
.alt { color:var(--ink-3); font-size:.85em; }

h2.pagetitle { font-size:13pt; margin:0 0 4px; padding-bottom:6px; border-bottom:2px solid var(--ink); }
.lede { color:var(--ink-2); margin:8px 0 12px; }
.findings h2 { font-size:11pt; margin:0 0 6px; }
.empty { color:var(--ink-2); margin:0; }

table { width:100%; border-collapse:collapse; }
thead { display:table-header-group; }
tfoot { display:table-footer-group; }
.grid th { font-family:var(--mono); font-size:6.8pt; letter-spacing:.1em; text-transform:uppercase;
  color:var(--ink-3); text-align:left; padding:6px 7px; border-bottom:1.5px solid var(--ink); }
.grid td { padding:6px 7px; border-bottom:1px solid var(--rule-2); vertical-align:top; }
.grid.tight td, .grid.tight th { padding:3.5px 7px; }
.grid tbody tr { page-break-inside:avoid; break-inside:avoid; }
.num { text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap; }
.strong { font-weight:600; }
.u { font-family:var(--mono); font-size:8pt; white-space:nowrap; }
.where { color:var(--ink-3); font-size:7.6pt; }
td.cktcell { white-space:nowrap; width:14%; }
.detail { color:var(--ink-2); }
td.ok { color:var(--ok); } td.warn { color:var(--warn); } td.bad { color:var(--bad); font-weight:600; }
tr.sev-error td { background:#FCF4F3; } tr.sev-warning td { background:#FDFAF3; }
tr.devrow td { background:#F1F4F6; border-bottom:1px solid var(--rule); padding-top:7px; }
td.fill, th.fillhead { width:22%; border-left:1px solid var(--rule); }
td.fill { background:repeating-linear-gradient(transparent,transparent 97%,var(--rule-2) 97%); }

.findtable td { padding:6px 8px 6px 0; border-bottom:1px solid var(--rule-2); vertical-align:top; }
.findtable td.sev { width:66px; }
.pill { display:inline-block; font-family:var(--mono); font-size:6.6pt; letter-spacing:.08em;
  text-transform:uppercase; padding:1.5px 5px; border:1px solid currentColor; border-radius:2px; }
.pill.error { color:var(--bad); } .pill.warning { color:var(--warn); } .pill.info { color:var(--ink-3); }
.pill.conf-high { color:var(--ok); } .pill.conf-good { color:var(--ink-2); }
.pill.conf-fair { color:var(--warn); } .pill.conf-low { color:var(--bad); }

.bar { display:inline-block; width:54px; height:5px; background:var(--rule-2); margin-right:6px;
  vertical-align:middle; }
.bar i { display:block; height:100%; background:var(--ink-2); }
tr.sev-warning .bar i { background:var(--warn); } tr.sev-error .bar i { background:var(--bad); }

.dir { display:inline-block; width:7px; height:7px; margin-right:5px; vertical-align:baseline;
  background:var(--dir-bi); transform:rotate(45deg); }
.dir.in { background:var(--dir-in); border-radius:50%; transform:none; }
.dir.out { background:var(--dir-out); transform:none; }

/* A short rack leaves paper below the drawing. Rather than print air, the
   remainder becomes ruled note space, which is what the page gets used for
   anyway. A tall rack squeezes it to nothing on its own. */
.sheet.elevations { display:flex; flex-direction:column; height:7.38in; }
.notesbox { flex:1 1 auto; min-height:0; margin-top:12px; border-top:1px solid var(--rule);
  background:repeating-linear-gradient(#FFF,#FFF 23px,var(--rule-2) 23px,var(--rule-2) 24px);
  position:relative; }
.notesbox span { position:absolute; top:3px; left:0; font-family:var(--mono); font-size:6.8pt;
  letter-spacing:.11em; text-transform:uppercase; color:var(--ink-3); background:#FFF; padding-right:6px; }
.elev-pair { display:grid; grid-template-columns:1fr 1fr; gap:22px; align-items:start; margin-top:10px; }
.elev-pair figure { margin:0; }
figcaption { font-family:var(--mono); font-size:7.4pt; letter-spacing:.1em; text-transform:uppercase;
  color:var(--ink); margin-bottom:6px; padding-bottom:4px; border-bottom:1px solid var(--rule); }
figcaption span { letter-spacing:0; text-transform:none; color:var(--ink-3); }
svg.elevation { width:100%; height:auto; max-height:6.2in; }
svg.elevation text.el-u { font-family:var(--mono); font-size:52px; fill:#7C8792; }
svg.panel text { font-family:var(--mono); fill:var(--pf-silk); }
svg.panel .silk-brand { font-size:44px; font-weight:600; letter-spacing:3px; }
svg.panel .silk-model { font-size:34px; opacity:.72; }
svg.panel .silk-sm { font-size:26px; opacity:.7; letter-spacing:.5px; }

.legend { margin-top:12px; padding-top:9px; border-top:1px solid var(--rule); display:flex;
  gap:18px; align-items:center; flex-wrap:wrap; font-size:8pt; color:var(--ink-2); }
.lg i.sw { display:inline-block; width:9px; height:9px; margin-right:5px; vertical-align:-1px; }
.sw.in { background:var(--dir-in); border-radius:50%; }
.sw.out { background:var(--dir-out); }
.sw.bi { background:var(--dir-bi); transform:rotate(45deg); }
.lg.note { color:var(--ink-3); font-style:italic; }

.foot { margin:10px 0 0; font-size:7.8pt; color:var(--ink-3); line-height:1.45; }
.warnfoot { color:var(--warn); }

.sources .srcwrap { column-count:2; column-gap:26px; column-rule:1px solid var(--rule-2); }
.srcblock { page-break-inside:avoid; break-inside:avoid; margin-bottom:14px; }
.srcblock h3 { font-size:10pt; margin:0 0 6px; padding-bottom:3px; border-bottom:1px solid var(--rule); }
.srclist { list-style:none; margin:0; padding:0; }
.srclist li { margin-bottom:9px; padding-left:10px; border-left:2px solid var(--rule-2); }
.srcfield code { font-family:var(--mono); font-size:8pt; background:#F1F4F6; padding:1px 4px; }
blockquote { margin:4px 0; font-size:8.2pt; color:var(--ink-2); font-style:italic; }
.deriv { font-size:7.8pt; color:var(--ink-2); }
.srctitle { font-size:7.8pt; color:var(--ink-2); margin-top:2px; font-style:italic; }
.srcurl { font-size:7.4pt; color:var(--ink-3); margin-top:2px; }
.srcurl .url { font-family:var(--mono); word-break:break-all; }
`;

// ------------------------------------------------------------------ entry

export function renderPatchSheet(input: PatchSheetInput): string {
  const budget = computeBudget(input.rack, input.devices);
  const report = checkRack(input.rack, input.devices);

  const body = [
    coverSection(input, budget, report),
    elevationSection(input),
    deviceSchedule(input, budget),
    connectionSchedule(input),
    circuitSchedule(input, budget),
    depthLedger(input),
    sourcesAppendix(input),
  ]
    .filter(Boolean)
    .join("\n");

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>${esc(input.rack.name)} — patch sheet</title>
<style>${CSS}</style>
</head><body>${body}</body></html>`;
}
