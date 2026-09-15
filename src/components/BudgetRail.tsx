import { CONTINUOUS_DERATE, PASSIVE_THERMAL_W_PER_RU, type RackBudget } from "@/lib/rack/budget";
import { COG_WARN_FRACTION } from "@/lib/rack/checks";

/**
 * The running totals rail.
 *
 * A missing figure is printed as an em dash, never as zero: "no published
 * wattage" and "draws nothing" are different facts and the rail must not blur
 * them. Every number is tabular so columns of figures line up while dragging.
 */

function fig(value: number | null | undefined, digits = 0): string {
  if (value == null || Number.isNaN(value)) return "—";
  return value.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function pct(fraction: number | null): string {
  if (fraction == null) return "—";
  return `${Math.round(fraction * 100)}%`;
}

function Row({
  label,
  value,
  unit,
  tone = "ink",
}: {
  label: string;
  value: string;
  unit?: string;
  tone?: "ink" | "muted" | "err" | "warn" | "ok";
}) {
  const toneClass =
    tone === "err"
      ? "text-err"
      : tone === "warn"
        ? "text-warn"
        : tone === "ok"
          ? "text-ok"
          : tone === "muted"
            ? "text-muted"
            : "text-ink";
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="legend">{label}</span>
      <span className={`num font-mono text-sm ${toneClass}`}>
        {value}
        {unit ? <span className="text-faint"> {unit}</span> : null}
      </span>
    </div>
  );
}

function Block({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line px-3 py-2.5 first:border-t-0">
      <h3 className="legend mb-1.5 text-muted">{heading}</h3>
      {children}
    </section>
  );
}

export interface BudgetRailProps {
  budget: RackBudget;
  className?: string;
}

export default function BudgetRail({ budget, className = "" }: BudgetRailProps) {
  const fillFraction =
    budget.unitsTotal > 0 ? Math.min(1, budget.unitsUsed / budget.unitsTotal) : 0;

  const depthHeadroom =
    budget.maxRequiredDepthMm == null ? null : budget.usableDepthMm - budget.maxRequiredDepthMm;

  const cogHigh = budget.cogFraction != null && budget.cogFraction > COG_WARN_FRACTION;
  const heatHigh = budget.heatWPerRu > PASSIVE_THERMAL_W_PER_RU;

  return (
    <aside className={`panel ${className}`} aria-label="Rack budget">
      <header className="border-b border-line px-3 py-2">
        <h2 className="font-display text-base font-semibold uppercase tracking-[0.06em]">
          Budget
        </h2>
      </header>

      <Block heading="Space">
        <div
          className="relative h-2 w-full border border-line bg-sunken"
          role="img"
          aria-label={`${budget.unitsUsed} of ${budget.unitsTotal} rack units used`}
        >
          <div
            className="absolute inset-y-0 left-0 bg-accent"
            style={{ width: `${fillFraction * 100}%` }}
          />
        </div>
        <div className="mt-1.5">
          <Row label="Used" value={`${fig(budget.unitsUsed)} / ${fig(budget.unitsTotal)}`} unit="U" />
          <Row
            label="Free"
            value={fig(budget.unitsFree)}
            unit="U"
            tone={budget.unitsFree <= 0 ? "warn" : "muted"}
          />
        </div>
      </Block>

      <Block heading="Weight">
        <Row label="Gear" value={fig(budget.weightLb, 1)} unit="lb" />
        <Row label="Gross, with case" value={fig(budget.grossWeightLb, 1)} unit="lb" tone="muted" />
      </Block>

      <Block heading="Balance">
        <div className="relative mt-1 h-7 w-full border border-line bg-sunken">
          {/* Tip-over threshold from checks.ts */}
          <div
            className="absolute inset-y-0 w-px bg-warn"
            style={{ left: `${COG_WARN_FRACTION * 100}%` }}
            aria-hidden
          />
          <div
            className="absolute inset-y-0 left-0 bg-line"
            style={{ width: `${(budget.cogFraction ?? 0) * 100}%` }}
            aria-hidden
          />
          {budget.cogFraction != null ? (
            <div
              className={`absolute inset-y-0 w-0.5 ${cogHigh ? "bg-warn" : "bg-accent"}`}
              style={{ left: `calc(${Math.min(1, budget.cogFraction) * 100}% - 1px)` }}
              aria-hidden
            />
          ) : null}
        </div>
        <div className="mt-1 flex justify-between">
          <span className="legend">bottom rail</span>
          <span className="legend text-warn">tip risk {pct(COG_WARN_FRACTION)}</span>
          <span className="legend">top</span>
        </div>
        <div className="mt-1.5">
          <Row
            label="Centre of gravity"
            value={fig(budget.cogMm)}
            unit="mm"
            tone={cogHigh ? "warn" : "ink"}
          />
          <Row
            label="Of rack height"
            value={pct(budget.cogFraction)}
            tone={cogHigh ? "warn" : "muted"}
          />
        </div>
      </Block>

      <Block heading="Depth">
        <Row
          label="Deepest unit needs"
          value={fig(budget.maxRequiredDepthMm)}
          unit="mm"
          tone={depthHeadroom != null && depthHeadroom < 0 ? "err" : "ink"}
        />
        <Row label="Case usable" value={fig(budget.usableDepthMm)} unit="mm" tone="muted" />
        <Row
          label="Headroom"
          value={depthHeadroom == null ? "—" : `${depthHeadroom > 0 ? "+" : ""}${fig(depthHeadroom)}`}
          unit="mm"
          tone={depthHeadroom == null ? "muted" : depthHeadroom < 0 ? "err" : depthHeadroom < 25 ? "warn" : "ok"}
        />
      </Block>

      <Block heading="Power">
        {budget.circuits.length === 0 ? (
          <p className="text-sm text-muted">No circuits defined on this rack.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {budget.circuits.map((load) => {
              const peak = load.peakCapacityW || 1;
              const steadyFrac = Math.min(1, load.typicalW / peak);
              const inrushFrac = Math.min(1, load.inrushW / peak);
              const overContinuous = load.typicalW > load.capacityW;
              const nearLimit = !overContinuous && load.utilization > 0.85;
              const inrushTrips = load.inrushW > load.peakCapacityW;
              const barTone = overContinuous ? "bg-err" : nearLimit ? "bg-warn" : "bg-ok";

              return (
                <li key={load.circuit.label}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-mono text-xs font-medium uppercase tracking-legend">
                      {load.circuit.label}
                      <span className="num ml-2 text-faint">
                        {fig(load.circuit.amps)} A / {fig(load.circuit.volts)} V
                      </span>
                    </span>
                    <span
                      className={`num font-mono text-sm ${
                        overContinuous ? "text-err" : nearLimit ? "text-warn" : "text-ink"
                      }`}
                    >
                      {fig(load.typicalW, 1)}
                      <span className="text-faint"> / {fig(load.capacityW)} W</span>
                    </span>
                  </div>

                  <div
                    className="relative mt-1 h-4 w-full border border-line bg-sunken"
                    role="img"
                    aria-label={`${load.circuit.label}: ${load.typicalW} watts steady against ${load.capacityW} watts usable, worst-case start ${load.inrushW} watts against a ${load.peakCapacityW} watt breaker`}
                  >
                    <div
                      className={`absolute inset-y-0 left-0 ${barTone}`}
                      style={{ width: `${steadyFrac * 100}%` }}
                    />
                    {/* NEC 80% continuous line. */}
                    <div
                      className="absolute inset-y-0 border-l border-dashed border-line-strong"
                      style={{ left: `${CONTINUOUS_DERATE * 100}%` }}
                      aria-hidden
                    />
                    {/* Worst-case power-up. */}
                    <div
                      className={`absolute -top-0.5 h-[calc(100%+4px)] w-0.5 ${
                        inrushTrips ? "bg-err" : "bg-ink"
                      }`}
                      style={{ left: `calc(${inrushFrac * 100}% - 1px)` }}
                      aria-hidden
                    />
                  </div>

                  <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-3">
                    <span className="legend">
                      start peak{" "}
                      <span className={`num ${inrushTrips ? "text-err" : "text-ink"}`}>
                        {fig(load.inrushW, 1)} W
                      </span>{" "}
                      of {fig(load.peakCapacityW)} W breaker
                    </span>
                    <span className="num legend">{pct(load.utilization)} of usable</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-2 border-t border-line pt-1.5">
          <Row label="Total steady" value={fig(budget.totalTypicalW, 1)} unit="W" />
          <Row label="Total nameplate" value={fig(budget.totalMaxW, 1)} unit="W" tone="muted" />
          {budget.unassignedDeviceIds.length > 0 ? (
            <Row
              label="Not on a circuit"
              value={fig(budget.unassignedDeviceIds.length)}
              unit={budget.unassignedDeviceIds.length === 1 ? "unit" : "units"}
              tone="warn"
            />
          ) : null}
        </div>
      </Block>

      <Block heading="Heat">
        <Row label="To shed" value={fig(budget.heatW, 1)} unit="W" />
        <Row
          label="Per rack unit"
          value={fig(budget.heatWPerRu, 1)}
          unit="W/U"
          tone={heatHigh && !budget.hasForcedAir ? "warn" : "ink"}
        />
        <Row
          label="Passive ceiling"
          value={fig(PASSIVE_THERMAL_W_PER_RU)}
          unit="W/U"
          tone="muted"
        />
        <Row
          label="Forced air"
          value={budget.hasForcedAir ? "Fan panel fitted" : "None"}
          tone={budget.hasForcedAir ? "ok" : heatHigh ? "warn" : "muted"}
        />
      </Block>
    </aside>
  );
}
