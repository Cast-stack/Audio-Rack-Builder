#!/usr/bin/env tsx
/**
 * Research one device from the command line, without a database.
 *
 *   ANTHROPIC_API_KEY=... npm run gear:research -- "Shure AD600"
 *   ANTHROPIC_API_KEY=... npm run gear:research -- --price "Radial SW8"
 *
 * Prints the emitted record, the triage disposition, every guardrail issue and
 * what the run cost. Use it to judge output quality before wiring anything up.
 */

import Anthropic from "@anthropic-ai/sdk";
import { researchDevice } from "../src/lib/gear/research";
import { fetchPricing } from "../src/lib/gear/pricing";
import { CATEGORY_NAMES, MANUFACTURER_DOMAINS } from "../src/lib/gear/catalog";

function estimateUsd(inputTokens: number, outputTokens: number, searches: number) {
  // Sonnet list pricing plus $10 per 1k web searches. Update if your rates differ.
  const cost = (inputTokens / 1e6) * 3 + (outputTokens / 1e6) * 15 + (searches / 1000) * 10;
  return `$${cost.toFixed(4)}`;
}

async function main() {
  const argv = process.argv.slice(2);
  const priceOnly = argv.includes("--price");
  const query = argv.filter((a) => !a.startsWith("--")).join(" ").trim();

  if (!query) {
    console.error('usage: npm run gear:research -- [--price] "<brand> <model>"');
    process.exit(1);
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY is not set.");
    process.exit(1);
  }

  const client = new Anthropic();
  const started = Date.now();

  if (priceOnly) {
    const [brand = query, ...rest] = query.split(" ");
    const result = await fetchPricing(client, { brand, model: rest.join(" ") });
    console.log(JSON.stringify(result, null, 2));
    console.log(`\n${((Date.now() - started) / 1000).toFixed(1)}s`);
    return;
  }

  const outcome = await researchDevice(client, {
    query,
    categories: CATEGORY_NAMES,
    allowedDomains: MANUFACTURER_DOMAINS,
  });

  console.log(JSON.stringify(outcome.result, null, 2));
  console.log(`\n--- ${outcome.disposition.toUpperCase()} ---`);
  for (const i of outcome.issues) console.log(`  [${i.severity}] ${i.field}: ${i.message}`);
  if (outcome.result?.unresolved.length) {
    console.log(`  unresolved: ${outcome.result.unresolved.join(", ")}`);
  }

  const { inputTokens, outputTokens, searches, fetches } = outcome.usage;
  console.log(
    `\n${((Date.now() - started) / 1000).toFixed(1)}s · ${searches} searches · ${fetches} fetches · ` +
      `${inputTokens} in / ${outputTokens} out · ~${estimateUsd(inputTokens, outputTokens, searches)}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
