/**
 * The taxonomy and the search allowlist.
 *
 * Categories span the whole production rack, not just audio — a touring rack
 * carries lighting nodes, video converters, switches and comms alongside the
 * IEM transmitters, and a planner that stops at audio makes you draw the rest
 * on paper. Domain is what keeps that from turning into an undifferentiated
 * list of 80 things in one dropdown.
 */

export type Domain =
  | "AUDIO" | "LIGHTING" | "VIDEO" | "NETWORK" | "POWER" | "COMMS" | "INFRASTRUCTURE";

/**
 * How the catalog is browsed.
 *
 * Domain is what the research pipeline reasons about; it is too coarse to
 * browse, because AUDIO alone is most of the catalog. Family is the shelf a
 * person actually walks to — it cuts across domain where the gear does, which
 * is why Dante converters sit with network switches under Networking & Digital
 * rather than off in AUDIO, and why a rack fan and a rack case share a shelf
 * even though one draws power and the other does not.
 *
 * Order here is the order they are shown. Wireless and RF leads because that
 * is what these racks are mostly made of.
 */
export type Family =
  | "Wireless & RF"
  | "Mixing & I/O"
  | "Monitoring"
  | "Snakes & Splits"
  | "Processing & Amps"
  | "Networking & Digital"
  | "Playback & Control"
  | "Power"
  | "Rack Hardware"
  | "Comms"
  | "Lighting"
  | "Video";

export const FAMILIES: Family[] = [
  "Wireless & RF",
  "Mixing & I/O",
  "Monitoring",
  "Snakes & Splits",
  "Processing & Amps",
  "Networking & Digital",
  "Playback & Control",
  "Power",
  "Rack Hardware",
  "Comms",
  "Lighting",
  "Video",
];

export interface CategoryDef {
  name: string;
  slug: string;
  domain: Domain;
  /** The shelf this category is browsed under. */
  family: Family;
  /** Passive categories must carry no power draw. Enforced by the guardrails. */
  passive?: boolean;
}

export const CATEGORIES: CategoryDef[] = [
  // ---- audio: wireless and RF
  { name: "IEM Transmitter", slug: "iem-transmitter", domain: "AUDIO", family: "Wireless & RF" },
  { name: "IEM Receiver", slug: "iem-receiver", domain: "AUDIO", family: "Wireless & RF" },
  { name: "Wireless Mic Receiver", slug: "wireless-mic-receiver", domain: "AUDIO", family: "Wireless & RF" },
  { name: "Wireless Guitar", slug: "wireless-guitar", domain: "AUDIO", family: "Wireless & RF" },
  { name: "Antenna Distro", slug: "antenna-distro", domain: "AUDIO", family: "Wireless & RF" },
  { name: "RF Antenna", slug: "rf-antenna", domain: "AUDIO", family: "Wireless & RF", passive: true },
  { name: "Spectrum Manager", slug: "spectrum-manager", domain: "AUDIO", family: "Wireless & RF" },

  // ---- audio: mixing, processing, conversion
  { name: "Digital Mixer", slug: "digital-mixer", domain: "AUDIO", family: "Mixing & I/O" },
  { name: "Stage Box", slug: "stage-box", domain: "AUDIO", family: "Mixing & I/O" },
  { name: "Audio Interface", slug: "audio-interface", domain: "AUDIO", family: "Mixing & I/O" },
  { name: "Mic Preamp", slug: "mic-preamp", domain: "AUDIO", family: "Mixing & I/O" },
  { name: "Personal Mixer", slug: "personal-mixer", domain: "AUDIO", family: "Monitoring" },
  { name: "Headphone Amp", slug: "headphone-amp", domain: "AUDIO", family: "Monitoring" },
  { name: "Dynamics Processor", slug: "dynamics-processor", domain: "AUDIO", family: "Processing & Amps" },
  { name: "Equalizer", slug: "equalizer", domain: "AUDIO", family: "Processing & Amps" },
  { name: "FX Processor", slug: "fx-processor", domain: "AUDIO", family: "Processing & Amps" },
  { name: "System Processor", slug: "system-processor", domain: "AUDIO", family: "Processing & Amps" },
  { name: "Dante Converter", slug: "dante-converter", domain: "AUDIO", family: "Networking & Digital" },
  { name: "MADI Converter", slug: "madi-converter", domain: "AUDIO", family: "Networking & Digital" },
  { name: "Word Clock", slug: "word-clock", domain: "AUDIO", family: "Networking & Digital" },
  { name: "Playback Switcher", slug: "playback-switcher", domain: "AUDIO", family: "Playback & Control" },

  // ---- audio: passive distribution
  { name: "Analog Snake", slug: "analog-snake", domain: "AUDIO", family: "Snakes & Splits", passive: true },
  { name: "Mic Splitter", slug: "mic-splitter", domain: "AUDIO", family: "Snakes & Splits", passive: true },
  { name: "DI Box", slug: "di-box", domain: "AUDIO", family: "Snakes & Splits", passive: true },
  { name: "Patch Bay", slug: "patch-bay", domain: "AUDIO", family: "Snakes & Splits", passive: true },
  { name: "Power Amplifier", slug: "power-amplifier", domain: "AUDIO", family: "Processing & Amps" },
  { name: "Earphones/IEMs", slug: "earphones", domain: "AUDIO", family: "Monitoring", passive: true },

  // ---- lighting
  { name: "Lighting Console", slug: "lighting-console", domain: "LIGHTING", family: "Lighting" },
  { name: "DMX Node", slug: "dmx-node", domain: "LIGHTING", family: "Lighting" },
  { name: "DMX Splitter", slug: "dmx-splitter", domain: "LIGHTING", family: "Lighting" },
  { name: "Dimmer", slug: "dimmer", domain: "LIGHTING", family: "Lighting" },
  { name: "Media Server", slug: "media-server", domain: "LIGHTING", family: "Lighting" },

  // ---- video
  { name: "Video Switcher", slug: "video-switcher", domain: "VIDEO", family: "Video" },
  { name: "Video Converter", slug: "video-converter", domain: "VIDEO", family: "Video" },
  { name: "Video Scaler", slug: "video-scaler", domain: "VIDEO", family: "Video" },
  { name: "Capture/Playback", slug: "capture-playback", domain: "VIDEO", family: "Video" },
  { name: "LED Processor", slug: "led-processor", domain: "VIDEO", family: "Video" },
  { name: "Monitor", slug: "monitor", domain: "VIDEO", family: "Video" },

  // ---- network
  { name: "Network Switch", slug: "network-switch", domain: "NETWORK", family: "Networking & Digital" },
  { name: "WiFi Access Point", slug: "wifi-access-point", domain: "NETWORK", family: "Networking & Digital" },
  { name: "Router/Firewall", slug: "router-firewall", domain: "NETWORK", family: "Networking & Digital" },
  { name: "Fibre Transport", slug: "fibre-transport", domain: "NETWORK", family: "Networking & Digital" },

  // ---- power
  { name: "Power Conditioner", slug: "power-conditioner", domain: "POWER", family: "Power" },
  { name: "Power Distro", slug: "power-distro", domain: "POWER", family: "Power" },
  { name: "UPS", slug: "ups", domain: "POWER", family: "Power" },
  { name: "Sequencer", slug: "sequencer", domain: "POWER", family: "Power" },

  // ---- comms
  { name: "Intercom Base", slug: "intercom-base", domain: "COMMS", family: "Comms" },
  { name: "Intercom Interface", slug: "intercom-interface", domain: "COMMS", family: "Comms" },

  // ---- infrastructure
  { name: "Rack Case", slug: "rack-case", domain: "INFRASTRUCTURE", family: "Rack Hardware", passive: true },
  { name: "Rack Drawer", slug: "rack-drawer", domain: "INFRASTRUCTURE", family: "Rack Hardware", passive: true },
  { name: "Rack Shelf", slug: "rack-shelf", domain: "INFRASTRUCTURE", family: "Rack Hardware", passive: true },
  { name: "Rack Fan", slug: "rack-fan", domain: "INFRASTRUCTURE", family: "Rack Hardware" },
  { name: "Vent Panel", slug: "vent-panel", domain: "INFRASTRUCTURE", family: "Rack Hardware", passive: true },
  { name: "Blank Panel", slug: "blank-panel", domain: "INFRASTRUCTURE", family: "Rack Hardware", passive: true },
  { name: "Computer", slug: "computer", domain: "INFRASTRUCTURE", family: "Playback & Control" },
  { name: "MIDI Controller", slug: "midi-controller", domain: "INFRASTRUCTURE", family: "Playback & Control" },
];

export const CATEGORY_NAMES = CATEGORIES.map((c) => c.name);

/** Category name -> the family it is browsed under. */
export const FAMILY_BY_CATEGORY = new Map<string, Family>(
  CATEGORIES.map((c) => [c.name, c.family]),
);

/**
 * The family a device belongs to.
 *
 * An unknown category is a real possibility once the research pipeline is
 * writing categories, so it lands in a named bucket rather than vanishing from
 * the browser. Silently dropping it would make a device unreachable in the one
 * place people look for gear.
 */
export function familyOf(category: string): Family | "Uncategorised" {
  return FAMILY_BY_CATEGORY.get(category) ?? "Uncategorised";
}

/** Categories of one family, in the order CATEGORIES declares them. */
export function categoriesOf(family: Family): CategoryDef[] {
  return CATEGORIES.filter((c) => c.family === family);
}
export const PASSIVE_CATEGORY_NAMES = new Set(
  CATEGORIES.filter((c) => c.passive).map((c) => c.name),
);

/**
 * The searcher's allowlist — the single biggest quality lever in the pipeline.
 * Restricting search to manufacturers removes the entire class of failure where
 * a confident forum post becomes a citation. Anything not here falls through to
 * the human queue rather than to a bad source.
 */
export const MANUFACTURER_DOMAINS = [
  // audio
  "shure.com", "pubs.shure.com", "sennheiser.com", "lectrosonics.com", "wisycom.com",
  "rfvenue.com", "audio-technica.com", "sony.com",
  "behringer.com", "midasconsoles.com", "klarkteknik.com",
  "allen-heath.com", "yamaha.com", "yamahaproaudio.com", "digico.biz",
  "avid.com", "solidstatelogic.com", "calrec.com",
  "motu.com", "rme-audio.de", "rme-usa.com", "focusrite.com", "focusritepro.com",
  "universalaudio.com", "apogeedigital.com", "antelopeaudio.com", "merging.com",
  "ferrofish.de", "directout.eu", "audinate.com", "atterotech.com",
  "qsc.com", "biamp.com", "bssaudio.com", "lab.gruppen.com", "powersoft.com",
  "crownaudio.com", "linea-research.co.uk",
  "radialeng.com", "whirlinc.com", "switchcraft.com", "neutrik.com", "canare.com",
  "rapcohorizon.com", "procosound.com",
  "64audio.com", "ultimateears.com", "westoneaudio.com", "jhaudio.com",

  // lighting
  "etcconnect.com", "malighting.com", "avolites.com", "chamsys.co.uk",
  "highend.com", "pathwayconnect.com", "luminex.be", "elationlighting.com",
  "chauvetprofessional.com", "robe.cz", "resolume.com", "disguise.one",

  // video
  "blackmagicdesign.com", "aja.com", "rolandproav.com", "barco.com",
  "novastar.tech", "brompton.tech", "analogway.com", "extron.com", "crestron.com",
  "kramerav.com", "lumens.com.tw", "decimator.com",

  // network
  "netgear.com", "cisco.com", "ui.com", "mikrotik.com", "luminex.be",
  "arista.com", "tp-link.com",

  // power and infrastructure
  "furmanpower.com", "surgex.com", "tripplite.com", "apc.com", "eaton.com",
  "motorizedrackpower.com", "lexproducts.com", "indu-electric.com",
  "gatorco.com", "skbcases.com", "penn-elcom.com", "middleatlantic.com",
  "raxxess.com", "acinfinity.com", "santosom.com",

  // comms
  "clearcom.com", "riedel.net", "greenGo-digital.com",

  // general
  "apple.com", "ableton.com",
];
