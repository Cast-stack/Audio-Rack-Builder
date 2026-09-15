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

export const DEMO_RACKS: RackSpec[] = [DEMO_RACK, DEMO_RACK_FIXED];

export const DEMO_DEVICES: Map<string, DeviceSpec> = new Map(
  SEED_DEVICES.map((d) => [d.id, d as DeviceSpec]),
);
