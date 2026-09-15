import type { CheckResult, Severity } from "@/lib/rack/types";

/**
 * The feasibility report.
 *
 * Severity is carried three ways — a chip word, a distinct glyph shape, and the
 * weight and pattern of the left stripe — so it survives greyscale printing and
 * colour-blind readers. Colour is confirmation, never the only signal.
 */

const ORDER: Record<Severity, number> = { error: 0, warning: 1, info: 2 };

const CHIP: Record<Severity, { word: string; stripe: string; chip: string }> = {
  error: {
    word: "Fail",
    stripe: "bg-err",
    chip: "border-err text-err bg-err-wash",
  },
  warning: {
    word: "Check",
    stripe: "bg-warn",
    chip: "border-warn text-warn bg-warn-wash",
  },
  info: {
    word: "Note",
    stripe: "bg-line-strong",
    chip: "border-line-strong text-muted bg-sunken",
  },
};

function Glyph({ severity }: { severity: Severity }) {
  const common = { width: 11, height: 11, viewBox: "0 0 12 12", "aria-hidden": true } as const;
  if (severity === "error") {
    // Octagon — the stop shape.
    return (
      <svg {...common} className="shrink-0">
        <path d="M4 0.6h4L11.4 4v4L8 11.4H4L0.6 8V4z" fill="currentColor" />
      </svg>
    );
  }
  if (severity === "warning") {
    // Triangle.
    return (
      <svg {...common} className="shrink-0">
        <path d="M6 0.6 11.6 11H0.4z" fill="currentColor" />
      </svg>
    );
  }
  // Ring.
  return (
    <svg {...common} className="shrink-0">
      <circle cx="6" cy="6" r="4.6" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function stripeStyle(severity: Severity): React.CSSProperties {
  if (severity === "error") return {};
  if (severity === "warning") {
    return {
      backgroundImage:
        "repeating-linear-gradient(180deg, currentColor 0 7px, transparent 7px 12px)",
      backgroundColor: "transparent",
      color: "var(--warn)",
    };
  }
  return {
    backgroundImage:
      "repeating-linear-gradient(180deg, currentColor 0 2px, transparent 2px 6px)",
    backgroundColor: "transparent",
    color: "var(--line-strong)",
  };
}

export interface CheckPanelProps {
  results: CheckResult[];
  /** Heading shown above the list. */
  title?: string;
  className?: string;
}

export default function CheckPanel({ results, title = "Feasibility", className = "" }: CheckPanelProps) {
  const sorted = [...results].sort((a, b) => ORDER[a.severity] - ORDER[b.severity]);
  const errors = sorted.filter((r) => r.severity === "error").length;
  const warnings = sorted.filter((r) => r.severity === "warning").length;

  return (
    <section className={`panel ${className}`} aria-label={`${title} results`}>
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-line px-3 py-2">
        <h2 className="font-display text-base font-semibold uppercase tracking-[0.06em]">
          {title}
        </h2>
        <p className="num font-mono text-[0.6875rem] uppercase tracking-legend text-muted">
          {errors > 0 ? (
            <span className="text-err">{errors} fail</span>
          ) : (
            <span className="text-ok">0 fail</span>
          )}
          <span className="text-faint"> / </span>
          <span className={warnings > 0 ? "text-warn" : undefined}>{warnings} check</span>
        </p>
      </header>

      {sorted.length === 0 ? (
        <p className="px-3 py-4 text-sm text-muted">
          Nothing to flag. Depth, load, balance and heat all clear on the current build.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {sorted.map((r, i) => {
            const c = CHIP[r.severity];
            return (
              <li key={`${r.code}-${i}`} className="flex gap-0">
                <span
                  aria-hidden
                  className={`w-1 shrink-0 ${r.severity === "error" ? c.stripe : ""}`}
                  style={stripeStyle(r.severity)}
                />
                <div className="min-w-0 flex-1 px-3 py-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 border px-1.5 py-0.5 font-mono text-[0.625rem] font-medium uppercase tracking-legend ${c.chip}`}
                    >
                      <Glyph severity={r.severity} />
                      {c.word}
                    </span>
                    <h3 className="font-display text-[0.95rem] font-semibold leading-tight">
                      {r.title}
                    </h3>
                  </div>
                  <p className="mt-1 max-w-[62ch] text-sm leading-relaxed text-muted">
                    {r.detail}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                    {r.positions && r.positions.length > 0 ? (
                      <span className="num legend">
                        {r.positions.length === 1 ? "unit" : "units"}{" "}
                        {r.positions.map((p) => `U${p}`).join(" ")}
                      </span>
                    ) : null}
                    {r.circuit ? <span className="legend">circuit {r.circuit}</span> : null}
                    <span className="legend text-faint">{r.code}</span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
