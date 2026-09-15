/**
 * GET /api/gear/search?q=…&domain=AUDIO
 *
 * Catalog search. When nothing matches, the response says so explicitly and
 * offers the lookup endpoint rather than returning an empty list — a dead end
 * is the moment the research pipeline is most useful.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { toDeviceSpec } from "@/lib/db/mappers";
import type { Domain } from "@prisma/client";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const domain = url.searchParams.get("domain") as Domain | null;

  const rows = await prisma.device.findMany({
    where: {
      ...(q
        ? {
            OR: [
              { model: { contains: q, mode: "insensitive" } },
              { description: { contains: q, mode: "insensitive" } },
              { manufacturer: { name: { contains: q, mode: "insensitive" } } },
            ],
          }
        : {}),
      ...(domain ? { category: { domain } } : {}),
    },
    include: { ports: true, manufacturer: true, category: true },
    orderBy: [{ manufacturer: { name: "asc" } }, { model: "asc" }],
    take: 50,
  });

  const devices = rows.map(toDeviceSpec);

  return NextResponse.json({
    query: q,
    count: devices.length,
    devices,
    ...(devices.length === 0 && q.length >= 2
      ? {
          miss: {
            message: `Nothing in the catalog matches "${q}" yet.`,
            lookup: { method: "POST", path: "/api/gear/lookup", body: { query: q } },
          },
        }
      : {}),
  });
}
