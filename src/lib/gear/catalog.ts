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

export interface CategoryDef {
  name: string;
  slug: string;
  domain: Domain;
  /** Passive categories must carry no power draw. Enforced by the guardrails. */
  passive?: boolean;
}

export const CATEGORIES: CategoryDef[] = [
  // ---- audio: wireless and RF
  { name: "IEM Transmitter", slug: "iem-transmitter", domain: "AUDIO" },
  { name: "IEM Receiver", slug: "iem-receiver", domain: "AUDIO" },
  { name: "Wireless Mic Receiver", slug: "wireless-mic-receiver", domain: "AUDIO" },
  { name: "Wireless Guitar", slug: "wireless-guitar", domain: "AUDIO" },
  { name: "Antenna Distro", slug: "antenna-distro", domain: "AUDIO" },
  { name: "RF Antenna", slug: "rf-antenna", domain: "AUDIO", passive: true },
  { name: "Spectrum Manager", slug: "spectrum-manager", domain: "AUDIO" },

  // ---- audio: mixing, processing, conversion
  { name: "Digital Mixer", slug: "digital-mixer", domain: "AUDIO" },
  { name: "Stage Box", slug: "stage-box", domain: "AUDIO" },
  { name: "Audio Interface", slug: "audio-interface", domain: "AUDIO" },
  { name: "Mic Preamp", slug: "mic-preamp", domain: "AUDIO" },
  { name: "Personal Mixer", slug: "personal-mixer", domain: "AUDIO" },
  { name: "Headphone Amp", slug: "headphone-amp", domain: "AUDIO" },
  { name: "Dynamics Processor", slug: "dynamics-processor", domain: "AUDIO" },
  { name: "Equalizer", slug: "equalizer", domain: "AUDIO" },
  { name: "FX Processor", slug: "fx-processor", domain: "AUDIO" },
  { name: "System Processor", slug: "system-processor", domain: "AUDIO" },
  { name: "Dante Converter", slug: "dante-converter", domain: "AUDIO" },
  { name: "MADI Converter", slug: "madi-converter", domain: "AUDIO" },
  { name: "Word Clock", slug: "word-clock", domain: "AUDIO" },
  { name: "Playback Switcher", slug: "playback-switcher", domain: "AUDIO" },

  // ---- audio: passive distribution
  { name: "Analog Snake", slug: "analog-snake", domain: "AUDIO", passive: true },
  { name: "Mic Splitter", slug: "mic-splitter", domain: "AUDIO", passive: true },
  { name: "DI Box", slug: "di-box", domain: "AUDIO", passive: true },
  { name: "Patch Bay", slug: "patch-bay", domain: "AUDIO", passive: true },
  { name: "Power Amplifier", slug: "power-amplifier", domain: "AUDIO" },
  { name: "Earphones/IEMs", slug: "earphones", domain: "AUDIO", passive: true },

  // ---- lighting
  { name: "Lighting Console", slug: "lighting-console", domain: "LIGHTING" },
  { name: "DMX Node", slug: "dmx-node", domain: "LIGHTING" },
  { name: "DMX Splitter", slug: "dmx-splitter", domain: "LIGHTING" },
  { name: "Dimmer", slug: "dimmer", domain: "LIGHTING" },
  { name: "Media Server", slug: "media-server", domain: "LIGHTING" },

  // ---- video
  { name: "Video Switcher", slug: "video-switcher", domain: "VIDEO" },
  { name: "Video Converter", slug: "video-converter", domain: "VIDEO" },
  { name: "Video Scaler", slug: "video-scaler", domain: "VIDEO" },
  { name: "Capture/Playback", slug: "capture-playback", domain: "VIDEO" },
  { name: "LED Processor", slug: "led-processor", domain: "VIDEO" },
  { name: "Monitor", slug: "monitor", domain: "VIDEO" },

  // ---- network
  { name: "Network Switch", slug: "network-switch", domain: "NETWORK" },
  { name: "WiFi Access Point", slug: "wifi-access-point", domain: "NETWORK" },
  { name: "Router/Firewall", slug: "router-firewall", domain: "NETWORK" },
  { name: "Fibre Transport", slug: "fibre-transport", domain: "NETWORK" },

  // ---- power
  { name: "Power Conditioner", slug: "power-conditioner", domain: "POWER" },
  { name: "Power Distro", slug: "power-distro", domain: "POWER" },
  { name: "UPS", slug: "ups", domain: "POWER" },
  { name: "Sequencer", slug: "sequencer", domain: "POWER" },

  // ---- comms
  { name: "Intercom Base", slug: "intercom-base", domain: "COMMS" },
  { name: "Intercom Interface", slug: "intercom-interface", domain: "COMMS" },

  // ---- infrastructure
  { name: "Rack Case", slug: "rack-case", domain: "INFRASTRUCTURE", passive: true },
  { name: "Rack Drawer", slug: "rack-drawer", domain: "INFRASTRUCTURE", passive: true },
  { name: "Rack Shelf", slug: "rack-shelf", domain: "INFRASTRUCTURE", passive: true },
  { name: "Rack Fan", slug: "rack-fan", domain: "INFRASTRUCTURE" },
  { name: "Vent Panel", slug: "vent-panel", domain: "INFRASTRUCTURE", passive: true },
  { name: "Blank Panel", slug: "blank-panel", domain: "INFRASTRUCTURE", passive: true },
  { name: "Computer", slug: "computer", domain: "INFRASTRUCTURE" },
  { name: "MIDI Controller", slug: "midi-controller", domain: "INFRASTRUCTURE" },
];

export const CATEGORY_NAMES = CATEGORIES.map((c) => c.name);
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
