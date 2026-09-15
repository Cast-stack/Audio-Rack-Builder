/**
 * The researcher: one device name in, one cited, validated record out.
 *
 * Uses Anthropic's *server-side* web_search and web_fetch tools rather than a
 * hand-rolled scraper stack. That choice buys three things that matter here:
 *   - web_fetch reads PDFs natively, and audio spec sheets are overwhelmingly
 *     PDFs. No pdf-parse, no OCR fallback, no layout heuristics.
 *   - Every result carries citations back to a URL, so provenance is not
 *     something the model is asked to remember and therefore free to invent.
 *   - Fetches run in Anthropic's infrastructure, so you are not adding an
 *     egress path, a proxy, or a robots.txt policy surface to your own app.
 *
 * Structured output comes from forcing a client tool call. The model searches
 * and reads freely, then must finish by calling emit_device with a payload that
 * satisfies the zod schema — anything malformed is bounced back for one repair
 * round before the job is failed.
 */
import Anthropic from "@anthropic-ai/sdk";
import { zodToJsonSchema } from "zod-to-json-schema";
import {
  ResearchResultSchema, ResearchResult, DeviceSchema,
} from "./schema";
import { triage, Disposition, Issue } from "./validate";

// Verify these against the current tool-use docs before deploying; Anthropic
// versions its server tools by date and older versions do get retired.
const WEB_SEARCH_TOOL = "web_search_20250305";
const WEB_FETCH_TOOL = "web_fetch_20250910";
const WEB_FETCH_BETA = "web-fetch-2025-09-10";

const MODEL = process.env.GEAR_RESEARCH_MODEL ?? "claude-sonnet-4-5";

export interface ResearchOptions {
  /** e.g. "Shure AD600" or "Radial Engineering SW8". */
  query: string;
  /** Your 41 category names. The model must pick one; it may not invent one. */
  categories: string[];
  /** Domains the searcher is allowed to read. Manufacturers + real dealers. */
  allowedDomains?: string[];
  /** Cap on web_search calls. Tune per job type — see budgets in the plan. */
  maxSearches?: number;
  /** Cap on web_fetch calls (datasheet PDFs are the expensive ones). */
  maxFetches?: number;
  /** Pass the existing record when re-verifying rather than creating. */
  existing?: unknown;
  signal?: AbortSignal;
}

export interface ResearchOutcome {
  result: ResearchResult | null;
  disposition: Disposition | "failed";
  issues: Issue[];
  /** Raw usage for cost accounting; see the credit model in the plan. */
  usage: { inputTokens: number; outputTokens: number; searches: number; fetches: number };
  transcript: Anthropic.Beta.BetaMessageParam[];
}

const SYSTEM = `You are a spec researcher for a professional audio rack planner. You establish the physical and electrical facts about one piece of rack gear so it can be placed in a rack drawing and have its power, weight and depth budgeted accurately.

RULES

1. Manufacturer sources outrank everything. Prefer, in order: the manufacturer's spec sheet PDF, the manufacturer's product page, the printed manual, an authorised dealer's spec tab. Forums, blogs and marketplace listings may point you toward a document but are never themselves a citation.

2. Record what the source says, not what you remember. If you cannot find a figure, put the field name in "unresolved" and leave the value null. An unresolved field costs a reviewer thirty seconds. A confidently wrong depth costs someone a rack build on site.

3. Depth means chassis depth behind the rails, in millimetres, excluding connectors and handles. Datasheets often print overall depth including knobs — if that is all you have, record it and say so in the derivation.

4. Distinguish power DRAW from power SUPPLY RATING. A unit with a 150W supply may draw 35W. If only the supply rating is printed, record it as powerMaxW and leave powerTypicalW unresolved. Never copy the rating into both.

5. Convert units explicitly. Inches to millimetres, kilograms to pounds. State the conversion in the derivation field. Never silently round a converted value into a suspiciously round number.

6. Enumerate the rear panel connector by connector from the rear-panel photo or the connector list. One entry per distinct label. A DB25 carries 8 channels. Give the silkscreen label as printed, not a description.

7. Every non-null value needs a provenance row with a VERBATIM quote from the source. If you cannot quote it, you did not read it.

8. Confidence is your honest estimate that the value is correct and correctly interpreted: 0.95+ for a figure read straight off a manufacturer spec table, 0.8 for one inferred from a drawing or a dealer page, below 0.7 for anything you are reasoning toward. Do not inflate.

Finish by calling emit_device exactly once.`;

function buildUserPrompt(o: ResearchOptions): string {
  const lines = [
    `Device: ${o.query}`,
    ``,
    `Choose category from exactly this list: ${o.categories.join(", ")}`,
  ];
  if (o.existing) {
    lines.push(
      ``,
      `This device already exists in the catalog. Re-verify it against current manufacturer sources. Report the CURRENT correct values. In notes, call out every field that differs from the record below and say why. If the product has been discontinued or superseded, set status and statusNote.`,
      ``,
      "```json",
      JSON.stringify(o.existing, null, 2),
      "```",
    );
  }
  return lines.join("\n");
}

export async function researchDevice(
  client: Anthropic,
  opts: ResearchOptions,
): Promise<ResearchOutcome> {
  const emitTool: Anthropic.Beta.BetaTool = {
    name: "emit_device",
    description:
      "Submit the finished device record with per-field provenance. Call this exactly once, after research is complete.",
    input_schema: zodToJsonSchema(ResearchResultSchema, {
      target: "openAi",
      $refStrategy: "none",
    }) as Anthropic.Beta.BetaTool.InputSchema,
  };

  const serverTools: unknown[] = [
    {
      type: WEB_SEARCH_TOOL,
      name: "web_search",
      max_uses: opts.maxSearches ?? 6,
      ...(opts.allowedDomains ? { allowed_domains: opts.allowedDomains } : {}),
    },
    {
      type: WEB_FETCH_TOOL,
      name: "web_fetch",
      max_uses: opts.maxFetches ?? 8,
      max_content_tokens: 30_000,
      ...(opts.allowedDomains ? { allowed_domains: opts.allowedDomains } : {}),
    },
  ];

  const messages: Anthropic.Beta.BetaMessageParam[] = [
    { role: "user", content: buildUserPrompt(opts) },
  ];

  const usage = { inputTokens: 0, outputTokens: 0, searches: 0, fetches: 0 };
  let repairs = 0;

  // The agentic loop. Server tools resolve inside the API, so we only ever loop
  // to hand back the result of our own client tool (or a validation error).
  for (let turn = 0; turn < 12; turn++) {
    const response = await client.beta.messages.create(
      {
        model: MODEL,
        max_tokens: 8000,
        system: SYSTEM,
        messages,
        tools: [...(serverTools as Anthropic.Beta.BetaToolUnion[]), emitTool],
        betas: [WEB_FETCH_BETA],
      },
      { signal: opts.signal },
    );

    usage.inputTokens += response.usage.input_tokens;
    usage.outputTokens += response.usage.output_tokens;
    for (const block of response.content) {
      if (block.type === "server_tool_use") {
        if (block.name === "web_search") usage.searches++;
        if (block.name === "web_fetch") usage.fetches++;
      }
    }

    messages.push({ role: "assistant", content: response.content });

    const call = response.content.find(
      (b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use" && b.name === "emit_device",
    );

    if (!call) {
      if (response.stop_reason === "end_turn") {
        return {
          result: null, disposition: "failed", usage, transcript: messages,
          issues: [{ field: "_", severity: "error", message: "model finished without calling emit_device" }],
        };
      }
      continue; // server tool round-trip; the API already resolved it
    }

    const parsed = ResearchResultSchema.safeParse(call.input);
    if (!parsed.success) {
      if (repairs++ >= 1) {
        return {
          result: null, disposition: "failed", usage, transcript: messages,
          issues: parsed.error.issues.map((i) => ({
            field: i.path.join("."), severity: "error" as const, message: i.message,
          })),
        };
      }
      messages.push({
        role: "user",
        content: [{
          type: "tool_result",
          tool_use_id: call.id,
          is_error: true,
          content: `Schema validation failed. Fix these and call emit_device again:\n${parsed.error.issues
            .map((i) => `- ${i.path.join(".") || "(root)"}: ${i.message}`)
            .join("\n")}`,
        }],
      });
      continue;
    }

    if (!opts.categories.includes(parsed.data.device.category)) {
      if (repairs++ >= 1) {
        return {
          result: parsed.data, disposition: "failed", usage, transcript: messages,
          issues: [{ field: "category", severity: "error", message: `"${parsed.data.device.category}" is not a known category` }],
        };
      }
      messages.push({
        role: "user",
        content: [{
          type: "tool_result",
          tool_use_id: call.id,
          is_error: true,
          content: `"${parsed.data.device.category}" is not in the allowed list. Pick one of: ${opts.categories.join(", ")}`,
        }],
      });
      continue;
    }

    const { disposition, issues } = triage(parsed.data);
    return { result: parsed.data, disposition, issues, usage, transcript: messages };
  }

  return {
    result: null, disposition: "failed", usage, transcript: messages,
    issues: [{ field: "_", severity: "error", message: "exceeded turn budget" }],
  };
}

/** Convenience wrapper for the /gear-not-found path, where latency is visible. */
export function researchFast(client: Anthropic, query: string, categories: string[]) {
  return researchDevice(client, { query, categories, maxSearches: 3, maxFetches: 3 });
}

export { DeviceSchema };
