import type { Metadata } from "next";
import RackPlanner from "@/components/RackPlanner";
import type { DeviceSpec } from "@/lib/rack/types";
import { DEMO_RACK_FIXED, SEED_DEVICES } from "@/lib/seed-data";

export const metadata: Metadata = {
  title: "Planner — Audio Rack Builder",
  description:
    "Drag units into an 8U touring rack and watch depth, circuit load, inrush, balance and heat re-check on every move.",
};

// The catalog the planner can place from. Plain DeviceSpec — no database.
const catalog: DeviceSpec[] = SEED_DEVICES;

export default function PlannerPage() {
  return (
    <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6">
      <header className="mb-5">
        <p className="legend">Working build</p>
        <h1 className="mt-1 font-display text-3xl font-bold uppercase leading-none tracking-[0.02em]">
          Planner
        </h1>
        <p className="mt-2 max-w-[68ch] text-sm leading-relaxed text-muted">
          Loaded with the touring rack from the front page. Move a unit, change what circuit it
          is on, or pull something out, and the feasibility report and the budget rail recompute
          from the placements — depth behind the rails, load against the derated breaker, the
          worst-case power-up, centre of gravity and heat per rack unit.
        </p>
      </header>

      <RackPlanner rack={DEMO_RACK_FIXED} devices={catalog} />
    </main>
  );
}
