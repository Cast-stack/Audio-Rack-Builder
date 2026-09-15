/**
 * POST /api/export/patch-sheet  { rack: RackSpec, format?: "pdf" | "html" }
 *
 * Returns the printable patch sheet for a rack, with the sources appendix
 * populated from the revision each device is currently on — so the citations
 * on the paper are the ones that were true when it was printed, and a later
 * revision does not retroactively change a sheet someone has in a case lid.
 */

import { NextResponse } from "next/server";
import { z } from "zod";

import { renderPatchSheet, type SourceRow } from "@/lib/export/patchSheet";
import { htmlToPdf } from "@/lib/export/pdf";
import { RackSchema, toRackSpecFromWire } from "@/lib/rack/schema";
import { prisma } from "@/lib/db/client";
import { toDeviceSpec } from "@/lib/db/mappers";
import type { DeviceSpec } from "@/lib/rack/types";

export const maxDuration = 60;

const BodySchema = z.object({
  rack: RackSchema,
  format: z.enum(["pdf", "html"]).default("pdf"),
  preparedBy: z.string().max(120).nullable().optional(),
});

/** A filename someone can find again in a downloads folder six weeks later. */
function filenameFor(name: string, ext: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "rack";
  const date = new Date().toISOString().slice(0, 10);
  return `${slug}-patch-sheet-${date}.${ext}`;
}

export async function POST(request: Request) {
  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }
  const rack = toRackSpecFromWire(parsed.data.rack);

  const ids = [...new Set(rack.placements.map((p) => p.deviceId))];
  const rows = await prisma.device.findMany({
    where: { id: { in: ids } },
    include: {
      ports: true,
      manufacturer: true,
      category: true,
      currentRevision: { include: { provenance: true } },
    },
  });

  const devices = new Map<string, DeviceSpec>();
  const sources = new Map<string, SourceRow[]>();
  const unresolved = new Map<string, string[]>();

  for (const row of rows) {
    devices.set(row.id, toDeviceSpec(row));
    const rev = row.currentRevision;
    if (!rev) continue;
    sources.set(
      row.id,
      rev.provenance.map((s: SourceRow) => ({
        field: s.field,
        sourceUrl: s.sourceUrl,
        quote: s.quote,
        confidence: s.confidence,
        derivation: s.derivation,
      })),
    );
    if (rev.unresolved.length) unresolved.set(row.id, rev.unresolved);
  }

  const missing = ids.filter((id) => !devices.has(id));
  if (missing.length) {
    return NextResponse.json(
      { error: "Some devices in this rack are not in the catalog", missingDeviceIds: missing },
      { status: 422 },
    );
  }

  const html = renderPatchSheet({
    rack,
    devices,
    sources,
    unresolved,
    preparedBy: parsed.data.preparedBy ?? null,
  });

  if (parsed.data.format === "html") {
    return new NextResponse(html, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "content-disposition": `inline; filename="${filenameFor(rack.name, "html")}"`,
      },
    });
  }

  const pdf = await htmlToPdf(html, {
    footerLeft: `${rack.name} — ${rack.case.name} — patch sheet`,
  });

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-length": String(pdf.length),
      "content-disposition": `attachment; filename="${filenameFor(rack.name, "pdf")}"`,
      // The sheet is a snapshot of the rack as submitted; nothing to cache.
      "cache-control": "no-store",
    },
  });
}
