/**
 * Deterministic guardrails that run AFTER the model returns and BEFORE a human
 * ever sees the record. These catch the failure modes an LLM actually has on
 * spec sheets: unit confusion (inches read as mm), shipping weight quoted as
 * unit weight, "power supply rating" quoted as "power draw", and hallucinated
 * ports. Nothing here needs a network call or an API key.
 */
import {
  Device, Provenance, ResearchResult,
  REQUIRED_FOR_PUBLISH, POWER_FIELDS, REVIEW_THRESHOLD,
} from "./schema";
import { PASSIVE_CATEGORY_NAMES } from "./catalog";

export type Severity = "error" | "warn";
export interface Issue {
  field: string;
  severity: Severity;
  message: string;
}

export const MM_PER_IN = 25.4;
export const LB_PER_KG = 2.20462;

export const inToMm = (v: number) => Math.round(v * MM_PER_IN);
export const kgToLb = (v: number) => Math.round(v * LB_PER_KG * 10) / 10;

/**
 * A 1U chassis is 44.45mm tall and 482.6mm wide. Anything claiming to be 1U
 * and 1500mm deep is a rack case, not a device — and anything under 60mm deep
 * is almost always an inches-vs-mm mistake (2.4" read as 2.4mm, or 9.4 -> 9mm).
 */
const DEPTH_BOUNDS_MM = { min: 60, max: 900 };

/**
 * Rough plausibility band for weight per rack unit, in pounds. A 1U wireless
 * transmitter is ~4-9 lb; a 1U power amp can hit 25. Outside this band we don't
 * reject, we flag — the common cause is a shipping weight.
 */
const LB_PER_RU = { min: 0.4, max: 30 };

/**
 * Categories where a nonzero power draw is a mistake: a passive box has none.
 * Single source of truth is the taxonomy, so adding a passive category in one
 * place teaches the guardrails about it too.
 */
const PASSIVE_CATEGORIES = PASSIVE_CATEGORY_NAMES;

export function validateDevice(d: Device, category = d.category): Issue[] {
  const issues: Issue[] = [];
  const err = (field: string, message: string) =>
    issues.push({ field, severity: "error", message });
  const warn = (field: string, message: string) =>
    issues.push({ field, severity: "warn", message });

  // --- geometry -----------------------------------------------------------
  if (!Number.isInteger(d.rackUnits * 2)) {
    warn("rackUnits", `${d.rackUnits}U is not a half-U multiple`);
  }
  if (d.depthMm != null) {
    if (d.depthMm < DEPTH_BOUNDS_MM.min) {
      err("depthMm", `${d.depthMm}mm is implausibly shallow — likely an inches value that was not converted (${d.depthMm}" = ${inToMm(d.depthMm)}mm)`);
    } else if (d.depthMm > DEPTH_BOUNDS_MM.max) {
      err("depthMm", `${d.depthMm}mm exceeds any touring rack; check whether this is a case depth`);
    }
  }

  // --- weight -------------------------------------------------------------
  if (d.weightLb != null && d.rackUnits > 0) {
    const perRu = d.weightLb / Math.max(d.rackUnits, 0.5);
    if (perRu < LB_PER_RU.min) {
      warn("weightLb", `${d.weightLb} lb over ${d.rackUnits}U is very light — confirm this is not a kg value`);
    } else if (perRu > LB_PER_RU.max) {
      warn("weightLb", `${d.weightLb} lb over ${d.rackUnits}U is very heavy — confirm this is not a shipping weight`);
    }
  }

  // --- power --------------------------------------------------------------
  const passive = PASSIVE_CATEGORIES.has(category);
  if (d.powerTypicalW != null && d.powerMaxW != null && d.powerTypicalW > d.powerMaxW) {
    err("powerTypicalW", `typical draw (${d.powerTypicalW}W) exceeds max (${d.powerMaxW}W)`);
  }
  if (!passive && !d.poePowered && (d.powerTypicalW == null || d.powerTypicalW === 0)) {
    warn("powerTypicalW", `no power draw on an active device — datasheets often only print the PSU rating; record that as powerMaxW and leave typical unresolved rather than guessing`);
  }
  if (passive && (d.powerTypicalW ?? 0) > 0) {
    warn("powerTypicalW", `${category} is a passive category but a draw was recorded`);
  }
  if (!passive && !d.poePowered && d.powerInput == null) {
    warn("powerInput", "active device with no power connector recorded");
  }

  // --- ports --------------------------------------------------------------
  if (d.ports.length === 0) err("ports", "no ports extracted");
  const seen = new Set<string>();
  for (const [i, p] of d.ports.entries()) {
    const key = `${p.face}|${p.label.toLowerCase()}`;
    if (seen.has(key)) warn(`ports[${i}]`, `duplicate port label "${p.label}"`);
    seen.add(key);

    if (p.connector === "DB25" && p.channels !== 8) {
      warn(`ports[${i}].channels`, `DB25 normally carries 8 channels, got ${p.channels}`);
    }
    if (p.signal === "power" && p.direction === "output" && p.connector !== "IEC C14" && p.connector !== "IEC C20" && !p.label.toLowerCase().includes("out")) {
      warn(`ports[${i}]`, "power output on a non-IEC connector — verify");
    }
    if (p.signal === "antenna" && !["BNC", "TNC", "SMA"].includes(p.connector)) {
      warn(`ports[${i}].connector`, `antenna port on ${p.connector} is unusual`);
    }
  }
  const hasPowerPort = d.ports.some((p) => p.signal === "power");
  if (!passive && !d.poePowered && !hasPowerPort) {
    warn("ports", "active device with no power port in the port list");
  }

  // --- commercial ---------------------------------------------------------
  if (d.priceUsd != null && d.priceVerifiedAt == null) {
    err("priceVerifiedAt", "a price without a verification date is unusable — it silently rots");
  }
  if (d.status === "discontinued" && d.statusNote == null) {
    warn("statusNote", "discontinued with no explanation of what replaced it");
  }

  return issues;
}

/**
 * Cross-checks the model's own evidence. A value with no provenance row is
 * treated as unsourced regardless of how confident the model sounded.
 */
export function validateProvenance(
  d: Device,
  prov: Provenance[],
): Issue[] {
  const issues: Issue[] = [];
  const byField = new Map(prov.map((p) => [p.field, p]));

  for (const field of REQUIRED_FOR_PUBLISH) {
    const value = (d as Record<string, unknown>)[field];
    if (value == null) {
      issues.push({ field, severity: "error", message: "required for publish but unresolved" });
      continue;
    }
    const p = byField.get(field);
    if (!p) {
      issues.push({ field, severity: "error", message: "no source cited" });
    } else if (p.confidence < REVIEW_THRESHOLD) {
      issues.push({
        field,
        severity: "warn",
        message: `confidence ${p.confidence.toFixed(2)} below ${REVIEW_THRESHOLD} — needs a human`,
      });
    }
  }

  // Power: any one figure is enough, and passive gear needs none.
  const needsPower = !PASSIVE_CATEGORIES.has(d.category) && !d.poePowered;
  if (needsPower) {
    const present = POWER_FIELDS.filter((f) => d[f] != null);
    if (present.length === 0) {
      issues.push({
        field: "powerTypicalW",
        severity: "error",
        message: "no power figure at all — a rack cannot be power-budgeted without one",
      });
    } else if (!present.some((f) => byField.has(f))) {
      issues.push({
        field: present[0]!,
        severity: "error",
        message: "no source cited for any power figure",
      });
    }
  }

  for (const p of prov) {
    if (/^https?:\/\/(www\.)?(reddit|gearspace|quora|pinterest|facebook)\./i.test(p.sourceUrl)) {
      issues.push({
        field: p.field,
        severity: "warn",
        message: `sourced from a forum (${new URL(p.sourceUrl).hostname}) — acceptable as a lead, not as a citation`,
      });
    }
  }
  return issues;
}

export type Disposition = "auto-publish" | "review" | "reject";

export function triage(result: ResearchResult): {
  disposition: Disposition;
  issues: Issue[];
} {
  const issues = [
    ...validateDevice(result.device),
    ...validateProvenance(result.device, result.provenance),
  ];
  const hasError = issues.some((i) => i.severity === "error");
  if (hasError) return { disposition: "reject", issues };
  if (issues.length > 0 || result.unresolved.length > 0) {
    return { disposition: "review", issues };
  }
  return { disposition: "auto-publish", issues };
}
