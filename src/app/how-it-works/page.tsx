import type { Metadata } from "next";
import Link from "next/link";
import { CONTINUOUS_DERATE, PASSIVE_THERMAL_W_PER_RU } from "@/lib/rack/budget";
import { checkRack, COG_WARN_FRACTION } from "@/lib/rack/checks";
import {
  BEND_ALLOWANCE_MM,
  CONNECTOR_PROJECTION_MM,
  MM_PER_RU,
  requiredDepth,
} from "@/lib/rack/geometry";
import type { DeviceSpec } from "@/lib/rack/types";
import { DEMO_DEVICES, DEMO_RACK, DEMO_RACK_FIXED } from "@/lib/seed-data";

export const metadata: Metadata = {
  title: "How it works — Audio Rack Builder",
  description:
    "The depth arithmetic and the power arithmetic behind the checks, worked through on the demo racks.",
};

const wrong = checkRack(DEMO_RACK, DEMO_DEVICES);
const right = checkRack(DEMO_RACK_FIXED, DEMO_DEVICES);

const sw8 = DEMO_DEVICES.get("radial-sw8");
const ad600 = DEMO_DEVICES.get("shure-ad600");
const circuitB = right.budget.circuits.find((c) => c.circuit.label === "B");

function Term({ value, label }: { value: string; label: string }) {
  return (
    <span className="inline-flex flex-col items-center px-2">
      <span className="num font-mono text-lg font-semibold">{value}</span>
      <span className="legend mt-0.5 text-center">{label}</span>
    </span>
  );
}

function Op({ children }: { children: React.ReactNode }) {
  return <span className="px-1 font-mono text-lg text-faint">{children}</span>;
}

function Section({
  index,
  title,
  lede,
  children,
}: {
  index: string;
  title: string;
  lede: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-12">
      <header className="border-b border-line pb-2">
        <p className="legend">{index}</p>
        <h2 className="mt-1 font-display text-2xl font-semibold uppercase tracking-[0.04em]">
          {title}
        </h2>
        <p className="mt-1.5 max-w-[72ch] text-sm leading-relaxed text-muted">{lede}</p>
      </header>
      {children}
    </section>
  );
}

function powerOf(device: DeviceSpec): number {
  return device.powerTypicalW ?? device.powerMaxW ?? 0;
}

export default function HowItWorksPage() {
  const sw8Depth = sw8 ? requiredDepth(sw8) : null;
  const ad600Depth = ad600 ? requiredDepth(ad600) : null;
  const shallow = DEMO_RACK.case;

  const circuitDevices = (circuitB?.deviceIds ?? [])
    .map((id) => DEMO_DEVICES.get(id))
    .filter((d): d is DeviceSpec => d !== undefined);

  const biggest = circuitDevices.reduce<DeviceSpec | null>(
    (worst, d) =>
      worst == null || powerOf(d) * d.inrushFactor - powerOf(d) > powerOf(worst) * worst.inrushFactor - powerOf(worst)
        ? d
        : worst,
    null,
  );

  return (
    <main className="mx-auto w-full max-w-[1100px] px-4 py-10 sm:px-6">
      <header>
        <p className="legend">Method</p>
        <h1 className="mt-2 font-display text-4xl font-bold uppercase leading-[0.95] tracking-[0.01em]">
          How it works
        </h1>
        <p className="mt-3 max-w-[66ch] text-base leading-relaxed text-muted">
          Two pieces of arithmetic decide most rack builds, and neither of them is the number the
          manufacturer prints. Both are worked through below on the demo racks, with the same
          figures the checker uses.
        </p>
      </header>

      <Section
        index="01"
        title="Depth behind the rails"
        lede="What has to fit is not the chassis. It is the chassis, plus the plug mated into the deepest rear connector, plus the room that cable needs to turn before it hits the back of the case."
      >
        {sw8Depth ? (
          <div className="panel mt-4 p-4">
            <p className="legend">Radial Engineering SW8 in the {shallow.rackUnits}U shallow case</p>
            <div className="table-scroll mt-3">
              <div className="flex min-w-max items-end py-2">
                <Term value={`${sw8Depth.chassisMm ?? "—"} mm`} label="chassis, published" />
                <Op>+</Op>
                <Term value={`${sw8Depth.connectorMm} mm`} label={`mated ${sw8Depth.drivenBy ?? "rear"}`} />
                <Op>+</Op>
                <Term value={`${sw8Depth.bendMm} mm`} label="cable bend" />
                <Op>=</Op>
                <Term value={`${sw8Depth.requiredMm ?? "—"} mm`} label="needed" />
                <Op>vs</Op>
                <Term value={`${shallow.usableDepthMm} mm`} label="case usable" />
              </div>
            </div>
            <p className="mt-2 max-w-[70ch] text-sm leading-relaxed text-muted">
              Short by{" "}
              {sw8Depth.requiredMm == null
                ? "—"
                : Math.abs(shallow.usableDepthMm - sw8Depth.requiredMm)}{" "}
              mm. The SW8 is a 152 mm box — the shallowest unit in the rack. Three DB25 D-subs on
              the rear panel add 70 mm of mated connector, and a DB25 loom is the stiffest cable
              in the build, so it claims the 90 mm bend allowance for the whole device. Nothing
              about the published 6-inch depth predicts that.
            </p>
          </div>
        ) : null}

        {ad600Depth ? (
          <p className="mt-4 max-w-[72ch] text-sm leading-relaxed text-muted">
            The connector term is the <em>deepest single</em> rear connector, not a sum: on the
            Shure AD600 that is the {ad600Depth.drivenBy} at {ad600Depth.connectorMm} mm, not the
            six BNC antenna inputs at {CONNECTOR_PROJECTION_MM["BNC"]} mm.{" "}
            {ad600Depth.chassisMm} + {ad600Depth.connectorMm} + {ad600Depth.bendMm} ={" "}
            {ad600Depth.requiredMm} mm, which is why a 286 mm unit does not go into a 305 mm case
            and does go into a {DEMO_RACK_FIXED.case.usableDepthMm} mm one.
          </p>
        ) : null}

        <div className="mt-6 grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,18rem)]">
          <div>
            <h3 className="legend mb-2">Connector projection, panel face to back of plug</h3>
            <div className="table-scroll panel">
              <table className="w-full min-w-[22rem] border-collapse text-sm">
                <tbody>
                  {Object.entries(CONNECTOR_PROJECTION_MM).map(([connector, value]) => (
                    <tr key={connector} className="border-t border-line first:border-t-0">
                      <td className="px-3 py-1.5 font-mono text-[0.8125rem]">{connector}</td>
                      <td className="num px-3 py-1.5 text-right font-mono">{value} mm</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div>
            <h3 className="legend mb-2">Bend allowance, by stiffest cable</h3>
            <div className="panel">
              <table className="w-full border-collapse text-sm">
                <tbody>
                  {Object.entries(BEND_ALLOWANCE_MM).map(([kind, value]) => (
                    <tr key={kind} className="border-t border-line first:border-t-0">
                      <td className="px-3 py-1.5 font-mono text-[0.8125rem]">{kind}</td>
                      <td className="num px-3 py-1.5 text-right font-mono">{value} mm</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              Working planning numbers, not datasheet values. A device that publishes its own
              connector projection overrides the table. Erring deep costs a larger case; erring
              shallow strands a build on site.
            </p>
          </div>
        </div>
      </Section>

      <Section
        index="02"
        title="Power, after the derate and at power-up"
        lede="A breaker's rating is not a budget. NEC 210.19(A) and 210.20(A) limit a continuous load to 80% of the breaker, and the load that actually trips it is the surge when the rack comes up, not the steady draw."
      >
        {circuitB ? (
          <>
            <div className="panel mt-4 p-4">
              <p className="legend">
                Circuit {circuitB.circuit.label} on the touring rack —{" "}
                {circuitB.circuit.amps} A at {circuitB.circuit.volts} V
              </p>
              <div className="table-scroll mt-3">
                <div className="flex min-w-max items-end py-2">
                  <Term value={`${circuitB.circuit.volts} V`} label="line" />
                  <Op>×</Op>
                  <Term value={`${circuitB.circuit.amps} A`} label="breaker" />
                  <Op>=</Op>
                  <Term value={`${circuitB.peakCapacityW} W`} label="instantaneous ceiling" />
                  <Op>×</Op>
                  <Term value={`${CONTINUOUS_DERATE}`} label="continuous derate" />
                  <Op>=</Op>
                  <Term value={`${circuitB.capacityW} W`} label="usable, continuous" />
                </div>
              </div>

              <div className="table-scroll mt-4">
                <table className="w-full min-w-[34rem] border-collapse text-sm">
                  <thead>
                    <tr className="bg-sunken text-left">
                      <th className="legend px-3 py-1.5 font-normal">On circuit {circuitB.circuit.label}</th>
                      <th className="legend px-3 py-1.5 text-right font-normal">Steady</th>
                      <th className="legend px-3 py-1.5 text-right font-normal">Inrush ×</th>
                      <th className="legend px-3 py-1.5 text-right font-normal">At startup</th>
                    </tr>
                  </thead>
                  <tbody>
                    {circuitDevices.map((d) => (
                      <tr key={d.id} className="border-t border-line">
                        <td className="px-3 py-1.5">
                          <span className="font-display text-sm font-semibold uppercase tracking-[0.04em]">
                            {d.model}
                          </span>
                          <span className="legend ml-2">{d.brand}</span>
                          {d.powerTypicalW == null && d.powerMaxW != null ? (
                            <span className="legend ml-2 text-warn">nameplate, no typical</span>
                          ) : null}
                        </td>
                        <td className="num px-3 py-1.5 text-right font-mono">{powerOf(d)} W</td>
                        <td className="num px-3 py-1.5 text-right font-mono">
                          {d.inrushFactor.toFixed(2)}
                        </td>
                        <td className="num px-3 py-1.5 text-right font-mono">
                          {Math.round(powerOf(d) * d.inrushFactor)} W
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t border-line-strong bg-sunken">
                      <td className="px-3 py-1.5 font-mono text-xs uppercase tracking-legend">
                        Steady total
                      </td>
                      <td className="num px-3 py-1.5 text-right font-mono font-semibold">
                        {circuitB.typicalW} W
                      </td>
                      <td />
                      <td className="num px-3 py-1.5 text-right font-mono font-semibold">
                        {circuitB.inrushW} W
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <p className="mt-3 max-w-[72ch] text-sm leading-relaxed text-muted">
                Worst realistic startup is one unit inrushing while everything else sits steady —{" "}
                {biggest ? `the ${biggest.model}` : "the largest supply"} here, giving{" "}
                {circuitB.typicalW} W minus its {biggest ? powerOf(biggest) : 0} W plus its{" "}
                {biggest ? Math.round(powerOf(biggest) * biggest.inrushFactor) : 0} W surge ={" "}
                {circuitB.inrushW} W, against a {circuitB.peakCapacityW} W breaker. That leaves{" "}
                {Math.round((1 - circuitB.inrushW / circuitB.peakCapacityW) * 100)}% of the
                breaker in hand at doors. Sequenced power exists because this number is often
                negative.
              </p>
            </div>

            <p className="mt-4 max-w-[72ch] text-sm leading-relaxed text-muted">
              Where a manufacturer publishes no steady figure, the checker falls back to the
              nameplate maximum rather than guessing — the AD600&apos;s{" "}
              {DEMO_DEVICES.get("shure-ad600")?.powerMaxW ?? "—"} W is 1.2 A of printed current
              drain at 120 V, and it is carried through the budget as if the unit draws that
              continuously. It is a ceiling, and the spec row says so.
            </p>
          </>
        ) : null}
      </Section>

      <Section
        index="03"
        title="Balance and heat"
        lede="Two numbers that decide whether the rack survives the ramp and the four-hour show."
      >
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="panel p-4">
            <h3 className="font-display text-lg font-semibold uppercase tracking-[0.04em]">
              Centre of gravity
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">
              Each unit&apos;s weight is taken at the middle of its own span, measured up from the
              bottom rail at {MM_PER_RU} mm per U, and the moments are summed. The touring rack
              lands at {right.budget.cogMm ?? "—"} mm of{" "}
              {Math.round(DEMO_RACK_FIXED.case.rackUnits * MM_PER_RU)} mm, or{" "}
              {Math.round((right.budget.cogFraction ?? 0) * 100)}% of rack height. Past{" "}
              {Math.round(COG_WARN_FRACTION * 100)}% a case on casters wants to go over on a ramp,
              which is why the amp and the switcher live at the bottom.
            </p>
          </div>
          <div className="panel p-4">
            <h3 className="font-display text-lg font-semibold uppercase tracking-[0.04em]">
              Thermal load
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">
              Heat is treated as equal to steady draw. Spread over the case, the fly pack runs{" "}
              {wrong.budget.heatWPerRu} W/U against a working ceiling of{" "}
              {PASSIVE_THERMAL_W_PER_RU} W/U for a closed case with no forced air — the point at
              which a rack stops being comfortable to touch after a four-hour show. The touring
              rack&apos;s extra U and its fan panel bring it to {right.budget.heatWPerRu} W/U.
            </p>
          </div>
        </div>
      </Section>

      <Section
        index="04"
        title="Where the numbers come from"
        lede="Every spec in the catalog carries the source line it was read from, the confidence in that reading, and — when the figure was calculated rather than printed — the calculation."
      >
        <p className="mt-4 max-w-[72ch] text-sm leading-relaxed text-muted">
          A derived figure is marked as derived. The AD600&apos;s wattage is the clearest case:
          Shure prints &ldquo;Current Drain 1.2 A&rdquo; and no wattage at all, so the catalog
          carries 144 W with a confidence of 0.6 and the arithmetic attached. Connector projection
          and bend allowance are working allowances from the tables above, not manufacturer data,
          and they are labelled that way wherever they appear.
        </p>
        <Link
          href="/catalog"
          className="mt-4 inline-block border border-accent bg-accent px-4 py-2 font-mono text-xs uppercase tracking-legend text-accent-ink"
        >
          Read the catalog sources
        </Link>
      </Section>
    </main>
  );
}
