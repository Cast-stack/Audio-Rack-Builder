/**
 * Canonical device schema for the gear research pipeline.
 *
 * This mirrors the fields IEM Rig already surfaces on /gear/<slug> pages
 * (rack units, depth, weight, typical/max power draw, port list with
 * connector + direction + signal, price estimate with a verified-on date,
 * discontinued status). Adjust the enums to match your Prisma models —
 * everything downstream is driven off this file.
 */
import { z } from "zod";

/** Connector types the planner knows how to draw and auto-wire. */
export const CONNECTOR = [
  "XLR3", "XLR4", "XLR5", "XLR/TRS combo", "TRS", "TS", "RCA",
  "DB25", "DB25 (Tascam)", "EDAC", "Speakon", "BNC", "TNC", "SMA",
  "RJ45", "Dante RJ45", "AES50 RJ45", "etherCON", "SFP", "USB-A", "USB-B",
  "USB-C", "Thunderbolt", "HDMI", "MIDI DIN", "IEC C14", "IEC C20",
  "powerCON", "powerCON TRUE1", "Edison", "Terminal block", "Other",
] as const;

export const DIRECTION = ["input", "output", "bidirectional"] as const;

export const SIGNAL = [
  "analog audio", "digital audio", "data", "network", "clock",
  "antenna", "power", "video", "control", "other",
] as const;

export const PortSchema = z.object({
  /** Silkscreen label as printed on the chassis, e.g. "Analog Out 1-8". */
  label: z.string().min(1),
  connector: z.enum(CONNECTOR),
  direction: z.enum(DIRECTION),
  signal: z.enum(SIGNAL),
  /** Audio channels carried by this single physical connector (DB25 = 8). */
  channels: z.number().int().positive().nullable(),
  /** How many identical connectors of this description exist. */
  count: z.number().int().positive().default(1),
  /** Which face of the unit, for rear-view rendering. */
  face: z.enum(["front", "rear"]).default("rear"),
});
export type Port = z.infer<typeof PortSchema>;

export const FORM_FACTOR = [
  "full-rack", "half-rack", "third-rack", "quarter-rack", "desktop", "accessory",
] as const;

export const DeviceSchema = z.object({
  brand: z.string().min(1),
  model: z.string().min(1),
  /** Must be one of your existing 41 categories — pass the list in at runtime. */
  category: z.string().min(1),
  /** One sentence, written for a rack tech, not marketing copy. */
  description: z.string().min(10).max(320),

  formFactor: z.enum(FORM_FACTOR),
  /** Vertical rack space. Half-rack units that ship with ears are still 1. */
  rackUnits: z.number().min(0).max(45),
  /** Chassis depth behind the rails, millimetres. Excludes connectors. */
  depthMm: z.number().int().min(20).max(1200).nullable(),
  weightLb: z.number().min(0.1).max(400).nullable(),

  /** Steady-state consumption in normal use, watts. */
  powerTypicalW: z.number().min(0).max(5000).nullable(),
  /** Manufacturer max / nameplate rating, watts. */
  powerMaxW: z.number().min(0).max(5000).nullable(),
  powerInput: z.enum(CONNECTOR).nullable(),
  voltage: z.string().nullable(),
  /** True when the unit is powered from the network, not a cord. */
  poePowered: z.boolean().default(false),

  ports: z.array(PortSchema).min(1),

  status: z.enum(["current", "discontinued", "announced"]).default("current"),
  statusNote: z.string().nullable(),

  priceUsd: z.number().int().positive().nullable(),
  priceKind: z.enum(["MAP", "MSRP", "street", "estimate"]).nullable(),
  priceVerifiedAt: z.string().nullable(), // ISO date

  /** Manufacturer product page. The anchor for every future re-verification. */
  productUrl: z.string().url().nullable(),
  datasheetUrl: z.string().url().nullable(),
});
export type Device = z.infer<typeof DeviceSchema>;

/** Per-field evidence. Every extracted number must point at where it came from. */
export const ProvenanceSchema = z.object({
  /** Dotted path into the device, e.g. "depthMm" or "ports[3].connector". */
  field: z.string(),
  sourceUrl: z.string().url(),
  /** Verbatim text from the source that supports the value. No paraphrase. */
  quote: z.string().min(1).max(400),
  /** 0-1. Below REVIEW_THRESHOLD the field is never auto-published. */
  confidence: z.number().min(0).max(1),
  /** Set when the value was computed rather than read (unit conversion, sum). */
  derivation: z.string().nullable(),
});
export type Provenance = z.infer<typeof ProvenanceSchema>;

export const ResearchResultSchema = z.object({
  device: DeviceSchema,
  provenance: z.array(ProvenanceSchema),
  /** Fields the researcher could not establish. Drives the review queue UI. */
  unresolved: z.array(z.string()),
  /** Anything a human should know before approving. */
  notes: z.string().nullable(),
});
export type ResearchResult = z.infer<typeof ResearchResultSchema>;

/**
 * Fields that must be present and cited before a device can go live.
 *
 * Power is deliberately NOT in this list. Plenty of manufacturers publish only
 * a current rating or only a PSU rating and never a typical draw — Shure's
 * AD600 prints "Current Drain 1.2 A" and no wattage at all. Requiring
 * powerTypicalW would reject those correctly-researched records. The rule is
 * instead "at least one power figure", enforced in validateProvenance.
 */
export const REQUIRED_FOR_PUBLISH = [
  "brand", "model", "category", "formFactor", "rackUnits",
  "depthMm", "weightLb", "ports",
] as const;

/** Satisfied by powerTypicalW or powerMaxW; see REQUIRED_FOR_PUBLISH. */
export const POWER_FIELDS = ["powerTypicalW", "powerMaxW"] as const;

export const REVIEW_THRESHOLD = 0.75;
