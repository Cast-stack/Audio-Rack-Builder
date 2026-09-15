import { portProjectionMm, requiredDepth } from "@/lib/rack/geometry";
import type { DeviceSpec, PortSpec } from "@/lib/rack/types";

/**
 * One device, spec by spec, with the line of the datasheet each figure came
 * from sitting on the same row as the figure.
 *
 * The provenance column is not decoration: a rack tech planning a build needs
 * to know that 144 W was calculated from a printed current drain and that
 * 8.15 lb was printed as such. Hovering or tabbing to a source reveals the
 * verbatim quote and how it was read.
 */

export interface SpecProvenance {
  field: string;
  sourceUrl: string;
  quote: string;
  confidence: number;
  derivation: string | null;
}

export interface DeviceSpecsProps {
  device: DeviceSpec;
  provenance?: SpecProvenance[];
  className?: string;
}

const DERIVED = /derived|not printed|not published|psu rating/i;

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "source";
  }
}

function mm(v: number | null): string {
  return v == null ? "—" : `${v} mm`;
}

function Confidence({ value }: { value: number }) {
  const filled = Math.max(1, Math.min(5, Math.round(value * 5)));
  return (
    <span className="inline-flex items-center gap-1" title={`confidence ${value.toFixed(2)}`}>
      <span aria-hidden className="inline-flex gap-[2px]">
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className={`inline-block h-2.5 w-[3px] ${i < filled ? "bg-accent" : "bg-line"}`}
          />
        ))}
      </span>
      <span className="num font-mono text-[0.6875rem] text-muted">{value.toFixed(2)}</span>
    </span>
  );
}

function SourceCell({ entry }: { entry: SpecProvenance | undefined }) {
  if (!entry) {
    return <span className="legend text-faint">no source on file</span>;
  }
  const derived = entry.derivation != null && DERIVED.test(entry.derivation);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <a
          href={entry.sourceUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="font-mono text-[0.6875rem] uppercase tracking-legend text-accent underline decoration-dotted underline-offset-4"
        >
          {hostOf(entry.sourceUrl)}
        </a>
        <Confidence value={entry.confidence} />
        {derived ? (
          <span className="border border-warn bg-warn-wash px-1 py-px font-mono text-[0.5625rem] uppercase tracking-legend text-warn">
            derived
          </span>
        ) : null}
      </div>
      <div className="prov-reveal">
        <div>
          <blockquote className="mt-1 border-l-2 border-accent bg-sunken px-2 py-1.5 text-[0.8125rem] leading-snug text-ink">
            &ldquo;{entry.quote}&rdquo;
          </blockquote>
          {entry.derivation ? (
            <p className="mt-1 px-2 pb-1.5 text-[0.75rem] leading-snug text-muted">
              <span className="legend mr-1.5">read as</span>
              {entry.derivation}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function SpecRow({
  label,
  value,
  note,
  entry,
  hasProvenance,
}: {
  label: string;
  value: string;
  note?: string;
  entry?: SpecProvenance | undefined;
  hasProvenance: boolean;
}) {
  return (
    <tr className="prov-row border-t border-line align-top">
      <th scope="row" className="w-[9rem] px-3 py-2 text-left">
        <span className="legend">{label}</span>
      </th>
      <td className="num px-3 py-2 font-mono text-sm">
        {value}
        {note ? <div className="mt-0.5 font-body text-xs text-muted">{note}</div> : null}
      </td>
      {hasProvenance ? (
        <td className="px-3 py-2">
          <SourceCell entry={entry} />
        </td>
      ) : null}
    </tr>
  );
}

function PortTable({ ports, face }: { ports: PortSpec[]; face: "front" | "rear" }) {
  const rows = ports.filter((p) => p.face === face);
  if (rows.length === 0) return null;
  const total = rows.reduce((s, p) => s + p.count, 0);
  return (
    <div>
      <h4 className="legend mb-1 flex items-baseline gap-2 text-muted">
        {face} panel
        <span className="num text-faint">
          {total} {total === 1 ? "connector" : "connectors"}
        </span>
      </h4>
      <div className="table-scroll border border-line">
        <table className="w-full min-w-[34rem] border-collapse text-sm">
          <thead>
            <tr className="bg-sunken text-left">
              <th className="legend px-2 py-1.5 font-normal">Label</th>
              <th className="legend px-2 py-1.5 font-normal">Connector</th>
              <th className="legend px-2 py-1.5 font-normal">Dir</th>
              <th className="legend px-2 py-1.5 font-normal">Signal</th>
              <th className="legend px-2 py-1.5 text-right font-normal">Ch</th>
              <th className="legend px-2 py-1.5 text-right font-normal">Qty</th>
              <th className="legend px-2 py-1.5 text-right font-normal">Proj.</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p, i) => (
              <tr key={`${p.label}-${i}`} className="border-t border-line">
                <td className="px-2 py-1.5">{p.label}</td>
                <td className="px-2 py-1.5 font-mono text-[0.8125rem]">{p.connector}</td>
                <td className="px-2 py-1.5 font-mono text-[0.75rem] uppercase text-muted">
                  {p.direction === "bidirectional" ? "i/o" : p.direction === "input" ? "in" : "out"}
                </td>
                <td className="px-2 py-1.5 text-muted">{p.signal}</td>
                <td className="num px-2 py-1.5 text-right font-mono">{p.channels ?? "—"}</td>
                <td className="num px-2 py-1.5 text-right font-mono">{p.count}</td>
                <td className="num px-2 py-1.5 text-right font-mono">
                  {face === "rear" ? `${portProjectionMm(p)} mm` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function DeviceSpecs({ device, provenance, className = "" }: DeviceSpecsProps) {
  const hasProvenance = provenance != null && provenance.length > 0;
  const byField = new Map<string, SpecProvenance>();
  for (const p of provenance ?? []) {
    if (!byField.has(p.field)) byField.set(p.field, p);
  }

  const depth = requiredDepth(device);
  const powerTypical =
    device.powerTypicalW == null ? "—" : `${device.powerTypicalW} W`;
  const powerMax = device.powerMaxW == null ? "—" : `${device.powerMaxW} W`;

  return (
    <article className={`panel ${className}`}>
      <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-b border-line px-3 py-2.5">
        <div>
          <p className="legend">{device.brand}</p>
          <h3 className="font-display text-xl font-semibold uppercase leading-none tracking-[0.04em]">
            {device.model}
          </h3>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="border border-line bg-sunken px-1.5 py-0.5 font-mono text-[0.625rem] uppercase tracking-legend text-muted">
            {device.category}
          </span>
          <span className="num border border-line-strong px-1.5 py-0.5 font-mono text-[0.625rem] uppercase tracking-legend">
            {device.rackUnits}U
          </span>
          {device.passive ? (
            <span className="border border-line bg-sunken px-1.5 py-0.5 font-mono text-[0.625rem] uppercase tracking-legend text-muted">
              passive
            </span>
          ) : null}
          {device.poePowered ? (
            <span className="border border-line bg-sunken px-1.5 py-0.5 font-mono text-[0.625rem] uppercase tracking-legend text-muted">
              PoE
            </span>
          ) : null}
        </div>
      </header>

      <div className="table-scroll">
        <table className="w-full min-w-[30rem] border-collapse text-left">
          <caption className="sr-only">
            {device.brand} {device.model} specifications
            {hasProvenance ? ", with the source of each figure" : ""}
          </caption>
          <tbody>
            <SpecRow
              label="Rack units"
              value={`${device.rackUnits} U`}
              entry={byField.get("rackUnits")}
              hasProvenance={hasProvenance}
            />
            <SpecRow
              label="Chassis depth"
              value={mm(device.depthMm)}
              note={
                device.depthIsOverall
                  ? "Published as an overall dimension, so it includes front-panel projections."
                  : "Published as depth behind the rails."
              }
              entry={byField.get("depthMm")}
              hasProvenance={hasProvenance}
            />
            <tr className="prov-row border-t border-line align-top">
              <th scope="row" className="px-3 py-2 text-left">
                <span className="legend">Depth needed</span>
              </th>
              <td className="px-3 py-2" colSpan={hasProvenance ? 2 : 1}>
                <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 font-mono text-sm">
                  <span className="num">{mm(depth.chassisMm)}</span>
                  <span className="text-faint">chassis</span>
                  <span className="text-faint">+</span>
                  <span className="num">{depth.connectorMm} mm</span>
                  <span className="text-faint">
                    {depth.drivenBy ? `mated ${depth.drivenBy}` : "no rear connectors"}
                  </span>
                  <span className="text-faint">+</span>
                  <span className="num">{depth.bendMm} mm</span>
                  <span className="text-faint">cable bend</span>
                  <span className="text-faint">=</span>
                  <span className="num border-b-2 border-accent pb-px font-semibold">
                    {mm(depth.requiredMm)}
                  </span>
                </div>
                <p className="mt-1 max-w-[56ch] text-xs text-muted">
                  What the case has to give this unit behind the front rails. The published
                  depth is only the first term.
                </p>
              </td>
            </tr>
            <SpecRow
              label="Weight"
              value={device.weightLb == null ? "—" : `${device.weightLb} lb`}
              entry={byField.get("weightLb")}
              hasProvenance={hasProvenance}
            />
            <SpecRow
              label="Power, steady"
              value={powerTypical}
              note={
                device.powerTypicalW == null && device.powerMaxW != null
                  ? "Not published; the budget falls back to the nameplate figure."
                  : undefined
              }
              entry={byField.get("powerTypicalW")}
              hasProvenance={hasProvenance}
            />
            <SpecRow
              label="Power, max"
              value={powerMax}
              entry={byField.get("powerMaxW")}
              hasProvenance={hasProvenance}
            />
            <SpecRow
              label="Inrush factor"
              value={`${device.inrushFactor.toFixed(2)} ×`}
              note={
                device.inrushFactor > 1
                  ? `Worst-case startup draw is ${device.inrushFactor.toFixed(2)} times steady state.`
                  : "No startup surge budgeted."
              }
              entry={byField.get("inrushFactor")}
              hasProvenance={hasProvenance}
            />
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 border-t border-line px-3 py-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h4 className="font-display text-sm font-semibold uppercase tracking-[0.06em]">
            Connectors
          </h4>
          {hasProvenance && byField.get("ports") ? (
            <div className="prov-row max-w-full">
              <SourceCell entry={byField.get("ports")} />
            </div>
          ) : null}
        </div>
        {device.ports.length === 0 ? (
          <p className="text-sm text-muted">No connectors — a blank, vent or shelf panel.</p>
        ) : (
          <>
            <PortTable ports={device.ports} face="rear" />
            <PortTable ports={device.ports} face="front" />
          </>
        )}
      </div>
    </article>
  );
}
