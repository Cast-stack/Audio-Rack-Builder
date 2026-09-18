/**
 * The feedback queue. /admin/feedback
 *
 * Deliberately plain: a list, oldest problem still open at the top of your
 * attention, and two buttons per message. The point of the page is that a
 * message someone sent from a loading dock gets read and acted on, not that
 * it gets triaged in a nice interface.
 *
 * The page itself is not secret — it renders for anyone who types the URL —
 * but it holds nothing until the API answers, and the API answers 404 without
 * ARB_ADMIN_TOKEN. The token is entered once and kept in this browser, under
 * the same key the planner uses, so signing in on one signs in on both.
 */

"use client";

import { useCallback, useEffect, useState } from "react";

const ADMIN_STORE = "arb.admin.token.v1";

type State = "NEW" | "READ" | "DONE";

interface Item {
  id: string;
  createdAt: string;
  message: string;
  contact: string | null;
  context: string | null;
  state: State;
  note: string | null;
}

function readToken(): string {
  try {
    return localStorage.getItem(ADMIN_STORE) ?? "";
  } catch {
    return "";
  }
}

export default function FeedbackAdminPage() {
  const [token, setToken] = useState("");
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => setToken(readToken()), []);

  const load = useCallback(async (auth: string) => {
    if (!auth) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/feedback", { headers: { authorization: `Bearer ${auth}` } });
      if (res.status === 404) {
        // The gate answers 404 to everyone without the token, so a wrong
        // token and a server with no token set look identical from here.
        setError("That token was refused, or this server has no ARB_ADMIN_TOKEN set.");
        setItems(null);
        return;
      }
      const body = await res.json();
      if (!res.ok) {
        setError(body?.error ?? `Request failed (${res.status}).`);
        setItems(null);
        return;
      }
      setItems(body.items as Item[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (token) void load(token);
  }, [token, load]);

  async function mark(id: string, state: State) {
    const res = await fetch("/api/feedback", {
      method: "PATCH",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ id, state }),
    });
    if (!res.ok) {
      setError("Could not update that one.");
      return;
    }
    setItems((prev) => prev?.map((i) => (i.id === id ? { ...i, state } : i)) ?? prev);
  }

  function signIn(value: string) {
    try {
      if (value) localStorage.setItem(ADMIN_STORE, value);
      else localStorage.removeItem(ADMIN_STORE);
    } catch {
      // A browser with storage blocked still works for this session.
    }
    setToken(value);
  }

  const newest = items?.filter((i) => i.state === "NEW").length ?? 0;

  return (
    <main className="mx-auto w-full max-w-[900px] px-4 py-10 sm:px-6">
      <header>
        <p className="legend">From the people using it</p>
        <h1 className="mt-2 font-display text-4xl font-bold uppercase leading-[0.95] tracking-[0.01em]">
          Feedback
        </h1>
        <p className="mt-3 max-w-[66ch] text-base leading-relaxed text-muted">
          Sent anonymously from the planner. No address, no account, no IP — if someone wanted an
          answer they left a way to reach them, and that is the only thing here that identifies
          anybody.
        </p>
      </header>

      {!token ? (
        <form
          className="panel mt-8 flex flex-col gap-3 p-4"
          onSubmit={(ev) => {
            ev.preventDefault();
            const input = new FormData(ev.currentTarget).get("token");
            signIn(typeof input === "string" ? input.trim() : "");
          }}
        >
          <label className="legend" htmlFor="token">
            Admin token
          </label>
          <input
            id="token"
            name="token"
            type="password"
            autoComplete="off"
            className="border border-line bg-surface px-2 py-1.5 font-mono text-sm"
          />
          <button type="submit" className="self-start border border-line px-3 py-1.5 text-sm">
            Sign in
          </button>
        </form>
      ) : null}

      {error ? (
        <p className="mt-6 border-l-[3px] border-err bg-err-wash px-3 py-2 text-sm">{error}</p>
      ) : null}

      {token ? (
        <div className="mt-6 flex items-center gap-3 text-sm text-muted">
          <button
            type="button"
            className="border border-line px-2 py-1"
            onClick={() => void load(token)}
            disabled={busy}
          >
            {busy ? "Loading…" : "Refresh"}
          </button>
          <button type="button" className="border border-line px-2 py-1" onClick={() => signIn("")}>
            Sign out
          </button>
          {items ? (
            <span className="font-mono text-xs">
              {items.length} message{items.length === 1 ? "" : "s"}
              {newest ? ` · ${newest} unread` : ""}
            </span>
          ) : null}
        </div>
      ) : null}

      {items && items.length === 0 ? (
        <p className="mt-8 text-sm text-muted">Nothing yet.</p>
      ) : null}

      <div className="mt-6 flex flex-col gap-4">
        {items?.map((item) => (
          <article
            key={item.id}
            className={`panel p-4 ${item.state === "DONE" ? "opacity-60" : ""}`}
          >
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="legend">{new Date(item.createdAt).toLocaleString()}</span>
              <span className="font-mono text-[0.625rem] uppercase tracking-legend text-muted">
                {item.state}
              </span>
              {item.contact ? (
                <span className="font-mono text-xs">reply to {item.contact}</span>
              ) : null}
            </div>

            {/* Their words, their line breaks. A bullet list of three problems
                is the most useful shape feedback comes in. */}
            <p className="mt-2 whitespace-pre-wrap text-base leading-relaxed">{item.message}</p>

            {item.context ? (
              <p className="mt-2 font-mono text-[0.625rem] leading-relaxed text-muted">
                {item.context}
              </p>
            ) : null}

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                className="border border-line px-2 py-1 text-xs"
                onClick={() => void mark(item.id, item.state === "READ" ? "NEW" : "READ")}
              >
                {item.state === "READ" ? "Mark unread" : "Mark read"}
              </button>
              <button
                type="button"
                className="border border-line px-2 py-1 text-xs"
                onClick={() => void mark(item.id, item.state === "DONE" ? "READ" : "DONE")}
              >
                {item.state === "DONE" ? "Reopen" : "Done"}
              </button>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
