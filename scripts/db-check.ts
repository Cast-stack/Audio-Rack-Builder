/**
 * Prove a rack survives a round trip through Postgres.
 *
 *   npm run db:check
 *
 * Nothing in this project has ever been written to a real database, and the
 * Placement table has gained a dimension three times: `slot`, then `bay`, then
 * `mount`. Each time, the same bug was waiting — a column missing from the
 * schema, or a field dropped by the mapper — and each time it would have
 * collapsed two physically different positions into one. The engine's tests
 * cannot see any of it, because the engine never touches Prisma.
 *
 * So this writes a rack that uses every dimension at once: a full-width unit,
 * a half-rack pair sharing one U, a unit in the second bay, and a unit on the
 * rear rails behind another. It reads the rack back through toRackSpec() — the
 * one seam between Prisma and the engine — and checks that every placement
 * came back exactly as it went in.
 *
 * It creates its own case and devices, and deletes everything it made, so it
 * is safe to run against a database with real data in it and safe to re-run.
 * It is not part of `npm test`: that suite is offline and fast by design.
 */

import { PrismaClient } from "@prisma/client";

import { toRackSpec } from "../src/lib/db/mappers";
import type { PlacementSpec } from "../src/lib/rack/types";

const TAG = "dbcheck-tmp";

/** Every dimension of a placement, exercised at once. */
const WANT: PlacementSpec[] = [
  { deviceId: "full", bay: 1, position: 1, slot: "full", mount: "front", circuit: "A" },
  { deviceId: "half", bay: 1, position: 2, slot: "left", mount: "front", circuit: "A" },
  { deviceId: "half", bay: 1, position: 2, slot: "right", mount: "front", circuit: "B" },
  { deviceId: "full", bay: 2, position: 2, slot: "full", mount: "front", circuit: "B" },
  // The one that matters most: same bay, same U, same half as the first row,
  // and a different set of rails. If mount is dropped anywhere between here
  // and the database, this row and the first collapse into one.
  { deviceId: "full", bay: 1, position: 1, slot: "full", mount: "rear", circuit: null },
];

const prisma = new PrismaClient();

async function cleanup(): Promise<void> {
  await prisma.rack.deleteMany({ where: { name: TAG } });
  await prisma.device.deleteMany({ where: { slug: { startsWith: `${TAG}-` } } });
  await prisma.rackCase.deleteMany({ where: { slug: `${TAG}-case` } });
  await prisma.category.deleteMany({ where: { slug: `${TAG}-cat` } });
  await prisma.manufacturer.deleteMany({ where: { slug: `${TAG}-maker` } });
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set. Put the Supabase pooled string in .env.local.");
    process.exit(2);
  }

  let failures = 0;
  const fail = (message: string) => {
    failures++;
    console.error(`FAIL ${message}`);
  };

  await cleanup();

  const rackCase = await prisma.rackCase.create({
    data: {
      slug: `${TAG}-case`,
      name: "Round-trip case",
      rackUnits: 8,
      bays: 2,
      usableDepthMm: 610,
      hasRearRails: true,
      maxLoadLb: 200,
      emptyWeightLb: 40,
    },
  });

  // A Device hangs off a Manufacturer and a Category, so the throwaway gear
  // needs throwaway parents. Both are cleaned up with everything else.
  const manufacturer = await prisma.manufacturer.create({
    data: { slug: `${TAG}-maker`, name: "Round Trip" },
  });
  const category = await prisma.category.create({
    data: { slug: `${TAG}-cat`, name: "Round Trip Interface", domain: "AUDIO" as never },
  });

  const made: Record<string, string> = {};
  for (const [key, formFactor] of [["full", "FULL_RACK"], ["half", "HALF_RACK"]] as const) {
    const device = await prisma.device.create({
      data: {
        slug: `${TAG}-${key}`,
        manufacturerId: manufacturer.id,
        categoryId: category.id,
        model: key === "full" ? "Full unit" : "Half unit",
        description: "Throwaway device for the round-trip check.",
        formFactor: formFactor as never,
        rackUnits: 1,
        depthMm: 150,
        weightLb: 5,
      },
    });
    made[key] = device.id;
  }

  const rack = await prisma.rack.create({
    data: {
      name: TAG,
      slug: `${TAG}-rack`,
      caseId: rackCase.id,
      circuits: [
        { label: "A", volts: 120, amps: 20 },
        { label: "B", volts: 120, amps: 15 },
      ] as never,
      placements: {
        create: WANT.map((p) => ({
          deviceId: made[p.deviceId]!,
          bay: p.bay ?? 1,
          position: p.position,
          slot: p.slot ?? "full",
          mount: p.mount ?? "front",
          circuit: p.circuit,
        })),
      },
    },
  });

  const row = await prisma.rack.findUniqueOrThrow({
    where: { id: rack.id },
    include: { case: true, placements: true },
  });
  const spec = toRackSpec(row);

  console.log(`wrote ${WANT.length} placements, read back ${spec.placements.length}`);

  if (spec.placements.length !== WANT.length) {
    fail(`placement count: wrote ${WANT.length}, read ${spec.placements.length}`);
  }

  const key = (p: PlacementSpec, deviceId: string) =>
    `${deviceId}|${p.bay ?? 1}|${p.position}|${p.slot ?? "full"}|${p.mount ?? "front"}|${p.circuit ?? "-"}`;

  const back = new Set(spec.placements.map((p) => key(p, p.deviceId)));
  for (const p of WANT) {
    const expected = key(p, made[p.deviceId]!);
    if (!back.has(expected)) fail(`placement did not survive: ${expected}`);
  }

  // The case, too: bays and rear rails are read on every depth and collision check.
  if (spec.case.bays !== 2) fail(`case bays: expected 2, read ${spec.case.bays}`);
  if (spec.case.hasRearRails !== true) fail("case hasRearRails came back false");
  if (spec.case.usableDepthMm !== 610) fail(`usable depth: read ${spec.case.usableDepthMm}`);
  if (spec.circuits.length !== 2) fail(`circuits: expected 2, read ${spec.circuits.length}`);

  await cleanup();

  if (failures) {
    console.error(`\n${failures} problem(s). The database and the engine disagree about this rack.`);
    process.exit(1);
  }
  console.log("every placement survived, with its bay, half, rails and circuit intact");
}

main()
  .catch(async (error) => {
    console.error(error instanceof Error ? error.message : error);
    await cleanup().catch(() => {});
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
