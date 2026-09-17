/**
 * Seeds the taxonomy, the starter catalog and two demo racks.
 *
 * Every device is written as a published revision with its provenance rows, so
 * a fresh database has the same shape as one the research pipeline filled —
 * including the honest gaps. The AD600 arrives with no typical wattage and a
 * derived maximum at 0.6 confidence, because that is what Shure publishes.
 *
 *   npx prisma db push && npx tsx prisma/seed.ts
 */

import { PrismaClient, type Prisma } from "@prisma/client";
import { CATEGORIES } from "../src/lib/gear/catalog";
import { classifySource, slugify } from "../src/lib/gear/persist";
import {
  DEMO_RACK,
  DEMO_RACK_FIXED,
  SEED_CASES,
  SEED_DEVICES,
  type SeedDevice,
} from "../src/lib/seed-data";

const prisma = new PrismaClient();

const FORM_FACTOR = {
  "full-rack": "FULL_RACK",
  "half-rack": "HALF_RACK",
  "third-rack": "THIRD_RACK",
  "quarter-rack": "QUARTER_RACK",
  desktop: "DESKTOP",
  accessory: "ACCESSORY",
} as const;

const STATUS = {
  current: "CURRENT",
  discontinued: "DISCONTINUED",
  announced: "ANNOUNCED",
} as const;

async function seedTaxonomy() {
  for (const [i, c] of CATEGORIES.entries()) {
    await prisma.category.upsert({
      where: { name: c.name },
      create: {
        name: c.name,
        slug: c.slug,
        domain: c.domain,
        passive: c.passive ?? false,
        sortKey: i,
      },
      update: { slug: c.slug, domain: c.domain, passive: c.passive ?? false, sortKey: i },
    });
  }
  console.log(`  categories: ${CATEGORIES.length}`);
}

async function seedDevice(d: SeedDevice) {
  const manufacturer = await prisma.manufacturer.upsert({
    where: { name: d.brand },
    create: { name: d.brand, slug: slugify(d.brand), domains: [] },
    update: {},
  });
  const category = await prisma.category.findUniqueOrThrow({ where: { name: d.category } });

  const scalars = {
    slug: d.slug,
    manufacturerId: manufacturer.id,
    categoryId: category.id,
    model: d.model,
    description: d.description,
    formFactor: FORM_FACTOR[d.formFactor],
    rackUnits: d.rackUnits,
    depthMm: d.depthMm,
    depthIsOverall: d.depthIsOverall,
    weightLb: d.weightLb,
    powerTypicalW: d.powerTypicalW,
    powerMaxW: d.powerMaxW,
    inrushFactor: d.inrushFactor,
    poePowered: d.poePowered,
    status: STATUS[d.status],
    statusNote: d.statusNote,
    productUrl: d.productUrl,
    datasheetUrl: d.datasheetUrl,
    verifiedAt: new Date(),
    sourceGrade: grade(d),
  };

  const device = await prisma.device.upsert({
    where: { manufacturerId_model: { manufacturerId: manufacturer.id, model: d.model } },
    create: scalars,
    update: scalars,
  });

  await prisma.port.deleteMany({ where: { deviceId: device.id } });
  if (d.ports.length) {
    await prisma.port.createMany({
      data: d.ports.map((p, i) => ({
        deviceId: device.id,
        label: p.label,
        connector: p.connector,
        direction: p.direction,
        signal: p.signal,
        channels: p.channels,
        count: p.count,
        face: p.face,
        projectionMm: p.projectionMm,
        sortKey: i,
      })),
    });
  }

  // The revision carries the evidence. Without it the catalog is just another
  // list of numbers somebody typed in.
  const revision = await prisma.deviceRevision.create({
    data: {
      deviceId: device.id,
      payload: d as unknown as Prisma.InputJsonValue,
      disposition: "AUTO_PUBLISH",
      unresolved: d.unresolved,
      notes: null,
      createdBy: "seed",
      provenance: {
        create: d.provenance.map((p) => ({
          field: p.field,
          sourceUrl: p.sourceUrl,
          quote: p.quote,
          confidence: p.confidence,
          derivation: p.derivation,
          sourceKind: classifySource(p.sourceUrl),
        })),
      },
    },
  });

  await prisma.device.update({
    where: { id: device.id },
    data: { currentRevisionId: revision.id },
  });

  return device;
}

/** Share of the load-bearing fields carrying a manufacturer citation. */
function grade(d: SeedDevice): number {
  const required = ["rackUnits", "depthMm", "weightLb", "ports"];
  const cited = new Set(
    d.provenance
      .filter((p) => classifySource(p.sourceUrl) === "manufacturer")
      .map((p) => p.field),
  );
  const hit = required.filter((f) => cited.has(f)).length;
  return Math.round((hit / required.length) * 100) / 100;
}

async function seedRack(
  spec: typeof DEMO_RACK,
  slug: string,
  deviceIdBySeedId: Map<string, string>,
) {
  const rackCase = await prisma.rackCase.findUniqueOrThrow({ where: { slug: spec.case.slug } });

  const rack = await prisma.rack.upsert({
    where: { slug },
    create: {
      slug,
      name: spec.name,
      caseId: rackCase.id,
      circuits: spec.circuits as unknown as Prisma.InputJsonValue,
    },
    update: {
      name: spec.name,
      caseId: rackCase.id,
      circuits: spec.circuits as unknown as Prisma.InputJsonValue,
    },
  });

  await prisma.placement.deleteMany({ where: { rackId: rack.id } });
  for (const p of spec.placements) {
    const deviceId = deviceIdBySeedId.get(p.deviceId);
    if (!deviceId) {
      console.warn(`  ! placement skipped, unknown device "${p.deviceId}"`);
      continue;
    }
    await prisma.placement.create({
      data: {
        rackId: rack.id,
        deviceId,
        // bay and slot are normalised on the way in, matching anchorKey()'s
        // `slot ?? "full"`. Seeding them as defaults instead would stack a
        // half-rack pair into one half and invent a collision.
        bay: p.bay ?? 1,
        slot: p.slot ?? "full",
        mount: p.mount ?? "front",
        position: p.position,
        circuit: p.circuit,
        label: p.label ?? null,
      },
    });
  }
  return rack;
}

async function main() {
  console.log("seeding");
  await seedTaxonomy();

  for (const c of SEED_CASES) {
    await prisma.rackCase.upsert({
      where: { slug: c.slug },
      create: {
        slug: c.slug,
        name: c.name,
        rackUnits: c.rackUnits,
        usableDepthMm: c.usableDepthMm,
        hasRearRails: c.hasRearRails,
        maxLoadLb: c.maxLoadLb,
        emptyWeightLb: c.emptyWeightLb,
      },
      update: {},
    });
  }
  console.log(`  cases: ${SEED_CASES.length}`);

  const deviceIdBySeedId = new Map<string, string>();
  for (const d of SEED_DEVICES) {
    const device = await seedDevice(d);
    deviceIdBySeedId.set(d.id, device.id);
  }
  console.log(`  devices: ${SEED_DEVICES.length}`);

  await seedRack(DEMO_RACK, "demo-fly-pack", deviceIdBySeedId);
  await seedRack(DEMO_RACK_FIXED, "demo-touring-rack", deviceIdBySeedId);
  console.log("  racks: 2 (demo-fly-pack, demo-touring-rack)");

  console.log("done");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
