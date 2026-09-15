import type { Metadata } from "next";
import DeviceSpecs from "@/components/DeviceSpecs";
import { SEED_DEVICES } from "@/lib/seed-data";

export const metadata: Metadata = {
  title: "Catalog — Audio Rack Builder",
  description:
    "Every device in the catalog, spec by spec, with the manufacturer line each figure was read from and the calculation behind any figure that was derived.",
};

export default function CatalogPage() {
  const devices = [...SEED_DEVICES].sort((a, b) =>
    `${a.brand} ${a.model}`.localeCompare(`${b.brand} ${b.model}`),
  );

  return (
    <main className="mx-auto w-full max-w-[1100px] px-4 py-10 sm:px-6">
      <header>
        <p className="legend">Sourced specs</p>
        <h1 className="mt-2 font-display text-4xl font-bold uppercase leading-[0.95] tracking-[0.01em]">
          Catalog
        </h1>
        <p className="mt-3 max-w-[66ch] text-base leading-relaxed text-muted">
          {devices.length} units. Hover or tab to a source to see the line it was read from. A
          figure marked <span className="border border-warn px-1 font-mono text-[0.625rem] uppercase tracking-legend text-warn">derived</span>{" "}
          was calculated from something adjacent — a current drain, a PSU rating, a chassis height
          — and the calculation is shown with it.
        </p>
      </header>

      <div className="mt-8 flex flex-col gap-8">
        {devices.map((device) => (
          <div key={device.id}>
            <DeviceSpecs device={device} provenance={device.provenance} />
            {device.unresolved.length > 0 ? (
              <details className="panel mt-2 px-3 py-2">
                <summary className="legend cursor-pointer">
                  {device.unresolved.length} open question
                  {device.unresolved.length === 1 ? "" : "s"} on this unit
                </summary>
                <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-sm text-muted">
                  {device.unresolved.map((u) => (
                    <li key={u}>{u}</li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>
        ))}
      </div>
    </main>
  );
}
