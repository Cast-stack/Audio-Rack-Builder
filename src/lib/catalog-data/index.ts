/**
 * Gear researched from manufacturer documents and verified before import.
 *
 * researched.json holds the raw ResearchResult records — exactly what the
 * research agents emitted and the checker passed — rather than converted
 * devices. Keeping the raw form means the record a person reviewed is the
 * record that ships, and the conversion to something the engine can place
 * happens in one tested function, toCatalogDevice(), on the way in.
 *
 * To add gear: run it through scripts/check-research.ts, review it, append it
 * to researched.json. researched.test.ts re-checks every record on every test
 * run, so a hand edit that breaks a rule fails the build.
 */

import type { ResearchResult } from "@/lib/gear/schema";
import { toCatalogDevice } from "@/lib/gear/toDeviceSpec";
import type { SeedDevice } from "@/lib/seed-data";

import records from "./researched.json";

export const RESEARCHED_RECORDS = records as unknown as ResearchResult[];

export const RESEARCHED_DEVICES: SeedDevice[] = RESEARCHED_RECORDS.map(
  (r) => toCatalogDevice(r) as unknown as SeedDevice,
);
