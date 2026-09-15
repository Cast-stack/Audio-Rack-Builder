import type { Metadata } from "next";
import Link from "next/link";
import { Barlow_Condensed, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

const display = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

const body = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Audio Rack Builder",
  description:
    "Plan a production rack against the numbers that decide whether it closes: real depth behind the rails, per-circuit load after the NEC derate, inrush at power-up, centre of gravity and heat.",
};

const NAV = [
  { href: "/planner", label: "Planner" },
  { href: "/catalog", label: "Catalog" },
  { href: "/how-it-works", label: "How it works" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body className="min-h-screen bg-bg text-ink antialiased">
        <header className="sticky top-0 z-30 border-b border-line bg-surface">
          <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2.5 sm:px-6">
            <Link href="/" className="group flex items-baseline gap-2">
              <span
                aria-hidden
                className="inline-block h-3 w-3 translate-y-[1px] border border-line-strong bg-accent"
              />
              <span className="font-display text-lg font-semibold uppercase tracking-[0.08em] leading-none">
                Audio Rack Builder
              </span>
            </Link>
            <nav aria-label="Primary" className="ml-auto flex items-center gap-1">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="border border-transparent px-2.5 py-1.5 font-mono text-[0.6875rem] uppercase tracking-legend text-muted hover:border-line hover:bg-raised hover:text-ink"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        {children}
        <footer className="mt-16 border-t border-line bg-surface">
          <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
            <p className="max-w-[60ch] text-sm text-muted">
              Every figure in this tool traces back to a manufacturer document, and every
              figure that was derived rather than published says so on the spec row. Working
              allowances for connector projection and cable bend are planning numbers, listed
              in full on{" "}
              <Link href="/how-it-works" className="text-accent underline underline-offset-4">
                How it works
              </Link>
              .
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
