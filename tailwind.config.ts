import type { Config } from "tailwindcss";

/**
 * Colour lives in CSS custom properties (see src/app/globals.css) so that the
 * light and dark palettes are defined once, in one place, and Tailwind classes
 * stay theme-agnostic. Nothing here hard-codes a hex value.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        raised: "var(--surface-2)",
        sunken: "var(--sunken)",
        ink: "var(--fg)",
        muted: "var(--fg-muted)",
        faint: "var(--fg-faint)",
        line: "var(--line)",
        "line-strong": "var(--line-strong)",
        accent: "var(--accent)",
        "accent-ink": "var(--accent-fg)",
        err: "var(--err)",
        "err-wash": "var(--err-wash)",
        warn: "var(--warn)",
        "warn-wash": "var(--warn-wash)",
        ok: "var(--ok)",
        "ok-wash": "var(--ok-wash)",
      },
      fontFamily: {
        display: ["var(--font-display)", "ui-sans-serif", "system-ui", "sans-serif"],
        body: ["var(--font-body)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      borderRadius: {
        none: "0",
        sm: "1px",
        DEFAULT: "2px",
        md: "3px",
      },
      letterSpacing: {
        legend: "0.14em",
      },
      spacing: {
        u: "var(--u)",
      },
    },
  },
  plugins: [],
};

export default config;
