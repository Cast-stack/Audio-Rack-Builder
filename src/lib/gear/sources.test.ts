/**
 * What we are willing to fetch on somebody's say-so, and what that is worth.
 *
 * These rules decide two things that matter: which URLs leave the building,
 * and whether a record can publish itself. Both are worth pinning down.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { MAX_SOURCES, isManufacturerHost, sourcesPrompt, vetSources } from "./sources";

test("a manufacturer link is accepted and marked as one", () => {
  const v = vetSources(["https://pubs.shure.com/view/guide/ULXD/en-US.pdf"]);
  assert.equal(v.accepted.length, 1);
  assert.equal(v.accepted[0]!.trusted, true);
  assert.equal(v.accepted[0]!.host, "pubs.shure.com");
  assert.equal(v.allTrusted, true);
  // Nothing extra to open: the host is already on the standing allowlist.
  assert.deepEqual(v.extraDomains, []);
});

test("a subdomain of an allowlisted manufacturer counts as the manufacturer", () => {
  assert.equal(isManufacturerHost("www.shure.com"), true);
  assert.equal(isManufacturerHost("assets.gatorco.com"), true);
  // Suffix matching must not be a substring match: this is somebody else.
  assert.equal(isManufacturerHost("notshure.com"), false);
  assert.equal(isManufacturerHost("shure.com.example.net"), false);
});

test("an off-allowlist link is read, but costs the job its auto-publish", () => {
  const v = vetSources(["https://manuals.example.net/some-mixer.pdf"]);
  assert.equal(v.accepted.length, 1);
  assert.equal(v.accepted[0]!.trusted, false);
  assert.equal(v.allTrusted, false);
  // Its host has to be opened for this job, since it is not on the allowlist.
  assert.deepEqual(v.extraDomains, ["manuals.example.net"]);
});

test("one untrusted source among trusted ones is enough to hold the whole job", () => {
  const v = vetSources([
    "https://pubs.shure.com/view/guide/ULXD/en-US.pdf",
    "https://someforum.example.com/thread/1",
  ]);
  assert.equal(v.accepted.length, 2);
  assert.equal(v.allTrusted, false);
});

test("non-http schemes, credentials and private addresses are refused", () => {
  const v = vetSources([
    "file:///C:/secrets.pdf",
    "javascript:alert(1)",
    "https://user:pw@shure.com/x",
    "http://localhost:3000/admin",
    "http://127.0.0.1/",
    "http://192.168.1.1/",
    "http://169.254.169.254/latest/meta-data/",
    "not a url at all",
  ]);
  assert.equal(v.accepted.length, 0, "nothing in that list should be fetched");
  assert.equal(v.rejected.length, 8);
  // Every rejection says why, because the user has to be told.
  for (const r of v.rejected) assert.ok(r.reason.length > 0, `${r.url} rejected with no reason`);
});

test("the cloud metadata address is refused specifically", () => {
  const v = vetSources(["http://169.254.169.254/latest/meta-data/iam/security-credentials/"]);
  assert.equal(v.accepted.length, 0);
  assert.match(v.rejected[0]!.reason, /public/);
});

test("duplicates collapse and the list is capped", () => {
  const dup = vetSources([
    "https://pubs.shure.com/a.pdf",
    "https://pubs.shure.com/a.pdf",
  ]);
  assert.equal(dup.accepted.length, 1);

  const many = Array.from({ length: MAX_SOURCES + 3 }, (_, i) => `https://rfvenue.com/${i}.pdf`);
  const capped = vetSources(many);
  assert.equal(capped.accepted.length, MAX_SOURCES);
  assert.equal(capped.rejected.length, 3);
  assert.match(capped.rejected[0]!.reason, /more than/);
});

test("an empty list asks for nothing and blocks nothing", () => {
  const v = vetSources([]);
  assert.equal(v.accepted.length, 0);
  // Vacuously true, and the caller must not read it as "there was an untrusted
  // source" — a plain search job is still allowed to auto-publish.
  assert.equal(v.allTrusted, true);
  assert.equal(sourcesPrompt(v), "", "no sources means no paragraph about sources");
});

test("the prompt names each source and says which are the manufacturer's", () => {
  const prompt = sourcesPrompt(
    vetSources([
      "https://pubs.shure.com/view/guide/ULXD/en-US.pdf",
      "https://manuals.example.net/x.pdf",
    ]),
  );
  assert.match(prompt, /pubs\.shure\.com/);
  assert.match(prompt, /manuals\.example\.net/);
  assert.match(prompt, /NOT a known manufacturer domain/);
  // The two halves that stop a dealer page becoming a citation.
  assert.match(prompt, /only a citation if it is the manufacturer's own document/);
  assert.match(prompt, /the manufacturer wins/);
});
