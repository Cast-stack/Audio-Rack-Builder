/**
 * Build the standalone planner page.
 *
 *   node scripts/build-planner.mjs [template.html] [out.html]
 *
 * Bundles src/lib/browser/planner-bundle.ts into an IIFE exposing `RACK` and
 * substitutes it into the template's __ENGINE__ slot. All logic is inlined, so
 * the page works from a file:// URL or a USB stick with no server behind it.
 * The only network request is the webfont link in the template, which degrades
 * to system fonts — nothing functional depends on it.
 */

import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import * as esbuild from "esbuild";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const template = process.argv[2] ?? resolve(root, "planner/template.html");
const out = process.argv[3] ?? resolve(root, "planner/planner.html");

const result = await esbuild.build({
  entryPoints: [resolve(root, "src/lib/browser/planner-bundle.ts")],
  bundle: true,
  format: "iife",
  globalName: "RACK",
  target: ["es2019"],
  platform: "browser",
  write: false,
  logLevel: "warning",
  tsconfig: resolve(root, "tsconfig.json"),
});

const [file] = result.outputFiles;
if (!file) throw new Error("esbuild produced no output");
const engine = file.text;

let html = await readFile(template, "utf8");
if (!html.includes("__ENGINE__")) {
  throw new Error(`${template} has no __ENGINE__ slot`);
}
// A literal replacement, not a regex: the bundle contains $& and $1 sequences
// inside string literals, and String.replace would expand them.
html = html.split("__ENGINE__").join(engine);
// The panel renderer used to be a second script; it is part of the bundle now.
html = html.split("<script>\n__PANELS__\n</script>\n").join("");

await writeFile(out, html, "utf8");
console.log(`${out} — ${(html.length / 1024).toFixed(0)} KB`);
