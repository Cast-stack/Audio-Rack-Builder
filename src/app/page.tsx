import Link from "next/link";
import CheckPanel from "@/components/CheckPanel";
import {
  checkRack,
  REAR_SUPPORT_DEPTH_MM,
  REAR_SUPPORT_WEIGHT_LB,
} from "@/lib/rack/checks";
import { occupiedUnits, requiredDepth } from "@/lib/rack/geometry";
import type { CheckResult, DeviceSpec, RackSpec } from "@/lib/rack/types";
import { DEMO_DEVICES, DEMO_RACK, DEMO_RACK_FIXED } from "@/lib/seed-data";

/**
 * The argument, made with the two demo racks rather than with adjectives:
 * the same gear list in a case that will not close, and in one that will.
 */

const wrong = checkRack(DEMO_RACK, DEMO_DEVICES);
const right = checkRack(DEMO_RACK_FIXED, DEMO_DEVICES);

function deviceOf(id: string): DeviceSpec | undefined {
  return DEMO_DEVICES.get(id);
}

function failingIds(results: CheckResult[]): Set<string> {
  const ids = new Set<string>();
  for (const r of results) {
    if (r.severity !== "error") continue;
    for (const id of r.deviceIds ?? []) ids.add(id);
  }
  return ids;
}

function MiniRack({ rack, results }: { rack: RackSpec; results: CheckResult[] }) {
  const total = rack.case.rackUnits;
  const fails = failingIds(results);
  const rows = Array.from({ length: total }, (_, i) => total - i).map((u) => {
    const placement = rack.placements.find((p) => {
      const d = deviceOf(p.deviceId);
      if (!d) return false;
      return u >= p.position && u < p.position + occupiedUnits(d);
    });
    const device = placement ? deviceOf(placement.deviceId) : undefined;
    const bad = device ? fails.has(device.id) : false;
    return { u, device, bad };
  });

  return (
    <div className="flex gap-1.5">
      <div aria-hidden className="grid w-5 shrink-0" style={{ gridTemplateRows: `repeat(${total}, 1.75rem)` }}>
        {rows.map((r) => (
          <div key={r.u} className="num flex items-center justify-end pr-1 font-mono text-[0.5625rem] text-faint">
            {r.u}
          </div>
        ))}
      </div>
      <div className="flex min-w-0 flex-1 gap-1 border border-line-strong bg-sunken p-1">
        <div aria-hidden className="rail-strip w-2 shrink-0" style={{ backgroundSize: "100% 1.75rem" }} />
        <div className="grid min-w-0 flex-1 gap-px" style={{ gridTemplateRows: `repeat(${total}, 1.75rem)` }}>
          {rows.map((r) => (
            <div
              key={r.u}
              className={`flex items-center justify-between gap-2 border px-1.5 ${
                r.device
                  ? r.bad
                    ? "border-err bg-err-wash"
                    : "border-line-strong bg-raised"
                  : "vented border-dashed border-line"
              }`}
            >
              <span className="truncate font-display text-[0.6875rem] font-semibold uppercase tracking-[0.04em]">
                {r.device ? r.device.model : ""}
              </span>
              {r.bad ? (
                <span className="shrink-0 font-mono text-[0.5rem] uppercase tracking-legend text-err">
                  will not fit
                </span>
              ) : null}
            </div>
          ))}
        </div>
        <div aria-hidden className="rail-strip w-2 shrink-0" style={{ backgroundSize: "100% 1.75rem" }} />
      </div>
    </div>
  );
}

function Verdict({ errors, warnings }: { errors: number; warnings: number }) {
  const ok = errors === 0;
  return (
    <p
      className={`num inline-flex items-center gap-2 border px-2 py-1 font-mono text-[0.6875rem] uppercase tracking-legend ${
        ok ? "border-ok text-ok" : "border-err text-err"
      }`}
    >
      <span className={`inline-block h-2 w-2 ${ok ? "bg-ok" : "bg-err"}`} aria-hidden />
      {errors} fail / {warnings} check
    </p>
  );
}

export default function HomePage() {
  const depthRows = DEMO_RACK.placements
    .map((p) => deviceOf(p.deviceId))
    .filter((d): d is DeviceSpec => d !== undefined)
    .map((d) => ({ device: d, depth: requiredDepth(d) }));

  const deepest = depthRows.reduce<number>(
    (max, r) => (r.depth.requiredMm != null && r.depth.requiredMm > max ? r.depth.requiredMm : max),
    0,
  );

  const shallowCase = DEMO_RACK.case;
  const touringCase = DEMO_RACK_FIXED.case;

  return (
    <main className="mx-auto w-full max-w-[1400px] px-4 py-10 sm:px-6">
      {/* Thesis */}
      <section className="grid gap-8 lg:grid-cols-[minmax(0,32rem)_minmax(0,1fr)] lg:items-end">
        <div>
          <p className="legend">Feasibility, not drawing</p>
          <h1 className="mt-2 font-display text-4xl font-bold uppercase leading-[0.95] tracking-[0.01em] sm:text-5xl">
            Every rack drawing
            <br />
            closes on paper
          </h1>
          <p className="mt-4 max-w-[52ch] text-base leading-relaxed text-muted">
            A planner that compares one depth number to one depth number says this fly pack is
            fine. It is not. The published depth is the chassis; what has to fit is the chassis,
            the mated plug hanging off the back of it, and enough room to turn the cable. Four of
            these six units do not physically go in the case.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              href="/planner"
              className="border border-accent bg-accent px-4 py-2 font-mono text-xs uppercase tracking-legend text-accent-ink"
            >
              Open the planner
            </Link>
            <Link
              href="/how-it-works"
              className="border border-line-strong px-4 py-2 font-mono text-xs uppercase tracking-legend text-muted hover:border-accent hover:text-accent"
            >
              See the arithmetic
            </Link>
          </div>
        </div>

        <div className="panel p-3">
          <p className="legend mb-2">The line that decides it</p>
          <p className="num font-mono text-sm leading-relaxed">
            <span className="text-ink">152 mm</span>
            <span className="text-faint"> chassis</span>
            <span className="text-faint"> + </span>
            <span className="text-ink">70 mm</span>
            <span className="text-faint"> for the DB25 connectors</span>
            <span className="text-faint"> + </span>
            <span className="text-ink">90 mm</span>
            <span className="text-faint"> to turn the cable</span>
            <span className="text-faint"> = </span>
            <span className="border-b-2 border-err pb-px font-semibold text-ink">312 mm</span>
            <span className="text-faint">, against </span>
            <span className="font-semibold">305 mm</span>
            <span className="text-faint"> usable.</span>
          </p>
          <p className="mt-3 max-w-[54ch] text-sm text-muted">
            That is the Radial SW8 — the shallowest unit in the rack, six inches deep, and the
            one nobody would ever expect to be the problem. It is short by 7 mm.
          </p>
        </div>
      </section>

      {/* Same gear, two cases */}
      <section className="mt-14">
        <header className="border-b border-line pb-2">
          <h2 className="font-display text-2xl font-semibold uppercase tracking-[0.04em]">
            The same gear list, twice
          </h2>
          <p className="mt-1 max-w-[70ch] text-sm text-muted">
            Left: the build as somebody would draw it in a tool that totals power, weight and
            depth. Right: the same units, plus a vent panel and a fan panel, in a case that takes
            them. Both are run through the same checks.
          </p>
        </header>

        <div className="mt-5 grid gap-6 lg:grid-cols-2">
          {[
            { rack: DEMO_RACK, report: wrong, note: `${shallowCase.usableDepthMm} mm usable, front rails only` },
            { rack: DEMO_RACK_FIXED, report: right, note: `${touringCase.usableDepthMm} mm usable, front and rear rails` },
          ].map(({ rack, report, note }) => (
            <article key={rack.name} className="panel p-3">
              <header className="flex flex-wrap items-start justify-between gap-2 pb-3">
                <div>
                  <h3 className="font-display text-lg font-semibold uppercase tracking-[0.04em] leading-none">
                    {rack.name}
                  </h3>
                  <p className="num legend mt-1">
                    {rack.case.rackUnits}U · {note}
                  </p>
                </div>
                <Verdict errors={report.errors} warnings={report.warnings} />
              </header>
              <MiniRack rack={rack} results={report.results} />
              <dl className="num mt-3 grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-xs sm:grid-cols-4">
                <div>
                  <dt className="legend">gross</dt>
                  <dd>{report.budget.grossWeightLb ?? "—"} lb</dd>
                </div>
                <div>
                  <dt className="legend">steady</dt>
                  <dd>{report.budget.totalTypicalW} W</dd>
                </div>
                <div>
                  <dt className="legend">heat</dt>
                  <dd>{report.budget.heatWPerRu} W/U</dd>
                </div>
                <div>
                  <dt className="legend">deepest</dt>
                  <dd>{report.budget.maxRequiredDepthMm ?? "—"} mm</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <CheckPanel results={wrong.results} title="Fly pack — 6U shallow" />
          <CheckPanel results={right.results} title="Touring rack — 8U, 24&quot; rails" />
        </div>
      </section>

      {/* Depth ledger */}
      <section className="mt-14">
        <header className="border-b border-line pb-2">
          <h2 className="font-display text-2xl font-semibold uppercase tracking-[0.04em]">
            Depth, term by term
          </h2>
          <p className="mt-1 max-w-[70ch] text-sm text-muted">
            The deepest unit in this list needs {deepest} mm behind the front rails. The shallow
            case has {shallowCase.usableDepthMm} mm. Connector projection is measured to the back
            of the mated plug; bend allowance is set by the stiffest cable on the unit, so one
            DB25 loom sets the figure for the whole box.
          </p>
        </header>

        <div className="table-scroll mt-4 panel">
          <table className="w-full min-w-[46rem] border-collapse text-sm">
            <thead>
              <tr className="bg-sunken text-left">
                <th className="legend px-3 py-2 font-normal">Unit</th>
                <th className="legend px-3 py-2 text-right font-normal">Chassis</th>
                <th className="legend px-3 py-2 text-right font-normal">Mated connector</th>
                <th className="legend px-3 py-2 text-right font-normal">Cable bend</th>
                <th className="legend px-3 py-2 text-right font-normal">Needs</th>
                <th className="legend px-3 py-2 text-right font-normal">
                  {shallowCase.rackUnits}U shallow
                </th>
                <th className="legend px-3 py-2 text-right font-normal">
                  {touringCase.rackUnits}U touring
                </th>
              </tr>
            </thead>
            <tbody>
              {depthRows.map(({ device, depth }) => {
                const need = depth.requiredMm;
                const shallowHead = need == null ? null : shallowCase.usableDepthMm - need;
                const touringHead = need == null ? null : touringCase.usableDepthMm - need;
                return (
                  <tr key={device.id} className="border-t border-line">
                    <td className="px-3 py-2">
                      <span className="font-display text-sm font-semibold uppercase tracking-[0.04em]">
                        {device.model}
                      </span>
                      <span className="legend ml-2">{device.brand}</span>
                    </td>
                    <td className="num px-3 py-2 text-right font-mono">
                      {depth.chassisMm ?? "—"}
                    </td>
                    <td className="num px-3 py-2 text-right font-mono">
                      {depth.connectorMm}
                      <span className="text-faint"> {depth.drivenBy ?? "none"}</span>
                    </td>
                    <td className="num px-3 py-2 text-right font-mono">{depth.bendMm}</td>
                    <td className="num px-3 py-2 text-right font-mono font-semibold">
                      {need ?? "—"}
                    </td>
                    <td
                      className={`num px-3 py-2 text-right font-mono ${
                        shallowHead == null ? "" : shallowHead < 0 ? "text-err" : "text-ok"
                      }`}
                    >
                      {shallowHead == null
                        ? "—"
                        : shallowHead < 0
                          ? `short ${Math.abs(shallowHead)}`
                          : `+${shallowHead}`}
                    </td>
                    <td
                      className={`num px-3 py-2 text-right font-mono ${
                        touringHead == null ? "" : touringHead < 0 ? "text-err" : "text-ok"
                      }`}
                    >
                      {touringHead == null
                        ? "—"
                        : touringHead < 0
                          ? `short ${Math.abs(touringHead)}`
                          : `+${touringHead}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted">All figures in millimetres.</p>
      </section>

      {/* What else gets checked */}
      <section className="mt-14">
        <header className="border-b border-line pb-2">
          <h2 className="font-display text-2xl font-semibold uppercase tracking-[0.04em]">
            What else the checker runs
          </h2>
        </header>
        <div className="mt-4 grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              title: "Circuit load after the derate",
              body: `A 15 A / 120 V branch is an 1800 W breaker, but a continuous load may only use 80% of it — 1440 W. Circuit B on the touring rack sits at ${right.budget.circuits[1]?.typicalW ?? "—"} W steady.`,
            },
            {
              title: "Inrush at power-up",
              body: `Steady draw is not the failure. Worst-case startup on circuit B — one supply inrushing while the rest sit steady — reaches ${right.budget.circuits[1]?.inrushW ?? "—"} W against the ${right.budget.circuits[1]?.peakCapacityW ?? "—"} W breaker.`,
            },
            {
              title: "Centre of gravity",
              body: `Loaded, the touring rack's centre of gravity sits ${right.budget.cogMm ?? "—"} mm above the bottom rail, ${Math.round((right.budget.cogFraction ?? 0) * 100)}% of its height. Past about 55% a case on casters wants to go over on a ramp.`,
            },
            {
              title: "Heat the case cannot shed",
              body: `${wrong.budget.heatW} W over ${wrong.budget.unitsTotal}U is ${wrong.budget.heatWPerRu} W/U in the fly pack, past what a closed case sheds on its own. The fan panel in the touring rack brings it to ${right.budget.heatWPerRu} W/U.`,
            },
            {
              title: "Rack-unit collisions",
              body: "Two units claiming U4, or a 2U unit starting at U8 of an 8U case. Obvious on a drawing, easy to miss in a spreadsheet of positions.",
            },
            {
              title: "Mounting and rear support",
              body: `The shallow case has no rear rails. Anything over ${REAR_SUPPORT_DEPTH_MM} mm deep or ${REAR_SUPPORT_WEIGHT_LB} lb hanging on its front ears will flex a panel in transit.`,
            },
          ].map((item) => (
            <article key={item.title} className="bg-surface p-4">
              <h3 className="font-display text-base font-semibold uppercase tracking-[0.04em]">
                {item.title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-14 border-t border-line pt-6">
        <h2 className="font-display text-xl font-semibold uppercase tracking-[0.04em]">
          Load the touring rack and start moving things
        </h2>
        <p className="mt-1 max-w-[60ch] text-sm text-muted">
          The planner starts from the 8U build above, with the full catalog beside it. Every drag
          re-runs the checks.
        </p>
        <Link
          href="/planner"
          className="mt-4 inline-block border border-accent bg-accent px-4 py-2 font-mono text-xs uppercase tracking-legend text-accent-ink"
        >
          Open the planner
        </Link>
      </section>
    </main>
  );
}
