/**
 * GET /api/cron/pricing — refresh dealer prices.
 *
 * Separate from the spec sweep on purpose. Specs change when a product revision
 * ships; prices change weekly. Folding them together means re-reading every
 * datasheet to refresh a price, or letting prices rot. Writes only to
 * PriceQuote — a price refresh must never touch a reviewed spec record.
 *
 * Two dealers dropping a listing is the discontinued signal. One is noise.
 */

import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

import { prisma } from "@/lib/db/client";
import { fetchPricing } from "@/lib/gear/pricing";

export const maxDuration = 300;

const BATCH = 15;

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "not configured" }, { status: 503 });
  }

  const devices = await prisma.device.findMany({
    where: { status: "CURRENT" },
    include: { manufacturer: true, priceQuotes: { orderBy: { observedAt: "desc" }, take: 1 } },
    orderBy: { updatedAt: "asc" },
    take: BATCH,
  });

  const client = new Anthropic();
  const updated: { device: string; quotes: number; discontinued: boolean }[] = [];

  for (const device of devices) {
    const result = await fetchPricing(client, {
      brand: device.manufacturer.name,
      model: device.model,
    });
    if (!result) continue;

    if (result.quotes.length > 0) {
      await prisma.priceQuote.createMany({
        data: result.quotes.map((q) => ({
          deviceId: device.id,
          vendor: q.vendor,
          url: q.url,
          priceUsd: q.priceUsd,
          quotedAs: q.quotedAs,
          availability: q.availability,
        })),
      });
    }

    if (result.discontinuedSignal) {
      await prisma.device.update({
        where: { id: device.id },
        data: {
          status: "DISCONTINUED",
          statusNote: result.notes ?? "No longer listed by two or more authorised dealers.",
        },
      });
    }

    updated.push({
      device: device.slug,
      quotes: result.quotes.length,
      discontinued: result.discontinuedSignal,
    });
  }

  return NextResponse.json({ updated });
}
