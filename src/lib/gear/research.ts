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
import { VettedSources, sourcesPrompt, vetSources } from "./sources";

// Checked against the web search, web fetch and server-tools docs in
// September 2026. Anthropic versions server tools by date; re-check before
// bumping the model, because the newer versions only run on some models.
//
// The _20260318 versions filter what they fetch in a code sandbox before it
// reaches context. That matters here more than most places: a manufacturer
// manual is a 100-page PDF and we want four numbers and a connector list out
// of it. Neither tool needs a beta header any more; the old
// "web-fetch-2025-09-10" flag is gone.
const WEB_SEARCH_TOOL = "web_search_20260318";
const WEB_FETCH_TOOL = "web_fetch_20260318";

const MODEL = process.env.GEAR_RESEARCH_MODEL ?? "claude-opus-5";

/**
 * Server-side refusal fallback. If the model declines a request, the API
 * re-runs it on a fallback model inside the same call rather than handing
 * back an empty turn. Gear research should never trip this; it is here so
 * that a false positive costs a retry rather than a failed job. The SDK
 * version this repo pins does not type the parameter yet, hence the cast at
 * the call site.
 */
const FALLBACK_BETA = "server-side-fallback-2026-07-01";

/**
 * Output ceiling per turn. Opus 5 thinks by default and the thinking counts
 * against this, and emit_device carries a full port list plus a verbatim
 * quote per field. 8000 was enough for a model that did not think first; on
 * this one it truncates the record mid-provenance.
 */
const MAX_TOKENS = 16_000;

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
  /**
   * URLs the person asking supplied — a product page, a manual PDF.
   *
   * Their hosts are opened for this job on top of `allowedDomains`, so a
   * manufacturer nobody has allowlisted yet can still be read when someone
   * points at it. Vetting and the trust consequences live in ./sources.
   */
  sources?: string[];
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
  /** What was made of the links the user handed over. Empty when none were. */
  sources: VettedSources;
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

function buildUserPrompt(o: ResearchOptions, vetted: VettedSources): string {
  const lines = [
    `Device: ${o.query}`,
    ``,
    `Choose category from exactly this list: ${o.categories.join(", ")}`,
  ];
  const supplied = sourcesPrompt(vetted);
  if (supplied) lines.push(supplied);
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

  const vetted = vetSources(opts.sources ?? []);

  /**
   * Only widen an allowlist that exists. When allowedDomains is undefined the
   * job is deliberately unrestricted, and merging the user's hosts in would
   * narrow it to just those — turning an open search into a job that can read
   * one dealer page and nothing else.
   */
  const allowed = opts.allowedDomains
    ? Array.from(new Set([...opts.allowedDomains, ...vetted.extraDomains]))
    : undefined;

  const serverTools: unknown[] = [
    {
      type: WEB_SEARCH_TOOL,
      name: "web_search",
      max_uses: opts.maxSearches ?? 6,
      ...(allowed ? { allowed_domains: allowed } : {}),
    },
    {
      type: WEB_FETCH_TOOL,
      name: "web_fetch",
      max_uses: opts.maxFetches ?? 8,
      max_content_tokens: 30_000,
      ...(allowed ? { allowed_domains: allowed } : {}),
    },
  ];

  const messages: Anthropic.Beta.BetaMessageParam[] = [
    { role: "user", content: buildUserPrompt(opts, vetted) },
  ];

  const usage = { inputTokens: 0, outputTokens: 0, searches: 0, fetches: 0 };
  let repairs = 0;

  // The agentic loop. Server tools resolve inside the API, so we only ever loop
  // to hand back the result of our own client tool (or a validation error).
  for (let turn = 0; turn < 12; turn++) {
    const params = {
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM,
      messages,
      tools: [...(serverTools as Anthropic.Beta.BetaToolUnion[]), emitTool],
      betas: [FALLBACK_BETA],
      fallbacks: "default",
    };
    const response = await client.beta.messages.create(
      params as unknown as Anthropic.Beta.MessageCreateParamsNonStreaming,
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
      /**
       * Only pause_turn may loop. It means the server paused a long search or
       * fetch and wants the paused content sent back as-is, which is exactly
       * what the push above did.
       *
       * Every other stop reason ends the job. Looping on them re-sends the
       * conversation with an assistant turn at the end, which on Opus 5 is a
       * prefill and comes back as a 400 — so a refusal or a truncated turn
       * would surface as an API error instead of as what actually happened.
       */
      const stop = response.stop_reason as string | null;
      if (stop === "pause_turn") continue;

      const why =
        stop === "end_turn"
          ? "model finished without calling emit_device"
          : stop === "refusal"
            ? "the model declined this request"
            : stop === "max_tokens"
              ? `turn ran past ${MAX_TOKENS} output tokens before emitting a record`
              : `turn ended with stop_reason ${stop ?? "null"} and no record`;
      return {
        result: null, disposition: "failed", usage, sources: vetted, transcript: messages,
        issues: [{ field: "_", severity: "error", message: why }],
      };
    }

    const parsed = ResearchResultSchema.safeParse(call.input);
    if (!parsed.success) {
      if (repairs++ >= 1) {
        return {
          result: null, disposition: "failed", usage, sources: vetted, transcript: messages,
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
          result: parsed.data, disposition: "failed", usage, sources: vetted, transcript: messages,
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

    /**
     * A record built with help from a source nobody has vetted does not get to
     * publish itself, however clean it looks. The guardrails in triage() read
     * the record; they cannot see where the reading came from. This can only
     * ever hold a job back, never wave one through.
     */
    if (disposition === "auto-publish" && !vetted.allTrusted) {
      return {
        result: parsed.data,
        disposition: "review",
        usage,
        sources: vetted,
        transcript: messages,
        issues: [
          ...issues,
          {
            field: "_",
            severity: "warn",
            message: `researched with a user-supplied source outside the manufacturer allowlist (${vetted.accepted
              .filter((x) => !x.trusted)
              .map((x) => x.host)
              .join(", ")}) — needs a person`,
          },
        ],
      };
    }

    return { result: parsed.data, disposition, issues, usage, sources: vetted, transcript: messages };
  }

  return {
    result: null, disposition: "failed", usage, sources: vetted, transcript: messages,
    issues: [{ field: "_", severity: "error", message: "exceeded turn budget" }],
  };
}

/** Convenience wrapper for the /gear-not-found path, where latency is visible. */
export function researchFast(client: Anthropic, query: string, categories: string[]) {
  return researchDevice(client, { query, categories, maxSearches: 3, maxFetches: 3 });
}

export { DeviceSchema };
