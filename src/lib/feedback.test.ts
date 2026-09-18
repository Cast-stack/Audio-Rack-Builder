/**
 * The rules that decide whether someone's message reaches you.
 *
 * Every one of these is a judgement about who gets heard. A rule that quietly
 * drops a real message is worse than a rule that lets a bot through, because
 * you can delete a bot and you will never know about the person.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { CONTACT_MAX, MESSAGE_MAX, validateFeedback } from "./feedback";

test("an ordinary message gets through", () => {
  const v = validateFeedback({ message: "The depth ledger saved my load-in. Thanks." });
  assert.equal(v.ok, true);
  assert.ok(v.ok && v.value.message.startsWith("The depth ledger"));
  assert.equal(v.ok && v.value.contact, null, "contact stays optional");
});

test("line breaks survive, because a list of three problems is the useful kind", () => {
  const v = validateFeedback({ message: "Three things:\n\n- depth wrong\n- rear view mirrored\n- slow" });
  assert.ok(v.ok);
  assert.ok(v.ok && v.value.message.includes("\n- rear view mirrored"));
});

test("runs of spaces collapse but the words do not", () => {
  const v = validateFeedback({ message: "too    many     spaces here" });
  assert.equal(v.ok && v.value.message, "too many spaces here");
});

test("a message too short to act on is refused, kindly", () => {
  const v = validateFeedback({ message: "hi" });
  assert.equal(v.ok, false);
  assert.ok(!v.ok && /at least/.test(v.reason));
});

test("a paste bomb is refused with a way forward", () => {
  const v = validateFeedback({ message: "x".repeat(MESSAGE_MAX + 1) });
  assert.equal(v.ok, false);
  assert.ok(!v.ok && /follow up/.test(v.reason), "it says what to do instead");
});

test("the honeypot is dropped silently, so a bot learns nothing", () => {
  const v = validateFeedback({ message: "a real looking message", website: "http://spam.example" });
  assert.equal(v.ok, false);
  assert.ok(!v.ok && v.silent === true, "a refusal a bot can see is a refusal it can tune against");
});

test("a blank honeypot is what a person sends, and passes", () => {
  const v = validateFeedback({ message: "a real message from a person", website: "" });
  assert.equal(v.ok, true);
});

test("contact is kept when given and capped when absurd", () => {
  const ok = validateFeedback({ message: "call me", contact: "jose@example.com" });
  assert.equal(ok.ok && ok.value.contact, "jose@example.com");

  const long = validateFeedback({ message: "call me", contact: "x".repeat(CONTACT_MAX + 1) });
  assert.equal(long.ok, false);
});

test("context is recorded but never trusted to be short", () => {
  const v = validateFeedback({ message: "something broke", context: "planner · " + "y".repeat(2000) });
  assert.ok(v.ok);
  assert.ok(v.ok && v.value.context!.length <= 500);
});

test("nothing at all is refused rather than stored empty", () => {
  assert.equal(validateFeedback({}).ok, false);
  assert.equal(validateFeedback({ message: "   " }).ok, false);
  assert.equal(validateFeedback({ message: 42 }).ok, false);
});
