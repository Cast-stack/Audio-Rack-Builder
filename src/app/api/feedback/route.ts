/**
 * POST /api/feedback  { message, contact?, context?, website? }
 * GET  /api/feedback                          (admin only)
 *
 * Anyone can send; only an operator can read.
 *
 * Posting is deliberately open — no account, no captcha, no required email.
 * The most valuable message this app will ever receive is "the depth was
 * wrong on the SM7B rack", sent from a phone at a load-in by someone who will
 * never sign up, and every gate between them and the send button loses more
 * of those than it stops bots.
 *
 * What stands in for a gate: a hidden honeypot field, a per-IP rate limit, and
 * length caps. All three are cheap and none of them ask the person for
 * anything.
 */

import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { validateFeedback } from "@/lib/feedback";

export const maxDuration = 30;

/**
 * Reading the queue is an operator action, gated the same way the gear lookup
 * is: ARB_ADMIN_TOKEN, or nothing doing. A closed gate answers 404 rather than
 * 403, so the endpoint does not advertise itself.
 */
function isAdmin(request: Request): boolean {
  const token = process.env.ARB_ADMIN_TOKEN;
  if (!token) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${token}`);
  return given.length === want.length && timingSafeEqual(given, want);
}

/**
 * Six messages an hour from one address. Generous for a person who has found
 * three separate things wrong, tedious for a script.
 */
const WINDOW_MS = 60 * 60 * 1000;
const PER_WINDOW = 6;
const hits = new Map<string, number[]>();

function overLimit(key: string): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= PER_WINDOW) {
    hits.set(key, recent);
    return true;
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) {
    for (const [k, v] of hits) if (!v.some((t) => now - t < WINDOW_MS)) hits.delete(k);
  }
  return false;
}

/**
 * Used for rate limiting and then thrown away — it is never stored with the
 * message. See the Feedback model for why.
 */
function callerKey(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  return (fwd ? fwd.split(",")[0]!.trim() : null) ?? request.headers.get("x-real-ip") ?? "anonymous";
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const verdict = validateFeedback(body ?? {});

  if (!verdict.ok) {
    // A honeypot hit is thanked and dropped. Telling a bot it was caught only
    // teaches whoever wrote it which field to leave alone next time.
    if (verdict.silent) return NextResponse.json({ ok: true });
    return NextResponse.json({ error: verdict.reason }, { status: 400 });
  }

  if (overLimit(callerKey(request))) {
    return NextResponse.json(
      { error: "That is a lot of feedback in one hour. Give it a little while, or get in touch directly." },
      { status: 429 },
    );
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { error: "Feedback is not set up on this server yet. Nothing was sent." },
      { status: 503 },
    );
  }

  try {
    const { prisma } = await import("@/lib/db/client");
    await prisma.feedback.create({ data: verdict.value });
    return NextResponse.json({ ok: true });
  } catch {
    // Never imply a message was kept when it was not: someone who thinks they
    // have reported a wrong depth will not report it again.
    return NextResponse.json(
      { error: "Could not save that. Nothing was sent — please try again." },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  if (!isAdmin(request)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "No database configured." }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const state = searchParams.get("state");

  const { prisma } = await import("@/lib/db/client");
  const items = await prisma.feedback.findMany({
    where: state === "NEW" || state === "READ" || state === "DONE" ? { state } : undefined,
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return NextResponse.json({ items });
}

/** Mark one message read or done, so the queue can be worked through. */
export async function PATCH(request: Request) {
  if (!isAdmin(request)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "No database configured." }, { status: 503 });
  }

  const body = (await request.json().catch(() => null)) as
    | { id?: string; state?: string; note?: string }
    | null;
  const state = body?.state;
  if (!body?.id || (state !== "NEW" && state !== "READ" && state !== "DONE")) {
    return NextResponse.json({ error: "Expected { id, state: NEW | READ | DONE, note? }" }, { status: 400 });
  }

  const { prisma } = await import("@/lib/db/client");
  const updated = await prisma.feedback.update({
    where: { id: body.id },
    data: { state, note: typeof body.note === "string" ? body.note.slice(0, 2000) : undefined },
  });
  return NextResponse.json({ item: updated });
}
