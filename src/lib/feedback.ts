/**
 * What counts as a piece of feedback worth keeping.
 *
 * Anonymous and unauthenticated, because the people most likely to write are
 * the ones who hit something wrong on a load-in and will not make an account
 * to say so. That shapes every rule here: accept almost anything a person
 * types, refuse the shapes that are only ever bots, and never lose a real
 * message to a validation rule that was really a spam filter in disguise.
 *
 * Pure: no database, no network. The route does the storing.
 */

/** Long enough to say something, short enough not to be a paste bomb. */
export const MESSAGE_MIN = 4;
export const MESSAGE_MAX = 4000;
export const CONTACT_MAX = 200;
/** Where they were. Not trusted, just recorded. */
export const CONTEXT_MAX = 500;

export interface FeedbackInput {
  message?: unknown;
  contact?: unknown;
  context?: unknown;
  /** Hidden field a person never fills in and a naive bot always does. */
  website?: unknown;
}

export interface CleanFeedback {
  message: string;
  contact: string | null;
  context: string | null;
}

export type FeedbackVerdict =
  | { ok: true; value: CleanFeedback }
  | { ok: false; reason: string; silent?: boolean };

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/**
 * Collapse runs of whitespace but keep line breaks: someone pasting a bullet
 * list of three problems is writing the most useful kind of feedback there is,
 * and flattening it into one paragraph loses their structure.
 */
function tidy(s: string): string {
  return s.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

export function validateFeedback(input: FeedbackInput): FeedbackVerdict {
  // The honeypot is hidden from people and irresistible to simple bots. It is
  // accepted and dropped rather than refused, so a bot gets no signal to tune
  // against — hence `silent`.
  if (str(input.website)) return { ok: false, reason: "dropped", silent: true };

  const message = tidy(str(input.message));
  if (message.length < MESSAGE_MIN) {
    return { ok: false, reason: `Tell us a bit more — at least ${MESSAGE_MIN} characters.` };
  }
  if (message.length > MESSAGE_MAX) {
    return { ok: false, reason: `That is longer than ${MESSAGE_MAX} characters. Send the short version and we can follow up.` };
  }

  const contact = tidy(str(input.contact));
  if (contact.length > CONTACT_MAX) {
    return { ok: false, reason: "That contact detail is too long." };
  }

  return {
    ok: true,
    value: {
      message,
      // Optional on purpose. A reply address is useful; demanding one costs
      // more messages than it gains answers.
      contact: contact || null,
      context: tidy(str(input.context)).slice(0, CONTEXT_MAX) || null,
    },
  };
}
