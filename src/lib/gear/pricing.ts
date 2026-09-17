/**
 * Pricing is a separate job from spec research, on purpose.
 *
 * Specs change when a product revision ships — once every few years. Prices
 * change weekly. Folding them into one pipeline means either re-reading every
 * datasheet to refresh a price (expensive) or letting prices rot (useless).
 * So: same client, much smaller prompt, much tighter search budget, its own
 * cadence, and it writes to its own table so a price refresh never touches a
 * reviewed spec record.
 */
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

export const DEALER_DOMAINS = [
  "sweetwater.com",
  "fullcompass.com",
  "bhphotovideo.com",
  "guitarcenter.com",
  "markertek.com",
  "thomann.de",
  "audio-technica.com",
];

export const PriceQuoteSchema = z.object({
  vendor: z.string(),
  url: z.string().url(),
  priceUsd: z.number().positive().nullable(),
  currency: z.string().default("USD"),
  availability: z.enum(["in-stock", "backorder", "special-order", "discontinued", "unknown"]),
  /** Verbatim price text as printed, e.g. "$9,459.00". Catches parse errors. */
  quotedAs: z.string(),
});

export const PricingResultSchema = z.object({
  quotes: z.array(PriceQuoteSchema),
  /** Median of real quotes, or null when nothing credible was found. */
  consensusUsd: z.number().positive().nullable(),
  kind: z.enum(["MAP", "MSRP", "street", "estimate"]).nullable(),
  discontinuedSignal: z.boolean(),
  notes: z.string().nullable(),
});
export type PricingResult = z.infer<typeof PricingResultSchema>;

const SYSTEM = `You look up the current US street price and stock status of one piece of professional audio gear.

Only record a price you can see printed on an authorised dealer's product page. Do not record prices from marketplaces, auction listings, or used gear. If a dealer shows "call for price" or a login-gated price, record the quote with priceUsd null and availability from the page.

If two or more dealers no longer list the product, or list it as discontinued, set discontinuedSignal true — that is the signal the catalog uses to retire a device.

Report the price exactly as printed in quotedAs so a parsing mistake is visible.`;

export async function fetchPricing(
  client: Anthropic,
  device: { brand: string; model: string },
  opts: { allowedDomains?: string[]; signal?: AbortSignal } = {},
): Promise<PricingResult | null> {
  const emitTool: Anthropic.Beta.BetaTool = {
    name: "emit_pricing",
    description: "Submit the pricing findings. Call exactly once.",
    input_schema: zodToJsonSchema(PricingResultSchema, {
      target: "openAi", $refStrategy: "none",
    }) as Anthropic.Beta.BetaTool.InputSchema,
  };

  const messages: Anthropic.Beta.BetaMessageParam[] = [{
    role: "user",
    content: `Current US street price and availability for: ${device.brand} ${device.model}`,
  }];

  for (let turn = 0; turn < 8; turn++) {
    const response = await client.beta.messages.create({
      model: process.env.GEAR_PRICING_MODEL ?? "claude-haiku-4-5",
      max_tokens: 3000,
      system: SYSTEM,
      messages,
      tools: [
        {
          type: "web_search_20250305",
          name: "web_search",
          max_uses: 4,
          allowed_domains: opts.allowedDomains ?? DEALER_DOMAINS,
        } as unknown as Anthropic.Beta.BetaToolUnion,
        emitTool,
      ],
    }, { signal: opts.signal });

    messages.push({ role: "assistant", content: response.content });
    const call = response.content.find(
      (b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use" && b.name === "emit_pricing",
    );
    if (!call) {
      if (response.stop_reason === "end_turn") return null;
      continue;
    }
    const parsed = PricingResultSchema.safeParse(call.input);
    return parsed.success ? parsed.data : null;
  }
  return null;
}

/**
 * Prices are only trustworthy with a date attached. This is what the UI reads:
 * anything older than `staleAfterDays` renders as "was $X on <date>", never as
 * a current price.
 */
export function priceFreshness(verifiedAt: string | null, staleAfterDays = 45) {
  if (!verifiedAt) return { state: "unknown" as const, ageDays: null };
  const ageDays = Math.floor((Date.now() - Date.parse(verifiedAt)) / 86_400_000);
  return {
    state: ageDays <= staleAfterDays ? ("fresh" as const) : ("stale" as const),
    ageDays,
  };
}
