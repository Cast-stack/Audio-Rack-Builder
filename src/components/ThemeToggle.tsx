"use client";

import { useEffect, useState } from "react";

/**
 * Auto, light, dark.
 *
 * Three states rather than two, because "follow the machine" is a real answer
 * and the one most people want by default. Auto removes the attribute and
 * lets the prefers-color-scheme block in globals.css decide; the other two set
 * it and win in both directions.
 *
 * The same localStorage key as the standalone planner, THEME_KEY below. Both
 * are served from one origin, so choosing dark on the marketing page and then
 * opening /planner does not throw the choice away.
 */

export const THEME_KEY = "arb.theme.v1";

type Mode = "auto" | "light" | "dark";
const MODES: { value: Mode; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

function read(): Mode {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === "light" || v === "dark" ? v : "auto";
  } catch {
    return "auto";
  }
}

export default function ThemeToggle({ className = "" }: { className?: string }) {
  /**
   * Starts as "auto" on the server and on the first client render, then
   * corrects once mounted. Reading localStorage during render would make the
   * markup disagree with what the server sent and React would complain; the
   * inline script in layout.tsx has already applied the real theme by then, so
   * nothing flashes — only this control is briefly unlabelled.
   */
  const [mode, setMode] = useState<Mode>("auto");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setMode(read());
    setReady(true);
  }, []);

  function choose(next: Mode) {
    setMode(next);
    const root = document.documentElement;
    if (next === "auto") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", next);
    try {
      if (next === "auto") localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, next);
    } catch {
      /* blocked storage — the choice lasts this page */
    }
  }

  return (
    <div
      role="group"
      aria-label="Colour theme"
      className={`flex border border-line ${className}`}
    >
      {MODES.map((m) => (
        <button
          key={m.value}
          type="button"
          data-theme-set={m.value}
          aria-pressed={ready ? mode === m.value : undefined}
          onClick={() => choose(m.value)}
          className={
            "px-2 py-1 font-mono text-[0.625rem] uppercase tracking-legend transition-colors " +
            (ready && mode === m.value
              ? "bg-accent text-accent-ink"
              : "text-muted hover:bg-raised hover:text-ink")
          }
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}
