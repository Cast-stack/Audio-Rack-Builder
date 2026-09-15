/**
 * HTML to PDF.
 *
 * Two environments, one interface. In development and in any long-running
 * Node process there is a real Chromium on the machine, driven over the
 * DevTools protocol. On Vercel the function filesystem has no browser, so the
 * serverless build swaps in @sparticuz/chromium; the launch is the only part
 * that differs and it is isolated here.
 *
 * Deliberately no PDF library. The patch sheet's whole value is that what you
 * print is what the planner shows, and the only way to guarantee that is to
 * print with the same engine that renders the screen.
 */

export interface PdfOptions {
  landscape?: boolean;
  /** Paper size. Letter landscape is the patch sheet's native size. */
  format?: "Letter" | "A4";
  /** Executable to drive. Defaults to CHROMIUM_PATH, then the usual places. */
  executablePath?: string;
  /**
   * Running footer text. Chromium renders the footer into the page margin, so
   * the document's own @page margin has to leave room for it — the patch
   * sheet reserves 0.62in at the bottom for exactly this.
   */
  footerLeft?: string;
}

const CANDIDATES = [
  process.env["CHROMIUM_PATH"],
  "/opt/pw-browsers/chromium",
  "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/usr/bin/google-chrome",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
];

async function resolveExecutable(explicit?: string): Promise<string> {
  const { access } = await import("node:fs/promises");

  for (const c of [explicit, ...CANDIDATES]) {
    if (!c) continue;
    try {
      await access(c);
      return c;
    } catch {
      /* try the next one */
    }
  }
  throw new Error(
    "No Chromium found for PDF rendering. Set CHROMIUM_PATH, or install one where the export can reach it.",
  );
}

/**
 * Render a complete HTML document to PDF bytes.
 *
 * The page is loaded from a data URL rather than a temp file so this works
 * unchanged on a read-only serverless filesystem.
 */
export async function htmlToPdf(html: string, opts: PdfOptions = {}): Promise<Buffer> {
  const { chromium } = await import("playwright-core");
  const executablePath = await resolveExecutable(opts.executablePath);

  const browser = await chromium.launch({
    executablePath,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--font-render-hinting=none"],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    // The document declares its own @page size; letting Chromium apply it
    // keeps the CSS the single source of truth for the page geometry.
    const footer = opts.footerLeft;
    return await page.pdf({
      format: opts.format ?? "Letter",
      landscape: opts.landscape ?? true,
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: footer !== undefined,
      headerTemplate: "<div></div>",
      footerTemplate: footer === undefined ? "<div></div>" : runningFooter(footer),
    });
  } finally {
    await browser.close();
  }
}

/**
 * Chromium renders header and footer templates in an isolated document that
 * inherits none of the page's styles, so everything is stated inline.
 */
function runningFooter(left: string): string {
  const esc = (t: string) =>
    t.replace(/[&<>]/g, (c) => (c === "&" ? "&amp;" : c === "<" ? "&lt;" : "&gt;"));
  return (
    '<div style="width:100%;margin:0 0.5in;font:8px -apple-system,Helvetica,Arial,sans-serif;' +
    'color:#7C8792;display:flex;justify-content:space-between;border-top:0.5px solid #C9D1D8;padding-top:4px;">' +
    `<span>${esc(left)}</span>` +
    '<span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>' +
    "</div>"
  );
}
