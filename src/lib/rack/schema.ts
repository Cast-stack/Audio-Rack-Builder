/**
 * Wire schema for a rack.
 *
 * One definition, shared by every endpoint that accepts a rack from outside.
 * Kept here rather than beside a route because a second copy is how a field
 * gets added to the engine and quietly dropped on the way in — `slot` did
 * exactly that, so half-rack placements arrived at the server with both units
 * defaulting to the left half and no collision reported.
 */

import { z } from "zod";

import type { RackSpec } from "./types";

export const CircuitSchema = z.object({
  label: z.string().min(1),
  volts: z.number().positive(),
  amps: z.number().positive(),
});

export const CaseSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  rackUnits: z.number().int().positive(),
  usableDepthMm: z.number().int().positive(),
  hasRearRails: z.boolean(),
  maxLoadLb: z.number().positive().nullable(),
  emptyWeightLb: z.number().positive().nullable(),
});

export const PlacementSchema = z.object({
  deviceId: z.string().min(1),
  position: z.number().int().positive(),
  slot: z.enum(["full", "left", "right"]).optional(),
  circuit: z.string().nullable(),
  label: z.string().nullable().optional(),
});

export const RackSchema = z.object({
  name: z.string().min(1),
  case: CaseSchema,
  circuits: z.array(CircuitSchema),
  placements: z.array(PlacementSchema),
});

/** The parsed shape is structurally a RackSpec; this names that fact once. */
export function toRackSpecFromWire(parsed: z.infer<typeof RackSchema>): RackSpec {
  return parsed as RackSpec;
}
