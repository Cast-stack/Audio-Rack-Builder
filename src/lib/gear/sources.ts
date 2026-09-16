/**
 * Vetting the links a person hands us.
 *
 * Someone asking for a device they own usually knows exactly where its manual
 * lives, and that link is worth more than any search we could run. But a link
 * from a user is not the same thing as a manufacturer source, and the whole
 * value of this catalog rests on not confusing the two.
 *
 * So supplied links are accepted and read, and their provenance is marked for
 * what it is. A link to pubs.shure.com is a manufacturer document. A link to a
 * dealer, a wiki or somebody's Dropbox is a lead, not a citation — the record
 * it produces can never publish itself, no matter how clean it looks.
 *
 * Pure: no network, no database, no model. Just the rules.
 */

import { MANUFACTURER_DOMAINS } from "./catalog";

export interface SourceRef {
  /** The URL as given, normalised. */
  url: string;
  /** Lowercased hostname, no port. */
  host: string;
  /** Host is on the manufacturer allowlist. */
  trusted: boolean;
}

export interface RejectedSource {
  url: string;
  reason: string;
}

export interface VettedSources {
  accepted: SourceRef[];
  rejected: RejectedSource[];
  /** Hosts to open for this job, on top of the standing allowlist. */
  extraDomains: string[];
  /**
   * True when every accepted source is a manufacturer document. A job with
   * even one off-allowlist source may not auto-publish.
   */
  allTrusted: boolean;
}

/** More than this and someone is pointing a crawler at us, not asking for a device. */
export const MAX_SOURCES = 5;

/**
 * Hosts that must never be fetched.
 *
 * The fetch runs inside Anthropic's infrastructure rather than ours, so this
 * is not the usual SSRF hole — but "not our network" is not a reason to pass
 * along a request for someone's router admin page, and a link like this is
 * always a mistake or an attack, never a spec sheet.
 */
function isPrivateHost(host: string): boolean {
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return true;
  if (host === "[::1]" || host === "::1") return true;
  // Dotted-quad in a private or loopback range.
  const quad = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (quad) {
    const [a, b] = [Number(quad[1]), Number(quad[2])];
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 169 && b === 254) return true; // link-local, the cloud metadata address
  }
  return false;
}

/** Does this host sit on, or under, an allowlisted manufacturer domain? */
export function isManufacturerHost(host: string): boolean {
  const h = host.toLowerCase();
  return MANUFACTURER_DOMAINS.some((d) => {
    const domain = d.toLowerCase();
    return h === domain || h.endsWith(`.${domain}`);
  });
}

/**
 * Turn whatever was typed into a list we are willing to fetch.
 *
 * Rejections are returned rather than thrown, because the useful answer to
 * four good links and one bad one is to read the four and say what happened to
 * the fifth.
 */
export function vetSources(raw: readonly string[]): VettedSources {
  const accepted: SourceRef[] = [];
  const rejected: RejectedSource[] = [];
  const seen = new Set<string>();

  for (const entry of raw) {
    const text = String(entry ?? "").trim();
    if (!text) continue;

    if (accepted.length >= MAX_SOURCES) {
      rejected.push({ url: text, reason: `more than ${MAX_SOURCES} sources; not read` });
      continue;
    }

    let parsed: URL;
    try {
      parsed = new URL(text);
    } catch {
      rejected.push({ url: text, reason: "not a URL" });
      continue;
    }

    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      rejected.push({ url: text, reason: `${parsed.protocol.replace(":", "")} links are not fetched` });
      continue;
    }
    if (parsed.username || parsed.password) {
      rejected.push({ url: text, reason: "credentials in the URL" });
      continue;
    }

    const host = parsed.hostname.toLowerCase();
    if (!host || isPrivateHost(host)) {
      rejected.push({ url: text, reason: "not a public address" });
      continue;
    }

    const url = parsed.toString();
    if (seen.has(url)) continue;
    seen.add(url);

    accepted.push({ url, host, trusted: isManufacturerHost(host) });
  }

  const extraDomains = Array.from(
    new Set(accepted.filter((s) => !s.trusted).map((s) => s.host)),
  );

  return {
    accepted,
    rejected,
    extraDomains,
    allTrusted: accepted.every((s) => s.trusted),
  };
}

/**
 * The paragraph the researcher gets about these links.
 *
 * It says where they came from and what that is worth, because the model has
 * to weigh them against what it finds itself. A user's link is a strong lead
 * and a weak citation, and the prompt has to be explicit about both halves or
 * the model will treat a dealer page as gospel because a human offered it.
 */
export function sourcesPrompt(vetted: VettedSources): string {
  if (!vetted.accepted.length) return "";

  const lines = [
    "",
    "SOURCES SUPPLIED BY THE PERSON ASKING",
    "",
    "Read these before searching. They are a strong lead: this person probably owns the unit and knows where its documentation is.",
    "",
  ];

  for (const s of vetted.accepted) {
    lines.push(`- ${s.url}${s.trusted ? "  (manufacturer domain)" : "  (NOT a known manufacturer domain)"}`);
  }

  lines.push(
    "",
    "They do not change the rules. A supplied link is only a citation if it is the manufacturer's own document; if it is a dealer, a wiki, a marketplace or a file locker, use it to find the real document and cite that instead. Quote whatever you actually read.",
    "",
    "If a supplied source disagrees with the manufacturer, the manufacturer wins, and say so in notes.",
    "",
    "If a supplied link is dead, is about a different unit, or does not contain specifications, say that in notes rather than quietly falling back to a search.",
  );

  return lines.join("\n");
}
