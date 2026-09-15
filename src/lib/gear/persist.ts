/**
 * Writing research results to the database.
 *
 * The rule enforced here: an automated job never edits a device in place. It
 * writes a revision plus its evidence, and only a promotion — automatic when
 * every required field is cited and confident, otherwise a human's click —
 * makes that revision the one the catalog serves.
 */

import { Disposition as PrismaDisposition, JobKind, JobStatus, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { MANUFACTURER_DOMAINS } from "./catalog";
import type { ResearchResult, Device as DevicePayload } from "./schema";
import type { Disposition, Issue } from "./validate";
import { REQUIRED_FOR_PUBLISH } from "./schema";

const DEALERS = new Set([
  "sweetwater.com", "fullcompass.com", "bhphotovideo.com", "guitarcenter.com",
  "markertek.com", "thomann.de", "long-mcquade.com",
]);

export function classifySource(url: string): "manufacturer" | "dealer" | "other" {
  let host: string;
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "other";
  }
  if (MANUFACTURER_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`))) {
    return "manufacturer";
  }
  if (DEALERS.has(host)) return "dealer";
  return "other";
}

/**
 * Share of publish-required fields backed by a manufacturer citation.
 * Shown on the gear page — the number neither reference tool can produce.
 */
export function sourceGrade(result: ResearchResult): number {
  const byField = new Map(result.provenance.map((p) => [p.field, p]));
  let cited = 0;
  for (const field of REQUIRED_FOR_PUBLISH) {
    const p = byField.get(field);
    if (p && classifySource(p.sourceUrl) === "manufacturer") cited++;
  }
  return Math.round((cited / REQUIRED_FOR_PUBLISH.length) * 100) / 100;
}

const DISPOSITION_MAP: Record<Disposition | "failed", PrismaDisposition> = {
  "auto-publish": PrismaDisposition.AUTO_PUBLISH,
  review: PrismaDisposition.REVIEW,
  reject: PrismaDisposition.REJECT,
  failed: PrismaDisposition.FAILED,
};

export interface RecordArgs {
  jobId: string;
  result: ResearchResult;
  disposition: Disposition | "failed";
  issues: Issue[];
  /** Existing device this revision belongs to, for verification runs. */
  deviceId?: string;
}

/** Store the revision and its evidence. Does not publish. */
export async function recordRevision(args: RecordArgs) {
  const { result, issues } = args;
  return prisma.deviceRevision.create({
    data: {
      deviceId: args.deviceId ?? null,
      jobId: args.jobId,
      payload: result.device as unknown as Prisma.InputJsonValue,
      disposition: DISPOSITION_MAP[args.disposition],
      issues: issues as unknown as Prisma.InputJsonValue,
      unresolved: result.unresolved,
      notes: result.notes,
      createdBy: "research",
      provenance: {
        create: result.provenance.map((p) => ({
          field: p.field,
          sourceUrl: p.sourceUrl,
          quote: p.quote,
          confidence: p.confidence,
          derivation: p.derivation,
          sourceKind: classifySource(p.sourceUrl),
        })),
      },
    },
    include: { provenance: true },
  });
}

/**
 * Promote a revision: upsert the device from its payload and point the device's
 * currentRevision at it. Called automatically for AUTO_PUBLISH, and by a
 * reviewer otherwise.
 */
export async function publishRevision(revisionId: string, publishedBy: string) {
  const revision = await prisma.deviceRevision.findUniqueOrThrow({
    where: { id: revisionId },
  });
  const payload = revision.payload as unknown as DevicePayload;

  const manufacturer = await prisma.manufacturer.upsert({
    where: { name: payload.brand },
    create: { name: payload.brand, slug: slugify(payload.brand), domains: [] },
    update: {},
  });
  const category = await prisma.category.findUniqueOrThrow({
    where: { name: payload.category },
  });

  const slug = slugify(`${payload.brand} ${payload.model}`);
  const scalars = {
    slug,
    manufacturerId: manufacturer.id,
    categoryId: category.id,
    model: payload.model,
    description: payload.description,
    formFactor: FORM_FACTOR_MAP[payload.formFactor],
    rackUnits: payload.rackUnits,
    depthMm: payload.depthMm,
    weightLb: payload.weightLb,
    powerTypicalW: payload.powerTypicalW,
    powerMaxW: payload.powerMaxW,
    powerInput: payload.powerInput,
    voltage: payload.voltage,
    poePowered: payload.poePowered,
    status: STATUS_MAP[payload.status],
    statusNote: payload.statusNote,
    productUrl: payload.productUrl,
    datasheetUrl: payload.datasheetUrl,
    verifiedAt: new Date(),
  };

  const device = await prisma.device.upsert({
    where: { manufacturerId_model: { manufacturerId: manufacturer.id, model: payload.model } },
    create: scalars,
    update: scalars,
  });

  // Ports are replaced wholesale — a revision describes the whole rear panel,
  // and merging port lists across revisions produces ghosts.
  await prisma.port.deleteMany({ where: { deviceId: device.id } });
  await prisma.port.createMany({
    data: payload.ports.map((p, i) => ({
      deviceId: device.id,
      label: p.label,
      connector: p.connector,
      direction: p.direction,
      signal: p.signal,
      channels: p.channels,
      count: p.count,
      face: p.face,
      sortKey: i,
    })),
  });

  await prisma.deviceRevision.update({
    where: { id: revisionId },
    data: { deviceId: device.id, createdBy: publishedBy },
  });

  return prisma.device.update({
    where: { id: device.id },
    data: { currentRevisionId: revisionId },
    include: { ports: true, manufacturer: true, category: true },
  });
}

export async function startJob(kind: JobKind, query: string, requestedBy?: string) {
  return prisma.researchJob.create({
    data: { kind, query, requestedBy: requestedBy ?? null, status: JobStatus.RUNNING },
  });
}

export async function finishJob(
  jobId: string,
  usage: { inputTokens: number; outputTokens: number; searches: number; fetches: number },
  error?: string,
) {
  return prisma.researchJob.update({
    where: { id: jobId },
    data: {
      status: error ? JobStatus.ERROR : JobStatus.DONE,
      error: error ?? null,
      finishedAt: new Date(),
      ...usage,
    },
  });
}

const FORM_FACTOR_MAP = {
  "full-rack": "FULL_RACK",
  "half-rack": "HALF_RACK",
  "third-rack": "THIRD_RACK",
  "quarter-rack": "QUARTER_RACK",
  desktop: "DESKTOP",
  accessory: "ACCESSORY",
} as const;

const STATUS_MAP = {
  current: "CURRENT",
  discontinued: "DISCONTINUED",
  announced: "ANNOUNCED",
} as const;

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-");
}
