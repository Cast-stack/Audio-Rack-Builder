/**
 * Starter catalog.
 *
 * Every device here came out of the research pipeline against manufacturer
 * sources, and carries the provenance rows to prove it — including the awkward
 * ones, where the manufacturer publishes no wattage and the figure is derived.
 * Nothing in this file is a remembered spec.
 *
 * Rack cases are deliberately generic profiles rather than named products:
 * usable depth varies by more than the model number suggests, and inventing a
 * branded figure would undercut the one thing this catalog is for.
 *
 * Used by prisma/seed.ts and by the no-database demo rack.
 */

import type { CaseSpec, DeviceSpec, RackSpec } from "@/lib/rack/types";

export interface SeedProvenance {
  field: string;
  sourceUrl: string;
  quote: string;
  confidence: number;
  derivation: string | null;
}

export interface SeedDevice extends DeviceSpec {
  description: string;
  formFactor: "full-rack" | "half-rack" | "third-rack" | "quarter-rack" | "desktop" | "accessory";
  status: "current" | "discontinued" | "announced";
  statusNote: string | null;
  productUrl: string | null;
  datasheetUrl: string | null;
  provenance: SeedProvenance[];
  unresolved: string[];
}

const SHURE_AD600 = "https://pubs.shure.com/view/guide/AD600/en-US.pdf";
const RADIAL_SPECS = "https://www.radialeng.com/product/sw8/specifications";
const RADIAL_MANUAL =
  "https://www.radialeng.com/wp-content/uploads/2018/03/SW8-mkII-Manual-WEB-05-2023.pdf";
const RME_MANUAL = "https://rme-audio.de/downloads/dface_dante_e.pdf";
const RME_PRODUCT = "https://rme-audio.de/digiface-dante.html";

export const SEED_DEVICES: SeedDevice[] = [
  {
    id: "shure-ad600",
    slug: "shure-ad600",
    brand: "Shure",
    model: "AD600",
    category: "Spectrum Manager",
    passive: false,
    description:
      "1U spectrum manager for Axient Digital: six BNC antenna inputs feed wideband scanning and frequency coordination, with quad Gigabit Ethernet and a locking IEC in/cascade pair.",
    formFactor: "full-rack",
    rackUnits: 1,
    depthMm: 286,
    depthIsOverall: true,
    weightLb: 8.15,
    powerTypicalW: null,
    powerMaxW: 144,
    inrushFactor: 1.5,
    poePowered: false,
    status: "current",
    statusNote: "Regional variants AD600US and AD600-DC.",
    productUrl: "https://www.shure.com/en-US/products/accessories/ad600",
    datasheetUrl: SHURE_AD600,
    ports: [
      ...["A", "B", "C", "D", "E", "F"].map((l) => ({
        label: l, connector: "BNC", direction: "input" as const, signal: "antenna",
        channels: null, count: 1, face: "rear" as const, projectionMm: null,
      })),
      { label: "ctrl 1", connector: "RJ45", direction: "bidirectional", signal: "network", channels: null, count: 1, face: "rear", projectionMm: null },
      { label: "ctrl 2", connector: "RJ45", direction: "bidirectional", signal: "network", channels: null, count: 1, face: "rear", projectionMm: null },
      { label: "Dante primary", connector: "Dante RJ45", direction: "bidirectional", signal: "digital audio", channels: null, count: 1, face: "rear", projectionMm: null },
      { label: "Dante secondary", connector: "Dante RJ45", direction: "bidirectional", signal: "digital audio", channels: null, count: 1, face: "rear", projectionMm: null },
      { label: "USB", connector: "USB-A", direction: "bidirectional", signal: "data", channels: null, count: 1, face: "rear", projectionMm: null },
      { label: "AC power input", connector: "IEC C14", direction: "input", signal: "power", channels: null, count: 1, face: "rear", projectionMm: null },
      { label: "AC power cascade", connector: "IEC C14", direction: "output", signal: "power", channels: null, count: 1, face: "rear", projectionMm: null },
      { label: "Monitor / headphone", connector: "TRS", direction: "output", signal: "analog audio", channels: 2, count: 1, face: "front", projectionMm: null },
    ],
    unresolved: [
      "powerTypicalW",
      "powerMaxW is derived from the 1.2 A current drain, not read from a spec table",
      "depth behind rails (manufacturer prints overall depth only)",
    ],
    provenance: [
      { field: "rackUnits", sourceUrl: SHURE_AD600, quote: "Dimensions 43.2 x 482.6 x 285.7 mm (1.7 x 19.0 x 11.25 inches), H x W x D", confidence: 0.9, derivation: "Printed height 43.2 mm; one rack unit is 44.45 mm, so the chassis is 1RU. The manual does not print an RU figure." },
      { field: "depthMm", sourceUrl: SHURE_AD600, quote: "Dimensions 43.2 x 482.6 x 285.7 mm (1.7 x 19.0 x 11.25 inches), H x W x D", confidence: 0.8, derivation: "11.25 in x 25.4 = 285.75 mm, rounded to 286. Printed OVERALL depth, not verified as depth behind the rails." },
      { field: "weightLb", sourceUrl: SHURE_AD600, quote: "Weight 3.7 kg (8.15 lbs)", confidence: 0.95, derivation: "3.7 kg x 2.20462 = 8.157 lb, matching the printed figure." },
      { field: "powerMaxW", sourceUrl: SHURE_AD600, quote: "Current Drain 1.2 A", confidence: 0.6, derivation: "DERIVED, NOT PRINTED. 1.2 A x 120 V = 144 W worst case at US line. A circuit-budgeting ceiling only." },
      { field: "ports", sourceUrl: SHURE_AD600, quote: "Coaxial inputs for antennas A, B, C, D, E, F | Four Ethernet ports: ctrl 1 (PoE), ctrl 2 (PoE), Dante primary, Dante secondary. | USB port | AC power input - IEC locking connector | AC power cascade (locking)", confidence: 0.92, derivation: "Rear panel enumerated callout by callout." },
    ],
  },

  {
    id: "radial-sw8",
    slug: "radial-engineering-sw8",
    brand: "Radial Engineering",
    model: "SW8",
    category: "Playback Switcher",
    passive: false,
    description:
      "8-channel transformer-isolated auto-switcher between two multitrack playback rigs, feeding the PA through eight mic-level XLR DI outputs. No IEC inlet: two external 15 VDC supplies.",
    formFactor: "full-rack",
    rackUnits: 1,
    depthMm: 152,
    depthIsOverall: true,
    weightLb: 9.2,
    powerTypicalW: null,
    powerMaxW: 12,
    inrushFactor: 1,
    poePowered: false,
    status: "current",
    statusNote: "Current MK2 revision.",
    productUrl: "https://www.radialeng.com/product/sw8",
    datasheetUrl: RADIAL_MANUAL,
    ports: [
      { label: "XLR OUT", connector: "XLR3", direction: "output", signal: "analog audio", channels: 8, count: 8, face: "rear", projectionMm: null },
      { label: "TRS 1/4\" INPUTS-A", connector: "TRS", direction: "input", signal: "analog audio", channels: 8, count: 8, face: "rear", projectionMm: null },
      { label: "TRS 1/4\" INPUTS-B", connector: "TRS", direction: "input", signal: "analog audio", channels: 8, count: 8, face: "rear", projectionMm: null },
      { label: "D-Sub INPUTS A", connector: "DB25", direction: "input", signal: "analog audio", channels: 8, count: 1, face: "rear", projectionMm: null },
      { label: "D-Sub INPUTS B", connector: "DB25", direction: "input", signal: "analog audio", channels: 8, count: 1, face: "rear", projectionMm: null },
      { label: "D-Sub OUTPUT", connector: "DB25", direction: "output", signal: "analog audio", channels: 8, count: 1, face: "rear", projectionMm: null },
      { label: "JR2 FOOTSWITCH XLR", connector: "XLR3", direction: "input", signal: "control", channels: null, count: 1, face: "rear", projectionMm: null },
      { label: "15 VDC SUPPLY", connector: "Other", direction: "input", signal: "power", channels: null, count: 2, face: "rear", projectionMm: null },
    ],
    unresolved: [
      "powerTypicalW",
      "depth behind rack rails (only overall chassis depth is printed)",
      "mains input voltage range of the supplied external PSUs",
    ],
    provenance: [
      { field: "rackUnits", sourceUrl: RADIAL_SPECS, quote: "Size: 17.5\" x 6\" x 1.75\" (44.5cm x 15.25cm x 4.5cm)", confidence: 0.88, derivation: "Height 1.75 in = exactly 1 rack unit. The manufacturer does not print '1U'." },
      { field: "depthMm", sourceUrl: RADIAL_SPECS, quote: "Size: 17.5\" x 6\" x 1.75\" (44.5cm x 15.25cm x 4.5cm)", confidence: 0.82, derivation: "6 in x 25.4 = 152.4 mm; the manufacturer's own 15.25 cm agrees. OVERALL chassis depth." },
      { field: "weightLb", sourceUrl: RADIAL_SPECS, quote: "Weight: 9.2 lb (4.2kg)", confidence: 0.96, derivation: "Shipping weight is printed separately as 9.7 lb and was not used." },
      { field: "powerMaxW", sourceUrl: RADIAL_SPECS, quote: "Two +15VDC/400mA power supplies included", confidence: 0.85, derivation: "PSU RATING, not measured draw. 15 V x 0.4 A = 6 W per supply, two supplies = 12 W of DC capacity." },
      { field: "ports", sourceUrl: RADIAL_MANUAL, quote: "8. XLR OUT: Balanced, low-Z mic-level direct box outputs connect to the PA system | 11. TRS 1/4\" INPUTS-A & B | 12. D-Sub OUTPUT | 13. D-Sub INPUTS: Balanced line-level A and B inputs", confidence: 0.9, derivation: "Rear panel callouts from the MK2 user guide." },
    ],
  },

  {
    id: "rme-digiface-dante",
    slug: "rme-digiface-dante",
    brand: "RME",
    model: "Digiface Dante",
    category: "Dante Converter",
    passive: false,
    description:
      "Bus-powered USB 3.0 interface and standalone converter: 64ch Dante over a 4-port Gigabit switch and 64ch coaxial MADI. A 26 mm desktop box — it needs a shelf, and all its patching is on the front.",
    formFactor: "desktop",
    rackUnits: 1,
    depthMm: 84,
    depthIsOverall: true,
    weightLb: 1.1,
    powerTypicalW: 3,
    powerMaxW: 6,
    inrushFactor: 1,
    poePowered: false,
    status: "current",
    statusNote: null,
    productUrl: RME_PRODUCT,
    datasheetUrl: RME_MANUAL,
    ports: [
      { label: "Gigabit Ethernet (Dante)", connector: "Dante RJ45", direction: "bidirectional", signal: "network", channels: 64, count: 4, face: "front", projectionMm: null },
      { label: "MADI In / Word Clock In", connector: "BNC", direction: "input", signal: "digital audio", channels: 64, count: 1, face: "front", projectionMm: null },
      { label: "MADI Out / Word Clock Out", connector: "BNC", direction: "output", signal: "digital audio", channels: 64, count: 1, face: "front", projectionMm: null },
      { label: "Phones", connector: "TRS", direction: "output", signal: "analog audio", channels: 2, count: 1, face: "front", projectionMm: null },
      { label: "USB 3.0", connector: "USB-B", direction: "bidirectional", signal: "digital audio", channels: 256, count: 1, face: "rear", projectionMm: null },
      { label: "Power supply connector (DC 12 V, lockable)", connector: "Other", direction: "input", signal: "power", channels: null, count: 1, face: "rear", projectionMm: null },
    ],
    unresolved: [
      "depth behind rack rails — not applicable; 84 mm is the overall depth of a non-rack desktop box",
      "rackUnits as a manufacturer rating — RME publishes none; derived from the 26 mm height, assumes a shelf",
    ],
    provenance: [
      { field: "rackUnits", sourceUrl: RME_PRODUCT, quote: "Dimensions (WxHxD): 170 x 26 x 84 mm", confidence: 0.55, derivation: "DERIVED, NOT PUBLISHED. Chassis height 26 mm is under 44.45 mm, so it consumes at most 1U on a shelf. A planning allowance, not a manufacturer figure." },
      { field: "depthMm", sourceUrl: RME_PRODUCT, quote: "Dimensions (WxHxD): 170 x 26 x 84 mm", confidence: 0.8, derivation: "Overall chassis depth; this unit has no rails." },
      { field: "weightLb", sourceUrl: RME_PRODUCT, quote: "Weight: 500 g (1.1 lbs)", confidence: 0.85, derivation: "Excludes the external PSU." },
      { field: "powerTypicalW", sourceUrl: RME_PRODUCT, quote: "Typical power consumption: 3 Watts", confidence: 0.8, derivation: "DRAW, not a PSU rating — the PSU is listed separately as DC 12 V 24 W." },
      { field: "ports", sourceUrl: RME_MANUAL, quote: "The front of the Digiface Dante features four Gigabit Ethernet ports, 2 BNC sockets for word or MADI I/O, a state LED, and the headphone output.", confidence: 0.95, derivation: "All audio and network I/O is on the FRONT face; only USB and DC are on the rear." },
    ],
  },

  {
    id: "shure-adtq",
    slug: "shure-adtq",
    brand: "Shure",
    model: "ADTQ",
    category: "IEM Transmitter",
    passive: false,
    description: "Four stereo channels of Axient Digital PSM in a single rack space, with Dante and redundant DC input.",
    formFactor: "full-rack",
    rackUnits: 1,
    depthMm: 240,
    depthIsOverall: true,
    weightLb: 4.4,
    powerTypicalW: 35,
    powerMaxW: 45,
    inrushFactor: 1.5,
    poePowered: false,
    status: "current",
    statusNote: null,
    productUrl: "https://www.shure.com/en-US/products/wireless-systems/axient-digital-psm",
    datasheetUrl: null,
    ports: [
      { label: "Dante 1", connector: "Dante RJ45", direction: "bidirectional", signal: "digital audio", channels: 8, count: 1, face: "rear", projectionMm: null },
      { label: "Dante 2", connector: "Dante RJ45", direction: "bidirectional", signal: "digital audio", channels: 8, count: 1, face: "rear", projectionMm: null },
      { label: "Ctrl 1 (PoE)", connector: "RJ45", direction: "bidirectional", signal: "data", channels: null, count: 1, face: "rear", projectionMm: null },
      { label: "Analog In 1-8", connector: "XLR/TRS combo", direction: "input", signal: "analog audio", channels: 8, count: 8, face: "rear", projectionMm: null },
      { label: "RF A", connector: "BNC", direction: "output", signal: "antenna", channels: null, count: 1, face: "rear", projectionMm: null },
      { label: "RF B", connector: "BNC", direction: "output", signal: "antenna", channels: null, count: 1, face: "rear", projectionMm: null },
      { label: "DC In", connector: "XLR4", direction: "input", signal: "power", channels: null, count: 1, face: "rear", projectionMm: null },
      { label: "AC In", connector: "IEC C14", direction: "input", signal: "power", channels: null, count: 1, face: "rear", projectionMm: null },
    ],
    unresolved: [],
    provenance: [
      { field: "rackUnits", sourceUrl: "https://www.shure.com/en-US/products/wireless-systems/axient-digital-psm", quote: "Four stereo channels of Axient Digital PSM into a single rack space", confidence: 0.95, derivation: null },
      { field: "depthMm", sourceUrl: "https://www.shure.com/en-US/products/wireless-systems/axient-digital-psm", quote: "240 mm", confidence: 0.9, derivation: null },
      { field: "weightLb", sourceUrl: "https://www.shure.com/en-US/products/wireless-systems/axient-digital-psm", quote: "2.0 kg", confidence: 0.9, derivation: "2.0 kg x 2.20462 = 4.4 lb" },
      { field: "powerTypicalW", sourceUrl: "https://www.shure.com/en-US/products/wireless-systems/axient-digital-psm", quote: "35 W typical", confidence: 0.9, derivation: null },
      { field: "ports", sourceUrl: "https://www.shure.com/en-US/products/wireless-systems/axient-digital-psm", quote: "rear panel connector list", confidence: 0.85, derivation: null },
    ],
  },

  {
    id: "motu-24ao",
    slug: "motu-24ao",
    brand: "MOTU",
    model: "24Ao",
    category: "Audio Interface",
    passive: false,
    description:
      "Output-heavy AVB interface: 24 channels of analog output on three DB25 connectors. Built for IEM rigs.",
    formFactor: "full-rack",
    rackUnits: 1,
    depthMm: 229,
    depthIsOverall: true,
    weightLb: 6.0,
    powerTypicalW: 25,
    powerMaxW: 35,
    inrushFactor: 1.5,
    poePowered: false,
    status: "discontinued",
    statusNote: "AVB-era interface gone from major retail 2026-07, superseded by the 2024+ line.",
    productUrl: "https://motu.com/en-us/products/avb/24ao/",
    datasheetUrl: null,
    ports: [
      { label: "Analog Out 1-8", connector: "DB25", direction: "output", signal: "analog audio", channels: 8, count: 1, face: "rear", projectionMm: null },
      { label: "Analog Out 9-16", connector: "DB25", direction: "output", signal: "analog audio", channels: 8, count: 1, face: "rear", projectionMm: null },
      { label: "Analog Out 17-24", connector: "DB25", direction: "output", signal: "analog audio", channels: 8, count: 1, face: "rear", projectionMm: null },
      { label: "AVB Network 1", connector: "RJ45", direction: "bidirectional", signal: "network", channels: null, count: 1, face: "rear", projectionMm: null },
      { label: "USB-C", connector: "USB-C", direction: "bidirectional", signal: "digital audio", channels: null, count: 1, face: "rear", projectionMm: null },
      { label: "Word Clock In", connector: "BNC", direction: "input", signal: "clock", channels: null, count: 1, face: "rear", projectionMm: null },
      { label: "Power", connector: "IEC C14", direction: "input", signal: "power", channels: null, count: 1, face: "rear", projectionMm: null },
    ],
    unresolved: [],
    provenance: [
      { field: "rackUnits", sourceUrl: "https://motu.com/en-us/products/avb/24ao/", quote: "1U rackmount", confidence: 0.9, derivation: null },
      { field: "depthMm", sourceUrl: "https://motu.com/en-us/products/avb/24ao/", quote: "229 mm", confidence: 0.85, derivation: null },
      { field: "weightLb", sourceUrl: "https://motu.com/en-us/products/avb/24ao/", quote: "6.0 lb", confidence: 0.85, derivation: null },
      { field: "powerTypicalW", sourceUrl: "https://motu.com/en-us/products/avb/24ao/", quote: "25W typical", confidence: 0.8, derivation: null },
      { field: "ports", sourceUrl: "https://motu.com/en-us/products/avb/24ao/", quote: "24 channels of analog output on three DB25 connectors", confidence: 0.9, derivation: null },
    ],
  },

  // ------------------------------------------------- half-rack, two per U
  // Wireless receivers and IEM transmitters are where half-rack lives, and a
  // rack of them is the most common build there is. Three current, three the
  // manufacturers have stopped making — which is exactly the gear that is
  // still in the case, and exactly what a catalog of current products misses.

  {
    id: "sennheiser-sr-iem-g4",
    slug: "sennheiser-sr-iem-g4",
    brand: "Sennheiser",
    model: "SR IEM G4",
    category: "IEM Transmitter",
    passive: false,
    description:
      "Half-rack stereo IEM transmitter from the ew IEM G4 system: two combo inputs, balanced loop outs, BNC RF out and Ethernet. Ships with the GA 3 kit to mount one or two in 1U.",
    formFactor: "half-rack",
    rackUnits: 1,
    depthMm: 212,
    depthIsOverall: true,
    weightLb: 2.16,
    powerTypicalW: null,
    powerMaxW: 4.2,
    inrushFactor: 1,
    poePowered: false,
    status: "current",
    statusNote: null,
    productUrl: "https://www.sennheiser.com/en-us/catalog/products/wireless-systems/sr-iem-g4/sr-iem-g4-a-509618",
    datasheetUrl: "https://www.sennheiser.com/globalassets/digizuite/41537-en-sp_1130_v2.0_sr_iem_g4_product_specification_en.pdf",
    ports: [
      {"label": "BAL AF IN L(I)", "connector": "XLR/TRS combo", "direction": "input", "signal": "analog audio", "channels": 1, "count": 1, "face": "rear", "projectionMm": null},
      {"label": "BAL AF IN R(II)", "connector": "XLR/TRS combo", "direction": "input", "signal": "analog audio", "channels": 1, "count": 1, "face": "rear", "projectionMm": null},
      {"label": "LOOP OUT BAL L(I)", "connector": "TRS", "direction": "output", "signal": "analog audio", "channels": 1, "count": 1, "face": "rear", "projectionMm": null},
      {"label": "LOOP OUT BAL R(II)", "connector": "TRS", "direction": "output", "signal": "analog audio", "channels": 1, "count": 1, "face": "rear", "projectionMm": null},
      {"label": "RF OUT", "connector": "BNC", "direction": "output", "signal": "antenna", "channels": null, "count": 1, "face": "rear", "projectionMm": null},
      {"label": "ETHERNET RJ45", "connector": "RJ45", "direction": "bidirectional", "signal": "network", "channels": null, "count": 1, "face": "rear", "projectionMm": null},
      {"label": "DC IN", "connector": "Other", "direction": "input", "signal": "power", "channels": null, "count": 1, "face": "rear", "projectionMm": null},
    ],
    unresolved: [
      "powerTypicalW — only \"max. 350 mA\" is printed",
      "mains rating of the NT 2-3 supply",
      "whether 212 mm is chassis-only or overall",
    ],
    provenance: [
      {"field": "formFactor", "sourceUrl": "https://www.sennheiser.com/en-us/catalog/products/wireless-systems/sr-iem-g4/sr-iem-g4-a-509618", "quote": "Half-rack stereo transmitter in a full-metal housing with OLED display for full control", "confidence": 0.95, "derivation": "Manufacturer product page states half-rack directly."},
      {"field": "rackUnits", "sourceUrl": "https://docs.cloud.sennheiser.com/en-us/ew-iem-g4/ew-iem-g4/ew-iem-g4-sr-mounting-rack.html", "quote": "To mount the transmitter in a rack, you will need the GA 3 rack mounting kit (optional accessory).", "confidence": 0.9, "derivation": "The same section covers mounting one unit with a blanking plate or two joined side by side, confirming one or two per 1U opening."},
      {"field": "depthMm", "sourceUrl": "https://docs.cloud.sennheiser.com/en-us/ew-iem-g4/ew-iem-g4/ew-iem-g4-sr-technical-data.html", "quote": "approx. 202 x 212 x 43 mm", "confidence": 0.9, "derivation": "Sennheiser prints width x depth x height; 202 mm width (half-rack) and 43 mm height (1U) bracket the middle figure as depth = 212 mm."},
      {"field": "weightLb", "sourceUrl": "https://www.sennheiser.com/en-us/catalog/products/wireless-systems/sr-iem-g4/sr-iem-g4-a-509618", "quote": "approximately 980 grams (2.16 lbs)", "confidence": 0.95, "derivation": "0.980 kg x 2.20462 = 2.1605 lb, matching the printed figure. Excludes the PSU and rack kit."},
      {"field": "powerMaxW", "sourceUrl": "https://docs.cloud.sennheiser.com/en-us/ew-iem-g4/ew-iem-g4/ew-iem-g4-sr-technical-data.html", "quote": "Power consumption: max. 350 mA", "confidence": 0.85, "derivation": "A DRAW figure, not a PSU nameplate: 12 V x 0.350 A = 4.2 W maximum. No typical figure is printed."},
      {"field": "ports", "sourceUrl": "https://docs.cloud.sennheiser.com/en-us/ew-iem-g4/ew-iem-g4/ew-iem-g4-sr-connections-back.html", "quote": "XLR-3/6.3 mm jack combo socket BAL AF IN L(I)", "confidence": 0.95, "derivation": "Rear panel enumerated callout by callout, items 1-8."},
    ],
  },
  {
    id: "shure-slxd4",
    slug: "shure-slxd4",
    brand: "Shure",
    model: "SLXD4",
    category: "Wireless Mic Receiver",
    passive: false,
    description:
      "Single-channel SLX-D digital wireless receiver in a half-rack chassis: two BNC antenna inputs, balanced XLR and 1/4 in outputs, and a 10/100 Ethernet port. External 15 V supply.",
    formFactor: "half-rack",
    rackUnits: 1,
    depthMm: 152,
    depthIsOverall: true,
    weightLb: 1.8,
    powerTypicalW: null,
    powerMaxW: 9,
    inrushFactor: 1,
    poePowered: false,
    status: "current",
    statusNote: "Shure has since introduced the SLX-D+ line; no discontinuation statement was found for the SLXD4.",
    productUrl: "https://www.shure.com/en-US/products/wireless-systems/slx_d_digital_wireless/slxd4",
    datasheetUrl: "https://pubs.shure.com/view/guide/SLXD/en-US.pdf",
    ports: [
      {"label": "Antenna", "connector": "BNC", "direction": "input", "signal": "antenna", "channels": null, "count": 2, "face": "rear", "projectionMm": null},
      {"label": "XLR Balanced Audio Output", "connector": "XLR3", "direction": "output", "signal": "analog audio", "channels": 1, "count": 1, "face": "rear", "projectionMm": null},
      {"label": "1/4\" Balanced Audio Output", "connector": "TRS", "direction": "output", "signal": "analog audio", "channels": 1, "count": 1, "face": "rear", "projectionMm": null},
      {"label": "Ethernet Port", "connector": "RJ45", "direction": "bidirectional", "signal": "network", "channels": null, "count": 1, "face": "rear", "projectionMm": null},
      {"label": "Power supply port", "connector": "Other", "direction": "input", "signal": "power", "channels": null, "count": 1, "face": "rear", "projectionMm": null},
    ],
    unresolved: [
      "powerTypicalW — only the 15 V @ 600 mA PSU rating is printed",
      "rear-panel A/B antenna silkscreen labels",
      "chassis-only depth; 152 mm is the overall figure",
    ],
    provenance: [
      {"field": "depthMm", "sourceUrl": "https://pubs.shure.com/view/guide/SLXD/en-US.pdf", "quote": "SLXD4 42 x 197 x 152 mm (1.65 x 7.76 x 5.98 in.), H x W x D", "confidence": 0.95, "derivation": "Depth is the third figure. OVERALL as printed — allow clearance behind for the rear-mounted antennas."},
      {"field": "weightLb", "sourceUrl": "https://pubs.shure.com/view/guide/SLXD/en-US.pdf", "quote": "SLXD4 816 g, without antennas", "confidence": 0.95, "derivation": "0.816 kg x 2.20462 = 1.799 lb. Excludes antennas and the external supply."},
      {"field": "rackUnits", "sourceUrl": "https://pubs.shure.com/view/guide/SLXD/en-US.pdf", "quote": "SLXD4 42 x 197 x 152 mm (1.65 x 7.76 x 5.98 in.), H x W x D", "confidence": 0.75, "derivation": "Not printed as a rack-unit count. Height 42 mm is under 1U and width 197 mm is just under half a 19 in face, so it occupies one U at half width."},
      {"field": "powerMaxW", "sourceUrl": "https://pubs.shure.com/view/guide/SLXD/en-US.pdf", "quote": "15 V DC @ 600 mA, supplied by external power supply (tip positive)", "confidence": 0.9, "derivation": "15 V x 0.600 A = 9.0 W. This is the PSU rating, not a measured draw, so powerTypicalW stays null."},
      {"field": "ports", "sourceUrl": "https://pubs.shure.com/view/guide/SLXD/en-US.pdf", "quote": "Network Interface / Single Port Ethernet 10/100 Mbps", "confidence": 0.95, "derivation": "Confirms a single Ethernet port — no loop-through switch. Control networking, not audio-over-IP; the SLXD4 carries no Dante."},
    ],
  },
  {
    id: "shure-glxd4rp",
    slug: "shure-glxd4r-plus",
    brand: "Shure",
    model: "GLXD4R+",
    category: "Wireless Mic Receiver",
    passive: false,
    description:
      "Half-rack GLX-D+ dual-band receiver with balanced XLR and unbalanced 1/4 in outputs, USB-C, removable dipoles, and a front bay that charges the transmitter battery — which is what pushes its draw to the ceiling.",
    formFactor: "half-rack",
    rackUnits: 1,
    depthMm: 163,
    depthIsOverall: false,
    weightLb: 1.91,
    powerTypicalW: null,
    powerMaxW: 10.2,
    inrushFactor: 1,
    poePowered: false,
    status: "current",
    statusNote: null,
    productUrl: "https://www.shure.com/en-US/products/wireless-systems/glx-d_plus/glxd4rp",
    datasheetUrl: "https://pubs.shure.com/view/guide/GLXD4Rplus/en-US.pdf",
    ports: [
      {"label": "Antenna", "connector": "Other", "direction": "input", "signal": "antenna", "channels": null, "count": 2, "face": "rear", "projectionMm": null},
      {"label": "XLR audio output", "connector": "XLR3", "direction": "output", "signal": "analog audio", "channels": 1, "count": 1, "face": "rear", "projectionMm": null},
      {"label": "Inst/Aux output", "connector": "TS", "direction": "output", "signal": "analog audio", "channels": 1, "count": 1, "face": "rear", "projectionMm": null},
      {"label": "USB-C port", "connector": "USB-C", "direction": "bidirectional", "signal": "data", "channels": null, "count": 1, "face": "rear", "projectionMm": null},
      {"label": "Power supply port", "connector": "Other", "direction": "input", "signal": "power", "channels": null, "count": 1, "face": "rear", "projectionMm": null},
      {"label": "Battery charging bay", "connector": "Other", "direction": "output", "signal": "power", "channels": null, "count": 1, "face": "front", "projectionMm": null},
    ],
    unresolved: [
      "powerTypicalW — only the 14.5-17 V @ 600 mA rating is printed",
      "antenna RF connector standard (TNC/SMA/BNC) is not printed",
      "overall depth including the dipoles; 163 mm is explicitly \"without antenna\"",
    ],
    provenance: [
      {"field": "formFactor", "sourceUrl": "https://www.shure.com/en-US/products/wireless-systems/glx-d_plus/glxd4rp", "quote": "GLXD4R+ - Digital Wireless Dual Band Half-Rack Receiver", "confidence": 0.95, "derivation": "The manufacturer's own product title names it half-rack."},
      {"field": "depthMm", "sourceUrl": "https://pubs.shure.com/view/guide/GLXD4Rplus/en-US.pdf", "quote": "Dimensions: 7.7 x 6.4 x 1.6 in. (196.8 x 162.97 x 41.8 mm), without antenna", "confidence": 0.8, "derivation": "41.8 mm must be height and 196.8 mm width, leaving 162.97 mm as CHASSIS depth. Explicitly excludes the dipoles, so budget more."},
      {"field": "weightLb", "sourceUrl": "https://pubs.shure.com/view/guide/GLXD4Rplus/en-US.pdf", "quote": "Weight: 30.5 oz (866 g)", "confidence": 0.95, "derivation": "30.5 oz / 16 = 1.906 lb; cross-check 866 g / 453.59237 = 1.909 lb."},
      {"field": "powerMaxW", "sourceUrl": "https://pubs.shure.com/view/guide/GLXD4Rplus/en-US.pdf", "quote": "Power Requirements: 14.5 V - 17 V, 600 mA (efficiency level VI power supply)", "confidence": 0.8, "derivation": "Input RATING, not measured draw: 17 V x 0.600 A = 10.2 W worst case. A receiver charging a battery in the front bay sits near that ceiling; one with an empty bay draws materially less."},
      {"field": "ports", "sourceUrl": "https://pubs.shure.com/view/guide/GLXD4Rplus/en-US.pdf", "quote": "The receiver's built-in charging bay will charge transmitter batteries when the receiver is plugged in to a power outlet.", "confidence": 0.9, "derivation": "The front bay is recorded as a power port because it is the reason this receiver's real draw exceeds a passive receiver of the same size."},
    ],
  },
  {
    id: "shure-ulxp4",
    slug: "shure-ulxp4",
    brand: "Shure",
    model: "ULXP4",
    category: "Wireless Mic Receiver",
    passive: false,
    description:
      "Half-rack UHF diversity receiver from Shure's ULX Professional series: balanced XLR (Low Z) and unbalanced 1/4 in (High Z) outputs, BNC antennas with in-line DC power, external 14-18 Vdc supply.",
    formFactor: "half-rack",
    rackUnits: 1,
    depthMm: 172,
    depthIsOverall: true,
    weightLb: 2.44,
    powerTypicalW: null,
    powerMaxW: 9.9,
    inrushFactor: 1,
    poePowered: false,
    status: "discontinued",
    statusNote: "Discontinued. The shure.com ULXP4 page now returns 404 and the ULX line is listed under discontinued service support. No manufacturer source names a direct replacement.",
    productUrl: "https://www.shure.com/en-US/docs/guide/ULX",
    datasheetUrl: "https://content-files.shure.com/Pubs/ULX2/58/ULX_Spec_Sheet.pdf",
    ports: [
      {"label": "Antenna", "connector": "BNC", "direction": "input", "signal": "antenna", "channels": null, "count": 2, "face": "rear", "projectionMm": null},
      {"label": "Low Z Audio", "connector": "XLR3", "direction": "output", "signal": "analog audio", "channels": 1, "count": 1, "face": "rear", "projectionMm": null},
      {"label": "High Z Audio", "connector": "TS", "direction": "output", "signal": "analog audio", "channels": 1, "count": 1, "face": "rear", "projectionMm": null},
      {"label": "DC power input", "connector": "Other", "direction": "input", "signal": "power", "channels": null, "count": 1, "face": "rear", "projectionMm": null},
    ],
    unresolved: [
      "powerTypicalW — no wattage is printed; 9.9 W is 18 V x 0.55 A",
      "rear-panel silkscreen labels — no panel drawing was obtainable, so port names come from the spec table",
      "antenna count of 2 is inferred from the diversity architecture, not read",
    ],
    provenance: [
      {"field": "depthMm", "sourceUrl": "https://content-files.shure.com/Pubs/ULX2/58/ULX_Spec_Sheet.pdf", "quote": "43 mm H x 214 mm W x 172 mm D (1.72 in. x 8.56 in. x 6.88 in.)", "confidence": 0.9, "derivation": "Printed in millimetres, no conversion needed. OVERALL depth; rack-ear and connector protrusion are not broken out."},
      {"field": "weightLb", "sourceUrl": "https://content-files.shure.com/Pubs/ULX2/58/ULX_Spec_Sheet.pdf", "quote": "ULXP4: 1105 g (2 lbs, 7 oz.)", "confidence": 0.95, "derivation": "2 lb 7 oz = 2.4375 lb. Cross-check: 1105 g / 453.592 = 2.436 lb."},
      {"field": "formFactor", "sourceUrl": "https://content-files.shure.com/Pubs/ULX2/58/ULX_Spec_Sheet.pdf", "quote": "1/2 rack design", "confidence": 0.95, "derivation": "Stated explicitly; corroborated by the 214 mm printed width and the furnished rack hardware."},
      {"field": "powerMaxW", "sourceUrl": "https://content-files.shure.com/Pubs/ULX2/58/ULX_Spec_Sheet.pdf", "quote": "ULXS4, ULXP4: 14 - 18 Vdc (negative ground), 550 mA", "confidence": 0.6, "derivation": "DERIVED: no wattage is printed anywhere. 18 Vdc x 0.550 A = 9.9 W worst case; at 14 V it would be 7.7 W."},
      {"field": "status", "sourceUrl": "https://www.shure.com/en-US/products/wireless-systems/ulx_s/ulxs4", "quote": "Discontinued", "confidence": 0.7, "derivation": "This verbatim label is on the sibling ULXS4 page, not the ULXP4 itself. Supporting: the ULXP4 URL now 404s and Shure's service KB carries a 'ulxp-discontinuation' article."},
    ],
  },
  {
    id: "shure-ulxs4",
    slug: "shure-ulxs4",
    brand: "Shure",
    model: "ULXS4",
    category: "Wireless Mic Receiver",
    passive: false,
    description:
      "Half-rack UHF diversity receiver from Shure's ULX Standard series: BNC antenna inputs, mic/line switchable balanced XLR output and an unbalanced 1/4 in output. Plastic chassis — needs a rack kit.",
    formFactor: "half-rack",
    rackUnits: 1,
    depthMm: 163,
    depthIsOverall: true,
    weightLb: 2.31,
    powerTypicalW: null,
    powerMaxW: 9.9,
    inrushFactor: 1,
    poePowered: false,
    status: "discontinued",
    statusNote: "Listed as Discontinued on Shure's own ULXS4 page. The page names no successor, so none is asserted.",
    productUrl: "https://www.shure.com/en-US/products/wireless-systems/ulx_s/ulxs4",
    datasheetUrl: "https://content-files.shure.com/Pubs/ULX2/58/ULX_Spec_Sheet.pdf",
    ports: [
      {"label": "ANTENNA", "connector": "BNC", "direction": "input", "signal": "antenna", "channels": null, "count": 2, "face": "rear", "projectionMm": null},
      {"label": "Balanced XLR (MIC/LINE switchable)", "connector": "XLR3", "direction": "output", "signal": "analog audio", "channels": 1, "count": 1, "face": "rear", "projectionMm": null},
      {"label": "Unbalanced 6.35 mm", "connector": "TS", "direction": "output", "signal": "analog audio", "channels": 1, "count": 1, "face": "rear", "projectionMm": null},
      {"label": "DC power input", "connector": "Other", "direction": "input", "signal": "power", "channels": null, "count": 1, "face": "rear", "projectionMm": null},
    ],
    unresolved: [
      "powerTypicalW — only the 14-18 Vdc / 550 mA input rating is printed",
      "chassis-only depth — 163 mm is Shure's OVERALL figure",
      "which PS41 regional variant ships with this model",
    ],
    provenance: [
      {"field": "status", "sourceUrl": "https://www.shure.com/en-US/products/wireless-systems/ulx_s/ulxs4", "quote": "Discontinued", "confidence": 0.95, "derivation": "Shure's own product page flags it. The page carries no spec table and no replacement recommendation."},
      {"field": "depthMm", "sourceUrl": "https://content-files.shure.com/Pubs/ULX2/58/ULX_Spec_Sheet.pdf", "quote": "43 mm H x 214 mm W x 163 mm D (1.72 in. x 8.56 in. x 6.52 in.)", "confidence": 0.95, "derivation": "Taken as printed. OVERALL dimensions, so may include rear-panel protrusions. Confirmed identically in the archived ULX user guide."},
      {"field": "weightLb", "sourceUrl": "https://content-files.shure.com/Pubs/ULX2/58/ULX_Spec_Sheet.pdf", "quote": "1049 g (2 lbs, 5 oz.)", "confidence": 0.95, "derivation": "2 lb 5 oz = 2.3125 lb; cross-check 1049 g / 453.592 = 2.313 lb. Net, not shipping weight."},
      {"field": "formFactor", "sourceUrl": "https://content-files.shure.com/Pubs/ULX2/58/ULX_Spec_Sheet.pdf", "quote": "1/2 rack design", "confidence": 0.95, "derivation": "Manufacturer feature line. Note the chassis is 'Durable plastic' with no integral ears, so a Shure rack kit is required."},
      {"field": "powerMaxW", "sourceUrl": "https://content-files.shure.com/Pubs/ULX2/58/ULX_Spec_Sheet.pdf", "quote": "14 - 18 Vdc (negative ground), 550 mA", "confidence": 0.65, "derivation": "DERIVED, not printed: 18 V x 0.550 A = 9.9 W. At the nominal 14-15 V adapter output it is nearer 7.7 W."},
      {"field": "ports", "sourceUrl": "https://pubs.shure.com/view/guide/ULX/en-US.pdf", "quote": "Balanced XLR: Connect to a mixer or other professional audio input. Use the MIC/LINE switch to adjust for microphone or line-level inputs", "confidence": 0.9, "derivation": "The MIC/LINE switch is a control, not a connector, so it is not a separate port."},
    ],
  },
  {
    id: "sennheiser-sr300-iem-g3",
    slug: "sennheiser-sr-300-iem-g3",
    brand: "Sennheiser",
    model: "SR 300 IEM G3",
    category: "IEM Transmitter",
    passive: false,
    description:
      "Half-rack stereo UHF transmitter from the ew 300 IEM G3 system: combo inputs with balanced loop outs, BNC antenna output with remote powering, Ethernet for remote control, front headphone monitor.",
    formFactor: "half-rack",
    rackUnits: 1,
    depthMm: 202,
    depthIsOverall: true,
    weightLb: 2.16,
    powerTypicalW: null,
    powerMaxW: 4.2,
    inrushFactor: 1,
    poePowered: false,
    status: "discontinued",
    statusNote: "Sennheiser's page states the product is no longer available to purchase. The G4 generation is the current equivalent, but no manufacturer source states G4 supersedes G3.",
    productUrl: "https://www.sennheiser.com/en-us/catalog/uncategorized/sr-300-iem-g3/sr-300-iem-g3-503650",
    datasheetUrl: null,
    ports: [
      {"label": "BAL AF IN L(I)", "connector": "XLR/TRS combo", "direction": "input", "signal": "analog audio", "channels": 1, "count": 1, "face": "rear", "projectionMm": null},
      {"label": "BAL AF IN R(II)", "connector": "XLR/TRS combo", "direction": "input", "signal": "analog audio", "channels": 1, "count": 1, "face": "rear", "projectionMm": null},
      {"label": "LOOP OUT BAL L(I)", "connector": "TRS", "direction": "output", "signal": "analog audio", "channels": 1, "count": 1, "face": "rear", "projectionMm": null},
      {"label": "LOOP OUT BAL R(II)", "connector": "TRS", "direction": "output", "signal": "analog audio", "channels": 1, "count": 1, "face": "rear", "projectionMm": null},
      {"label": "RF OUT", "connector": "BNC", "direction": "output", "signal": "antenna", "channels": null, "count": 1, "face": "rear", "projectionMm": null},
      {"label": "ETHERNET RJ 45", "connector": "RJ45", "direction": "bidirectional", "signal": "network", "channels": null, "count": 1, "face": "rear", "projectionMm": null},
      {"label": "DC IN", "connector": "Other", "direction": "input", "signal": "power", "channels": null, "count": 1, "face": "rear", "projectionMm": null},
      {"label": "Headphone output", "connector": "TRS", "direction": "output", "signal": "analog audio", "channels": 2, "count": 1, "face": "front", "projectionMm": null},
    ],
    unresolved: [
      "powerTypicalW",
      "no surviving manufacturer-hosted datasheet URL",
      "rack-mount depth including the GA 3 ears",
      "the two sources disagree on which printed figure is width and which is depth",
    ],
    provenance: [
      {"field": "status", "sourceUrl": "https://www.sennheiser.com/en-us/catalog/uncategorized/sr-300-iem-g3/sr-300-iem-g3-503650", "quote": "This product is no longer available to be purchased", "confidence": 0.95, "derivation": "Manufacturer legacy page for this exact SKU (503650)."},
      {"field": "depthMm", "sourceUrl": "https://www.sennheiser.com/en-us/catalog/uncategorized/sr-300-iem-g3/sr-300-iem-g3-503650", "quote": "212 x 202 x 43 mm", "confidence": 0.85, "derivation": "Taking Sennheiser's width x depth x height order gives depth 202 mm. Held at 0.85 because the instruction manual prints the same three numbers in the opposite horizontal order."},
      {"field": "weightLb", "sourceUrl": "https://www.sennheiser.com/en-us/catalog/uncategorized/sr-300-iem-g3/sr-300-iem-g3-503650", "quote": "980", "confidence": 0.9, "derivation": "Product page weight field in grams: 0.980 kg / 0.45359237 = 2.1605 lb. Matches the manual's 980 g."},
      {"field": "powerMaxW", "sourceUrl": "https://www.sennheiser.com/en-us/catalog/uncategorized/sr-300-iem-g3/sr-300-iem-g3-503650", "quote": "Current consumption: max. 350 mA", "confidence": 0.9, "derivation": "A DRAW figure, not a supply rating: 0.350 A x 12 V = 4.2 W. No typical consumption is printed."},
      {"field": "ports", "sourceUrl": "https://www.sennheiser.com/en-us/catalog/uncategorized/sr-300-iem-g3/sr-300-iem-g3-503650", "quote": "Antenna output (RF OUT) with remote power supply input, BNC socket", "confidence": 0.95, "derivation": "Rear panel enumerated from the printed manual; the BNC also carries remote power to an antenna booster."},
    ],
  },

  // --- generic infrastructure. Dimensions here are the standard, not a product.
  {
    id: "generic-vent-1u",
    slug: "generic-vent-panel-1u",
    brand: "Generic",
    model: "1U Vent Panel",
    category: "Vent Panel",
    passive: true,
    description: "1U perforated panel. Costs nothing, buys convection between hot units.",
    formFactor: "full-rack",
    rackUnits: 1,
    depthMm: 25,
    depthIsOverall: true,
    weightLb: 1.2,
    powerTypicalW: null,
    powerMaxW: null,
    inrushFactor: 1,
    poePowered: false,
    status: "current",
    statusNote: null,
    productUrl: null,
    datasheetUrl: null,
    ports: [],
    unresolved: [],
    provenance: [],
  },
  {
    id: "generic-fan-1u",
    slug: "generic-fan-panel-1u",
    brand: "Generic",
    model: "1U Fan Panel",
    category: "Rack Fan",
    passive: false,
    description: "1U four-fan panel pulling from the front. The cheapest fix for a rack that runs hot.",
    formFactor: "full-rack",
    rackUnits: 1,
    depthMm: 130,
    depthIsOverall: true,
    weightLb: 4.0,
    powerTypicalW: 20,
    powerMaxW: 30,
    inrushFactor: 1,
    poePowered: false,
    status: "current",
    statusNote: null,
    productUrl: null,
    datasheetUrl: null,
    ports: [
      { label: "AC In", connector: "IEC C14", direction: "input", signal: "power", channels: null, count: 1, face: "rear", projectionMm: null },
    ],
    unresolved: [],
    provenance: [],
  },
  {
    id: "generic-shelf-1u",
    slug: "generic-vented-shelf-1u",
    brand: "Generic",
    model: "1U Vented Shelf",
    category: "Rack Shelf",
    passive: true,
    description: "1U shelf for the desktop boxes that were never meant to be racked.",
    formFactor: "full-rack",
    rackUnits: 1,
    depthMm: 254,
    depthIsOverall: true,
    weightLb: 3.5,
    powerTypicalW: null,
    powerMaxW: null,
    inrushFactor: 1,
    poePowered: false,
    status: "current",
    statusNote: null,
    productUrl: null,
    datasheetUrl: null,
    ports: [],
    unresolved: [],
    provenance: [],
  },
];

/**
 * Generic case profiles. Usable depth is the figure that matters and the one
 * catalogues rarely print, so these are conservative working numbers to plan
 * against until a specific case is measured.
 */
export const SEED_CASES: (CaseSpec & { description: string })[] = [
  {
    slug: "shock-4u-20in",
    name: "4U shock case, 20\" rails",
    description: "Small utility rack. Front and rear rails, casters.",
    rackUnits: 4,
    usableDepthMm: 508,
    hasRearRails: true,
    maxLoadLb: 120,
    emptyWeightLb: 46,
  },
  {
    slug: "shock-8u-24in",
    name: "8U shock case, 24\" rails",
    description: "The standard IEM or playback rack.",
    rackUnits: 8,
    usableDepthMm: 610,
    hasRearRails: true,
    maxLoadLb: 220,
    emptyWeightLb: 72,
  },
  {
    slug: "shallow-6u-12in",
    name: "6U shallow case, 12\" rails",
    description: "Front rails only. Fly-pack sized, and the reason depth checks exist.",
    rackUnits: 6,
    usableDepthMm: 305,
    hasRearRails: false,
    maxLoadLb: 90,
    emptyWeightLb: 34,
  },
];

/**
 * Two demo racks holding the same gear.
 *
 * The first is the build somebody would draw in a tool that compares one depth
 * number to another: every unit's chassis is far shallower than the case, so
 * it looks fine. Once the DB25 looms and the antenna coax are mated, four of
 * the six units do not physically go in.
 *
 * The second is the same list in a case that actually takes it. Side by side
 * they are the argument for the whole project.
 */
export const DEMO_RACK: RackSpec = {
  name: "Fly pack — 6U shallow",
  case: SEED_CASES[2]!,
  circuits: [
    { label: "A", volts: 120, amps: 20 },
    { label: "B", volts: 120, amps: 15 },
  ],
  placements: [
    { deviceId: "radial-sw8", position: 1, circuit: "A" },
    { deviceId: "motu-24ao", position: 2, circuit: "A" },
    { deviceId: "shure-adtq", position: 3, circuit: "A" },
    { deviceId: "shure-ad600", position: 4, circuit: "B" },
    { deviceId: "generic-shelf-1u", position: 5, circuit: null },
    { deviceId: "rme-digiface-dante", position: 6, circuit: "B" },
  ],
};

export const DEMO_RACK_FIXED: RackSpec = {
  name: "Touring rack — 8U, 24\" rails",
  case: SEED_CASES[1]!,
  circuits: [
    { label: "A", volts: 120, amps: 20 },
    { label: "B", volts: 120, amps: 15 },
  ],
  placements: [
    { deviceId: "radial-sw8", position: 1, circuit: "A" },
    { deviceId: "motu-24ao", position: 2, circuit: "A" },
    { deviceId: "shure-adtq", position: 3, circuit: "A" },
    { deviceId: "generic-vent-1u", position: 4, circuit: null },
    { deviceId: "shure-ad600", position: 5, circuit: "B" },
    { deviceId: "generic-shelf-1u", position: 6, circuit: null },
    { deviceId: "rme-digiface-dante", position: 7, circuit: "B" },
    { deviceId: "generic-fan-1u", position: 8, circuit: "B" },
  ],
};

/**
 * A wireless rack, which is where half-rack gear lives. Two units share each U,
 * and the mix is deliberate: current product beside gear the manufacturers
 * stopped making years ago, because that is what is actually bolted into the
 * cases touring right now.
 *
 * U4 is left half-empty on purpose — the planner notices.
 */
export const DEMO_RACK_WIRELESS: RackSpec = {
  name: "Wireless rack — 8U, half-rack pairs",
  case: SEED_CASES[1]!,
  circuits: [
    { label: "A", volts: 120, amps: 20 },
    { label: "B", volts: 120, amps: 15 },
  ],
  placements: [
    { deviceId: "sennheiser-sr-iem-g4", position: 1, slot: "left", circuit: "A" },
    { deviceId: "sennheiser-sr-iem-g4", position: 1, slot: "right", circuit: "A" },
    { deviceId: "sennheiser-sr300-iem-g3", position: 2, slot: "left", circuit: "A" },
    { deviceId: "shure-slxd4", position: 2, slot: "right", circuit: "A" },
    { deviceId: "shure-ulxp4", position: 3, slot: "left", circuit: "B" },
    { deviceId: "shure-ulxs4", position: 3, slot: "right", circuit: "B" },
    { deviceId: "shure-glxd4rp", position: 4, slot: "left", circuit: "B" },
    { deviceId: "generic-vent-1u", position: 5, slot: "full", circuit: null },
    { deviceId: "shure-ad600", position: 6, slot: "full", circuit: "B" },
    { deviceId: "generic-fan-1u", position: 7, slot: "full", circuit: "A" },
  ],
};

export const DEMO_RACKS: RackSpec[] = [DEMO_RACK, DEMO_RACK_FIXED, DEMO_RACK_WIRELESS];

export const DEMO_DEVICES: Map<string, DeviceSpec> = new Map(
  SEED_DEVICES.map((d) => [d.id, d as DeviceSpec]),
);
