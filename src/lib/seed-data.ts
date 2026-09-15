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
  /**
   * The document the quote was read from, when the URL alone does not identify
   * it. Manuals get withdrawn and PDFs move; a citation that names the
   * document stays checkable against a copy from anywhere, which a bare link
   * does not. Pointing a link at a page that does not contain the quoted text
   * would be worse than admitting the file is no longer hosted.
   */
  sourceTitle?: string | null;
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
/**
 * The ULX guide is no longer hosted by Shure \u2014 the only Shure-hosted ULX PDF
 * is a band supplement with no panel section. This is a scan of the genuine
 * guide, recorded as the source because pointing at a manufacturer URL that
 * does not resolve would be worse than naming where the text actually is.
 */
const SHURE_PSM300 = 'Shure, "PSM300 \u2014 Stereo Personal Monitor System", user guide, Version 2.5 (2024-H)';
const SHURE_SLX = 'Shure, "SLX Wireless System", user guide, 27A15631 Rev. 2 (2012)';
const SHURE_ULX_2024 = 'Shure, "ULX \u2014 Shure ULX Wireless", user guide, Version 3.1 (2024-C)';
const PSM300_GUIDE = "https://pubs.shure.com/view/guide/PSM300/en-US.pdf";
const SLX_GUIDE = "https://pubs.shure.com/view/guide/SLX/en-US.pdf";
/**
 * The current Shure-hosted ULX guide. It is the 2024 rewrite and carries no
 * panel callout lists at all, so it confirms the specifications but cannot
 * replace ULX_GUIDE as the source for the panel layouts.
 */
const ULX_2024 = "https://pubs.shure.com/view/guide/ULX/en-US.pdf";
const EW_IEM_G4_MANUAL =
  'Sennheiser, "ew IEM G4 \u2014 EK IEM G4, SR IEM G4", Instruction manual v3.3, 05/2026';

const G3_PRODUCT =
  "https://www.sennheiser.com/en-us/catalog/uncategorized/sr-300-iem-g3/sr-300-iem-g3-503650";
/**
 * Sennheiser has withdrawn the hosted PDF of this manual, so the link above is
 * the product page and the quotes are cited against the document by name. A
 * link that resolves to a page not containing the quoted text would read as a
 * source while proving nothing.
 */
const G3_MANUAL =
  'Sennheiser, "evolution wireless G3 \u2014 300 IEM Series", Instruction manual (operator-supplied copy)';

const ULX_GUIDE =
  "https://fccid.io/m/58c1a25dd8a54f719e8d34cc8cee1d57bb25a981c730424dbd2417e9c978d279.pdf";

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
    // Front and back panel callouts 1-7 (front) and 8-16 (back) of the AD600
    // guide. The manual runs one continuous list across both figures.
    panel: {
      front: {
        elements: [
          { kind: "knob", label: "PHONES", callouts: [1] },
          { kind: "jack", label: null, port: "Monitor / headphone", callouts: [2] },
          { kind: "display", label: null, size: "lg", callouts: [3], readouts: ["spectrum", "markers"] },
          { kind: "button", label: "F1-F4", count: 4, stack: "v", callouts: [4] },
          { kind: "button", label: "ENTER", callouts: [5] },
          { kind: "button", label: "EXIT", callouts: [6] },
          { kind: "knob", label: null, callouts: [7] },
          { kind: "vent", label: null, size: "sm", callouts: [16] },
        ],
      },
    },
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
      { field: "panel.front", sourceUrl: SHURE_AD600, quote: "Headphone volume knob - Controls headphone volume. | Monitor jack, headphone jack - 1/4 in (6.35 mm) audio output jack. | Display - Color display to view and analyze RF spectrum. | Function buttons - The buttons are named F1, F2, F3, F4 (from top to bottom) | ENTER button | EXIT button | Control wheel | Cooling vents - Vents on the front and rear for cooling.", confidence: 0.85, derivation: "Front and Back Panel list, callouts 1-7 plus 16. Left-to-right order taken from callout order; the manual prints no positions." },
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
    // Front panel callouts 1-10 of the SW8 MK2 manual. The eight XLR direct
    // box outputs are on the FRONT of this unit, which is unusual and is the
    // reason its real depth is far less than a rear-connectorised 1U.
    panel: {
      front: {
        elements: [
          { kind: "button", label: "PAD", callouts: [1] },
          { kind: "button", label: "AUTO", callouts: [2] },
          { kind: "knob", label: "THRESH", callouts: [3] },
          { kind: "led", label: null, count: 2, callouts: [3] },
          { kind: "button", label: "MUTE", callouts: [4] },
          { kind: "button", label: "STBY", callouts: [5] },
          { kind: "button", label: "A-B", callouts: [6] },
          { kind: "led", label: "ALARM", callouts: [7] },
          { kind: "jack", label: null, port: "XLR OUT", callouts: [8] },
          { kind: "switch", label: "LIFT", callouts: [9] },
          { kind: "labelStrip", label: null, size: "sm", callouts: [10] },
        ],
      },
    },
    ports: [
      { label: "XLR OUT", connector: "XLR3", direction: "output", signal: "analog audio", channels: 8, count: 8, face: "front", projectionMm: null },
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
      { field: "panel.front", sourceUrl: RADIAL_MANUAL, quote: "1. GLOBAL PAD | 2. AUTO ON | 3. THRESHOLD: Two level sensing LEDs illuminate when signal is detected. | 4. MUTE | 5. STANDBY | 6. A-B SELECT: Front panel selector | 7. ALARM LED | 8. XLR OUT: Balanced, low-Z mic-level direct box outputs | 9. LIFT | 10. LABEL STRIP", confidence: 0.92, derivation: "Front Panel callouts 1-10. CORRECTION: the eight XLR outputs were previously recorded on the rear face; the manual lists them under Front Panel, which materially reduces this unit's required case depth." },
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
    // Section 5.1 "Connectors - LEDs" of the Digiface Dante manual, which is
    // prose rather than numbered callouts: "The front of the Digiface Dante
    // features four Gigabit Ethernet ports, 2 BNC sockets for word or MADI
    // I/O, a state LED, and the headphone output."
    panel: {
      front: {
        elements: [
          { kind: "jack", label: null, port: "Gigabit Ethernet (Dante)" },
          { kind: "jack", label: null, port: "MADI In / Word Clock In" },
          { kind: "led", label: "STATE" },
          { kind: "jack", label: null, port: "MADI Out / Word Clock Out" },
          { kind: "jack", label: "PHONES", port: "Phones" },
        ],
      },
    },
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
      { field: "panel.front", sourceUrl: RME_MANUAL, quote: "The front of the Digiface Dante features four Gigabit Ethernet ports, 2 BNC sockets for word or MADI I/O, a state LED, and the headphone output. | The State LED beside the BNC input shows Lock and Sync state for the word or MADI input signal.", confidence: 0.86, derivation: "Section 5.1 Connectors - LEDs, which is prose rather than numbered callouts. The State LED position is stated by the manual as beside the BNC input." },
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
    // Transmitter front panel callouts 1-12 of the Axient Digital PSM guide,
    // which documents ADTQ and ADTD from one pair of figures.
    panel: {
      front: {
        elements: [
          { kind: "knob", label: "PHONES", callouts: [1] },
          { kind: "jack", label: null, port: "Monitor jack", callouts: [2] },
          { kind: "window", label: "IR", callouts: [3] },
          { kind: "led", label: null, callouts: [4] },
          { kind: "window", label: null, size: "sm", callouts: [5] },
          { kind: "switch", label: "RF", callouts: [6] },
          { kind: "display", label: null, size: "lg", callouts: [7], readouts: ["ch 1-4", "level"] },
          { kind: "button", label: "F1-F4", count: 4, stack: "v", callouts: [8] },
          { kind: "button", label: "ENTER", callouts: [9] },
          { kind: "button", label: "EXIT", callouts: [10] },
          { kind: "knob", label: null, callouts: [11] },
          { kind: "powerSwitch", label: null, callouts: [12] },
        ],
      },
    },
    ports: [
      { label: "Monitor jack", connector: "TRS", direction: "output", signal: "analog audio", channels: 2, count: 1, face: "front", projectionMm: null },
      { label: "Ctrl 2 (PoE)", connector: "RJ45", direction: "bidirectional", signal: "network", channels: null, count: 1, face: "rear", projectionMm: null },
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
      { field: "ports", sourceUrl: "https://pubs.shure.com/view/guide/ADPSM/en-US.pdf", quote: "Monitor Jack - 1/8 in (3.5 mm) output jack. | Ethernet Ports - Four Ethernet ports carry the following signals: ctrl 1: Network control / ctrl 2: Network control / Dante Primary: Dante digital audio / Dante Secondary: Dante digital audio", confidence: 0.9, derivation: "ADDED: the front monitor jack (front panel callout 2) was missing entirely, and only three of the four rear Ethernet ports were recorded - ctrl 2 was absent." },
      { field: "panel.front", sourceUrl: "https://pubs.shure.com/view/guide/ADPSM/en-US.pdf", quote: "Headphone Volume Knob | Monitor Jack - 1/8 in (3.5 mm) output jack. | Infrared (IR) Sync Window | Infrared (IR) Sync LED | Ambient Light Sensor | RF Switch | Display | Function Buttons - named F1, F2, F3, F4 (from top to bottom) | ENTER Button | EXIT Button | Control Wheel | Power Switch", confidence: 0.85, derivation: "Transmitter Front Panel callouts 1-12 of the shared Axient Digital PSM guide, which covers ADTQ and ADTD from one figure. Left-to-right order taken from callout order." },
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
    // 24Ao front panel callouts 1-6 of the 24Ai/24Ao user guide. Callouts 1-3
    // are meter and clock fields inside the backlit LCD, described on the
    // features page as "The large backlit LCD displays all signal activity at
    // a glance" - the LCD itself is never numbered.
    panel: {
      front: {
        elements: [
          { kind: "display", label: null, size: "lg", readouts: ["24 analog out", "ADAT in / out", "CLOCK"], callouts: [1, 2, 3] },
          { kind: "button", label: "SEL", callouts: [5] },
          { kind: "button", label: null, count: 2, callouts: [5] },
          { kind: "button", label: "BACK", callouts: [5] },
          { kind: "button", label: "ID", callouts: [6] },
          { kind: "powerSwitch", label: null, callouts: [4] },
        ],
      },
    },
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
      { field: "panel.front", sourceUrl: "https://cdn-data.motu.com/manuals/avb/24Ai_24Ao_User_Guide.pdf", quote: "ANALOG OUTPUT METERS for the twenty-four analog outputs. | ADAT OPTICAL input and output metering. | The CLOCK section displays the current operating sample rate and clock mode (source) for the unit. | POWER SWITCH | Push SEL (select) to enter the LCD menu. Push the ARROW buttons to scroll through menu options. Push BACK to return to the previous menu level. | Push ID to display network settings for the device", confidence: 0.7, derivation: "24Ao Front Panel callouts 1-6. Callouts 1-3 are meter and clock fields inside the LCD, not separate parts; the LCD itself is never numbered on the panel page and is sourced from the features text, the large backlit LCD displays all signal activity at a glance." },
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
    // Product overview, "Front" list 1-9 of the ew IEM G4 manual. The audio
    // level meter is drawn on the display, not as a physical bargraph: the
    // only discrete indicators are the blue IR LED and the red warning LED.
    panel: {
      front: {
        elements: [
          { kind: "jack", label: "PHONES", port: "Headphone output", callouts: [1] },
          { kind: "knob", label: null, callouts: [2] },
          { kind: "window", label: "IR", callouts: [3] },
          { kind: "led", label: null, callouts: [4] },
          { kind: "display", label: null, size: "lg", callouts: [5], readouts: ["AF level", "bank / channel", "frequency"] },
          { kind: "knob", label: null, callouts: [6] },
          { kind: "button", label: "SYNC", callouts: [7] },
          { kind: "button", label: "ESC", callouts: [8] },
          { kind: "button", label: "STANDBY", callouts: [9] },
        ],
      },
      rear: {
        elements: [
          { kind: "handle", label: null, size: "sm", callouts: [1] },
          { kind: "jack", label: null, port: "DC IN", callouts: [2] },
          { kind: "jack", label: null, port: "ETHERNET RJ45", callouts: [3] },
          { kind: "jack", label: null, port: "LOOP OUT BAL L(I)", callouts: [4] },
          { kind: "jack", label: null, port: "LOOP OUT BAL R(II)", callouts: [5] },
          { kind: "jack", label: null, port: "BAL AF IN L(I)", callouts: [6] },
          { kind: "jack", label: null, port: "BAL AF IN R(II)", callouts: [7] },
          { kind: "jack", label: null, port: "RF OUT", callouts: [8] },
        ],
      },
    },
    ports: [
      { label: "Headphone output", connector: "TRS", direction: "output", signal: "analog audio", channels: 2, count: 1, face: "front", projectionMm: null },
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
      { field: "panel.rear", sourceUrl: "https://www.sennheiser.com/en-us/catalog/products/wireless-systems/sr-iem-g4/sr-iem-g4-a-509618", sourceTitle: EW_IEM_G4_MANUAL, quote: "Back: 1 Strain relief for the cable of the power supply unit | 2 DC IN socket | 3 LAN connection socket (ETHERNET RJ45) | 4 6.3 mm jack socket LOOP OUT BAL L(I), Audio output, left | 5 6.3 mm jack socket LOOP OUT BAL R(II), Audio output, right | 6 XLR-3/6.3 mm jack combo socket BAL AF IN L(I), Audio input, left | 7 XLR-3/6.3 mm jack combo socket BAL AF IN R(II), Audio input, right | 8 RF OUT BNC socket, Antenna output with remote power supply input", confidence: 0.95, derivation: "Product overview, Back list 1-8, page 60. Order is the manufacturer's: the callouts run left to right beneath the figure. Callout 1 is a moulded cable grip rather than a connector." },
      { field: "powerMaxW", sourceUrl: "https://www.sennheiser.com/en-us/catalog/products/wireless-systems/sr-iem-g4/sr-iem-g4-a-509618", sourceTitle: EW_IEM_G4_MANUAL, quote: "Power supply 12 V DC | Power consumption max. 350 mA | Rear panel silkscreen: DC IN 12V/350mA", confidence: 0.9, derivation: "CONFIRMED against the full instruction manual, page 116. 12 V x 0.35 A = 4.2 W, a nameplate ceiling. The manual prints no typical figure, and the same rating is silkscreened on the rear panel." },
      { field: "ports", sourceUrl: "https://docs.cloud.sennheiser.com/en-us/ew-iem-g4/ew-iem-g4/ew-iem-g4-sr-connections-back.html", quote: "Front: Headphone socket | Volume control for the headphone socket", confidence: 0.9, derivation: "ADDED: the front headphone socket is callout 1 of the manual's Front list and was missing from this device's port table. It sits on the front face, so it does not consume case depth." },
      { field: "panel.front", sourceUrl: "https://docs.cloud.sennheiser.com/en-us/ew-iem-g4/ew-iem-g4/ew-iem-g4-sr-connections-back.html", quote: "Headphone socket | Volume control for the headphone socket | Infrared interface with a blue LED | Red LED for warnings | Display | Jog dial for navigating through the menu | SYNC button | ESC button | STANDBY button", confidence: 0.9, derivation: "Product overview, Front list 1-9. The AF audio level meter is drawn on the display, not as a discrete bargraph, so it is a readout. Left-to-right order taken from list order." },
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
    // Receiver front panel callouts 1-7 of the SLXD guide.
    panel: {
      front: {
        elements: [
          { kind: "led", label: "SYNC", callouts: [1] },
          { kind: "window", label: "IR", callouts: [2] },
          { kind: "display", label: null, size: "lg", callouts: [3], readouts: ["group / ch", "battery"] },
          { kind: "button", label: "SYNC", callouts: [4] },
          { kind: "button", label: "EXIT", callouts: [5] },
          { kind: "knob", label: null, callouts: [6] },
          { kind: "powerSwitch", label: null, callouts: [7] },
        ],
      },
    },
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
      { field: "panel.front", sourceUrl: "https://pubs.shure.com/view/guide/SLXD/en-US.pdf", quote: "Sync LED - Flashing: IR sync mode is enabled, Solid: Receiver and transmitter aligned for IR sync | IR port - Align with the transmitter IR port during an IR sync | Display - Shows menu options, receiver and transmitter settings | Sync button | Exit button | Control knob - Change menu parameters. Push knob to confirm changes | Power button", confidence: 0.88, derivation: "Receiver front panel callouts 1-7. Left-to-right order taken from callout order." },
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
    // Receiver callouts 1-16 of the GLXD4R+ guide. The guide prints one
    // continuous list over a figure showing both faces; 1-11 are drawn on the
    // front, 12-16 on the rear.
    panel: {
      front: {
        elements: [
          { kind: "led", label: "RF", callouts: [1] },
          { kind: "button", label: "GROUP", callouts: [2] },
          { kind: "led", label: "SYNC", callouts: [3] },
          { kind: "button", label: "LINK", callouts: [4] },
          { kind: "button", label: "CH", callouts: [5] },
          { kind: "display", label: null, callouts: [6], readouts: ["group / ch", "battery"] },
          { kind: "button", label: "GAIN", count: 2, callouts: [7] },
          { kind: "led", label: null, callouts: [8] },
          { kind: "bay", label: "CHARGE", callouts: [9] },
          { kind: "powerSwitch", label: null, callouts: [10] },
        ],
      },
    },
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
      { field: "panel.front", sourceUrl: "https://pubs.shure.com/view/guide/GLXD4Rplus/en-US.pdf", quote: "RF status LED | Group button | Data sync LED | Link button | Channel button | Display - Shows receiver and transmitter status. | Gain buttons - Press to increase or decrease transmitter gain | Battery charging indicator | Battery charging bay - Charges transmitter battery. | Power button", confidence: 0.8, derivation: "Receiver callouts 1-10 of a single continuous 1-16 list drawn over a figure of both faces. The guide prints no front/rear headings; 1-11 are on the front figure. Left-to-right order taken from callout order." },
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
    // ULXP4 Professional receiver, callouts 1-18 (front) of the ULX guide.
    // Ten of those eighteen are fields inside the LCD, not parts: 2-7 and
    // 10-13 are readouts and collapse into the one display element. The LCD
    // window itself is never numbered, which is why it carries no callout.
    panel: {
      front: {
        elements: [
          { kind: "led", label: "ANT", count: 2, callouts: [1] },
          { kind: "ledBar", label: "RF", callouts: [8] },
          { kind: "ledBar", label: "AUDIO", callouts: [9] },
          {
            kind: "display",
            label: null,
            size: "lg",
            readouts: ["GROUP / CHANNEL", "FREQUENCY", "battery"],
            callouts: [2, 3, 4, 5, 6, 7, 10, 11, 12, 13],
          },
          { kind: "button", label: "MODE", callouts: [14] },
          { kind: "button", label: "SET", callouts: [15] },
          { kind: "knob", label: null, callouts: [16] },
          { kind: "knob", label: "LEVEL", callouts: [17] },
          { kind: "powerSwitch", label: null, callouts: [18] },
        ],
      },
    },
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
      { field: "depthMm", sourceUrl: ULX_2024, sourceTitle: SHURE_ULX_2024, quote: "43 x 214 x 172 mm (1.72 x 8.56 x 6.88 in.), H x W x D", confidence: 0.95, derivation: "CONFIRMED, and now axis-labelled. The earlier record came from the archived printed guide, which prints the same three numbers without saying which is which; this guide labels them H x W x D, so the depth figure is the manufacturer's own rather than an inference." },
      { field: "weightLb", sourceUrl: ULX_2024, sourceTitle: SHURE_ULX_2024, quote: "1105 g (2 lbs, 7 oz.)", confidence: 0.95, derivation: "CONFIRMED against the current Shure-hosted guide. 1105 g x 2.20462 / 1000 = 2.436 lb." },
      { field: "powerMaxW", sourceUrl: ULX_2024, sourceTitle: SHURE_ULX_2024, quote: "Power Requirements 14-18 V DC (negative ground), 550 mA", confidence: 0.8, derivation: "CONFIRMED. 18 V x 0.55 A = 9.9 W at the top of the accepted range - a supply ceiling, not a measured draw." },
      { field: "panel.front", sourceUrl: ULX_GUIDE, quote: "Receiving Antenna Indicators. One of these amber LEDs will glow | RF Level Indicators. Indicate received RF signal strength. | TX Audio Level Indicators. Green indicates normal operation. Amber indicates approaching overload condition. Red indicates excessive audio levels. | MODE Button | SET Button | Display Control Knob | Level Control | Power On/Off Switch", confidence: 0.75, derivation: "ULXP4 PROFESSIONAL RECEIVER FEATURES AND CONTROLS, callouts 1-18. Callouts 2-7 and 10-13 are fields of the LCD, not parts, and collapse into one display element; the LCD window itself carries no callout in the guide. Left-to-right order taken from callout order." },
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
    // ULXS4 Standard receiver, callouts 1-12 (front) of the ULX guide. Six of
    // the twelve — 3 to 8 — are fields of the one LCD rather than separate
    // parts, so they collapse into the display element.
    panel: {
      front: {
        elements: [
          { kind: "led", label: "RF", callouts: [1] },
          { kind: "ledBar", label: "TX AUDIO", callouts: [2] },
          {
            kind: "display",
            label: null,
            size: "lg",
            readouts: ["GROUP / CHANNEL", "battery", "volume"],
            callouts: [3, 4, 5, 6, 7, 8],
          },
          { kind: "button", label: "MODE", callouts: [9] },
          { kind: "button", label: "SET", callouts: [10] },
          { kind: "button", label: null, count: 2, callouts: [11] },
          { kind: "powerSwitch", label: null, callouts: [12] },
        ],
      },
    },
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
      { field: "depthMm", sourceUrl: ULX_2024, sourceTitle: SHURE_ULX_2024, quote: "43 x 214 x 163 mm (1.72 x 8.56 x 6.52 in.), H x W x D", confidence: 0.95, derivation: "CONFIRMED, and now axis-labelled. The earlier record came from the archived printed guide, which prints the same three numbers without saying which is which; this guide labels them H x W x D, so the depth figure is the manufacturer's own rather than an inference." },
      { field: "weightLb", sourceUrl: ULX_2024, sourceTitle: SHURE_ULX_2024, quote: "1049 g (2 lbs, 5 oz.)", confidence: 0.95, derivation: "CONFIRMED against the current Shure-hosted guide. 1049 g x 2.20462 / 1000 = 2.313 lb." },
      { field: "powerMaxW", sourceUrl: ULX_2024, sourceTitle: SHURE_ULX_2024, quote: "Power Requirements 14-18 V DC (negative ground), 550 mA", confidence: 0.8, derivation: "CONFIRMED. 18 V x 0.55 A = 9.9 W at the top of the accepted range - a supply ceiling, not a measured draw." },
      { field: "panel.front", sourceUrl: ULX_GUIDE, quote: "RF Indicator. Glows green to indicate presence of received Radio Frequency (RF) signal. | TX Audio Level Indicators. | MODE Button. Press this button to step through the display menu. | SET Button. Saves the altered setting. | Button. Press this button to increase or decrease the Volume level | Power On/Off Switch. Turns the receiver on and off.", confidence: 0.78, derivation: "ULXS4 Standard Receiver Front Panel, callouts 1-12. Callouts 3-8 are fields of the one LCD (antenna indicator, GROUP, CHANNEL, battery, SCAN, TV/volume) and collapse into the display element. Left-to-right order taken from callout order." },
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
    depthMm: 212,
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
    // Product overviews, manual page 5. The figure carries numbered leader
    // lines in true left-to-right order across both faces - 1-7 on the front,
    // 8-17 on the rear - so this layout's ORDER is the manufacturer's, not an
    // inference from a list. The audio level meter is drawn on the display
    // panel (displays overview, page 6), so there is no discrete bargraph.
    panel: {
      front: {
        elements: [
          { kind: "jack", label: null, port: "Headphone output", callouts: [1] },
          { kind: "knob", label: null, callouts: [2] },
          { kind: "button", label: "SYNC", callouts: [3] },
          { kind: "window", label: "IR", callouts: [4] },
          {
            kind: "display",
            label: null,
            size: "lg",
            readouts: ["AF level", "B.Ch / frequency", "EQ / sensitivity"],
            callouts: [5],
          },
          { kind: "knob", label: null, callouts: [6] },
          { kind: "button", label: "STANDBY", callouts: [7] },
        ],
      },
      rear: {
        elements: [
          { kind: "handle", label: null, size: "sm", callouts: [8] },
          { kind: "jack", label: null, port: "DC IN", callouts: [9] },
          { kind: "led", label: null, callouts: [10] },
          { kind: "jack", label: null, port: "ETHERNET RJ 45", callouts: [11] },
          { kind: "jack", label: null, port: "LOOP OUT BAL L(I)", callouts: [12] },
          { kind: "jack", label: null, port: "LOOP OUT BAL R(II)", callouts: [13] },
          { kind: "labelStrip", label: null, size: "sm", callouts: [14] },
          { kind: "jack", label: null, port: "BAL AF IN L(I)", callouts: [15] },
          { kind: "jack", label: null, port: "BAL AF IN R(II)", callouts: [16] },
          { kind: "jack", label: null, port: "RF OUT", callouts: [17] },
        ],
      },
    },
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
      "which of the printed 202 mm and 212 mm figures is depth and which is width \u2014 the manual prints \"Dimensions approx. 202 x 212 x 43 mm\" with no W/D/H labels. The larger figure is recorded as depth deliberately: a depth estimate that is too small strands a build on site, one that is too large costs a slightly bigger case",
    ],
    provenance: [
      { field: "depthMm", sourceUrl: G3_PRODUCT, sourceTitle: G3_MANUAL, quote: "Dimensions approx. 202 mm x 212 mm x 43 mm", confidence: 0.6, derivation: "CORRECTED from 202 to 212. The manual prints the three figures with no W/D/H labels, and this catalog had recorded 202 here while recording 212 for the SR IEM G4 - the same ew half-rack chassis, printed with the same three numbers. The larger figure is now used for both: consistent, and wrong in the direction that costs a bigger case rather than a build that will not close." },
      { field: "panel.front", sourceUrl: G3_PRODUCT, sourceTitle: G3_MANUAL, quote: "Operating elements - front panel: 1 Headphone output, 1/4 in (6.3 mm) jack socket | 2 Headphone volume control | 3 sync button, backlit | 4 Infra-red interface | 5 Display panel, backlit in orange | 6 Jog dial | 7 STANDBY button with operation indication (red backlighting), serves as the ESC (cancel) key in the operating menu", confidence: 0.95, derivation: "Product overviews, page 5. The figure numbers the parts with leader lines in left-to-right order, so unlike the rest of this catalog the layout order here is printed by the manufacturer rather than inferred from list order." },
      { field: "panel.rear", sourceUrl: G3_PRODUCT, sourceTitle: G3_MANUAL, quote: "Operating elements - rear panel: 8 Cable grip for power supply DC cable | 9 DC socket (DC IN) for connection of NT 2-3 mains unit | 10 LED (yellow) for network activity indication | 11 LAN socket (ETHERNET RJ 45) | 12 Audio output left (LOOP OUT BAL L(I)), 1/4 in (6.3 mm) jack socket | 13 Audio output right (LOOP OUT BAL R(II)), 1/4 in (6.3 mm) jack socket | 14 Type plate | 15 Audio input left (BAL AF IN L(I)), 1/4 in (6.3 mm) jack/XLR-3 combo socket | 16 Audio input right (BAL AF IN R(II)), 1/4 in (6.3 mm) jack/XLR-3 combo socket | 17 Antenna output (RF OUT) with remote power supply input, BNC socket", confidence: 0.95, derivation: "Product overviews, page 5. Left-to-right order printed by the manufacturer. Callouts 8, 10 and 14 are not connectors - a cable grip, a network LED and the type plate - and appear on no other rear elevation in this catalog." },
      { field: "weightLb", sourceUrl: G3_PRODUCT, sourceTitle: G3_MANUAL, quote: "Weight approx. 980 g", confidence: 0.95, derivation: "CONFIRMED against the printed manual, page 31. 980 g x 2.20462 / 1000 = 2.161 lb, matching the figure already recorded." },
      { field: "powerMaxW", sourceUrl: G3_PRODUCT, sourceTitle: G3_MANUAL, quote: "Power supply 12 V DC | Current consumption max. 350 mA", confidence: 0.9, derivation: "CONFIRMED against the printed manual, page 31. 12 V x 0.35 A = 4.2 W, a nameplate ceiling rather than a measured draw. No typical figure is printed anywhere in the manual." },
      { field: "ports", sourceUrl: G3_PRODUCT, sourceTitle: G3_MANUAL, quote: "Antenna output BNC socket, 50 ohm with remote power supply input 12 V DC | AF input BAL AF IN L(I)/BAL AF IN R(II) 2 x XLR-3/1/4 in (6.3 mm) jack combo socket, electronically balanced | AF output LOOP OUT BAL L(I)/LOOP OUT BAL R(II) 1/4 in (6.3 mm) stereo jack socket, balanced | Headphone output 1/4 in (6.3 mm) stereo jack socket", confidence: 0.95, derivation: "CONFIRMED against the printed manual, page 31. Every connector already recorded for this device matches the specification table, including the front headphone jack." },
      {"field": "status", "sourceUrl": "https://www.sennheiser.com/en-us/catalog/uncategorized/sr-300-iem-g3/sr-300-iem-g3-503650", "quote": "This product is no longer available to be purchased", "confidence": 0.95, "derivation": "Manufacturer legacy page for this exact SKU (503650)."},
      {"field": "depthMm", "sourceUrl": "https://www.sennheiser.com/en-us/catalog/uncategorized/sr-300-iem-g3/sr-300-iem-g3-503650", "quote": "212 x 202 x 43 mm", "confidence": 0.85, "derivation": "Taking Sennheiser's width x depth x height order gives depth 202 mm. Held at 0.85 because the instruction manual prints the same three numbers in the opposite horizontal order."},
      {"field": "weightLb", "sourceUrl": "https://www.sennheiser.com/en-us/catalog/uncategorized/sr-300-iem-g3/sr-300-iem-g3-503650", "quote": "980", "confidence": 0.9, "derivation": "Product page weight field in grams: 0.980 kg / 0.45359237 = 2.1605 lb. Matches the manual's 980 g."},
      {"field": "powerMaxW", "sourceUrl": "https://www.sennheiser.com/en-us/catalog/uncategorized/sr-300-iem-g3/sr-300-iem-g3-503650", "quote": "Current consumption: max. 350 mA", "confidence": 0.9, "derivation": "A DRAW figure, not a supply rating: 0.350 A x 12 V = 4.2 W. No typical consumption is printed."},
      {"field": "ports", "sourceUrl": "https://www.sennheiser.com/en-us/catalog/uncategorized/sr-300-iem-g3/sr-300-iem-g3-503650", "quote": "Antenna output (RF OUT) with remote power supply input, BNC socket", "confidence": 0.95, "derivation": "Rear panel enumerated from the printed manual; the BNC also carries remote power to an antenna booster."},
    ],
  },

  // --- generic infrastructure. Dimensions here are the standard, not a product.
  {
    id: "shure-p3t",
    slug: "shure-p3t",
    brand: "Shure",
    model: "P3T",
    category: "IEM Transmitter",
    passive: false,
    description:
      "Half-rack PSM300 stereo personal monitor transmitter: two balanced 1/4-inch TRS inputs with switchable line/aux sensitivity, balanced TRS loop outputs and a BNC antenna. Two fit one rack space with the dual mount kit.",
    formFactor: "half-rack",
    rackUnits: 1,
    depthMm: 172,
    depthIsOverall: true,
    weightLb: 1.73,
    powerTypicalW: null,
    powerMaxW: 3.9,
    inrushFactor: 1,
    poePowered: false,
    status: "current",
    statusNote: "JB band models have a permanently fixed antenna.",
    productUrl: "https://www.shure.com/en-US/products/wireless-systems/psm300",
    datasheetUrl: PSM300_GUIDE,
    // One continuous list 1-13 under "P3T Transmitter Front and Rear Panels",
    // split front 1-7 / rear 8-13 by the two figures. The LCD is callout 4 and
    // the seven fields inside it are a SEPARATE list, also numbered 1-7, which
    // is the trap in this document.
    panel: {
      front: {
        elements: [
          { kind: "knob", label: "LEVEL", callouts: [1] },
          { kind: "window", label: "IR", callouts: [2] },
          { kind: "button", label: "SYNC", callouts: [3] },
          {
            kind: "display",
            label: null,
            size: "lg",
            readouts: ["audio meter", "group / channel / TV", "MX / mono"],
            callouts: [4],
          },
          { kind: "button", label: "GROUP", callouts: [5] },
          { kind: "button", label: "CH", callouts: [6] },
          { kind: "powerSwitch", label: null, callouts: [7] },
        ],
      },
      rear: {
        elements: [
          { kind: "jack", label: null, port: "Power Input", callouts: [8] },
          { kind: "switch", label: "MX/MONO", callouts: [9] },
          { kind: "switch", label: "LINE/AUX", callouts: [10] },
          { kind: "jack", label: null, port: "Loop Outputs", callouts: [11] },
          { kind: "jack", label: null, port: "Audio Inputs", callouts: [12] },
          { kind: "jack", label: null, port: "Antenna", callouts: [13] },
        ],
      },
    },
    ports: [
      { label: "Power Input", connector: "Other", direction: "input", signal: "power", channels: null, count: 1, face: "rear", projectionMm: null },
      { label: "Loop Outputs", connector: "TRS", direction: "output", signal: "analog audio", channels: 2, count: 2, face: "rear", projectionMm: null },
      { label: "Audio Inputs", connector: "TRS", direction: "input", signal: "analog audio", channels: 2, count: 2, face: "rear", projectionMm: null },
      { label: "Antenna", connector: "BNC", direction: "output", signal: "antenna", channels: null, count: 1, face: "rear", projectionMm: null },
    ],
    unresolved: [
      "powerTypicalW \u2014 only the 12-15 V DC, 260 mA maximum requirement is printed, never a typical draw",
      "the PS24 supply's own input rating is not printed in the guide",
      "depth behind the rails (the guide prints overall chassis depth)",
    ],
    provenance: [
      { field: "panel.front", sourceUrl: PSM300_GUIDE, sourceTitle: SHURE_PSM300, quote: "1 Input Level Control - Adjusts the level of the incoming audio signal | 2 IR Sync Window - Sends and receives group/channel data to sync receivers with the transmitter | 3 Sync Button - Press to synchronize the transmitter and receiver to the same group and channel | 4 LCD Display - Displays audio, RF, and system information | 5 Group Button - Press to scroll through group settings | 6 Channel Button - Press to scroll through channel settings | 7 Power - Turns power on or off", confidence: 0.92, derivation: "P3T Transmitter Front and Rear Panels, callouts 1-7 of a single continuous 1-13 list; the front/rear split is resolvable only from the two figures. Left-to-right order taken from callout order." },
      { field: "panel.rear", sourceUrl: PSM300_GUIDE, sourceTitle: SHURE_PSM300, quote: "8 Power Input - Connect the supplied Shure PS24 external power supply | 9 Mono/Stereo-MX Switch | 10 Line/Aux Switch | 11 Loop Outputs (1/4 Inch TRS, Balanced) - Connect outputs to additional PSM systems or other audio devices | 12 Audio Inputs (1/4 Inch TRS, Balanced) - Connect to mixer outputs or other audio sources for monitoring by the performers | 13 BNC Antenna Connector - Connect the supplied 1/4 wave antenna, directional antenna, or a Shure PA411 antenna combiner", confidence: 0.92, derivation: "Callouts 8-13 of the same list. The seven items the guide numbers 1-7 under P3T Transmitter Display are fields inside the LCD, not panel parts, and are recorded as readouts of callout 4." },
      { field: "depthMm", sourceUrl: PSM300_GUIDE, sourceTitle: SHURE_PSM300, quote: "Dimensions 43 x 198 x 172 mm (1.7 x 7.8 x 6.8 in.), H x W x D", confidence: 0.92, derivation: "Axis-labelled by the manufacturer, so 172 mm is depth and no inference is involved. Height 43 mm is under one rack unit and width 198 mm is half-rack." },
      { field: "weightLb", sourceUrl: PSM300_GUIDE, sourceTitle: SHURE_PSM300, quote: "Net Weight 783 g(27.6 oz.)", confidence: 0.95, derivation: "783 g x 2.20462 / 1000 = 1.726 lb, which also matches the printed 27.6 oz." },
      { field: "powerMaxW", sourceUrl: PSM300_GUIDE, sourceTitle: SHURE_PSM300, quote: "Power Requirement 12-15V DC, 260 mA Maximum", confidence: 0.8, derivation: "DERIVED, NOT PRINTED. 15 V x 0.26 A = 3.9 W at the top of the accepted range. A circuit-budgeting ceiling, not a measured draw." },
      { field: "formFactor", sourceUrl: PSM300_GUIDE, sourceTitle: SHURE_PSM300, quote: "The P3T Transmitter can be mounted in a standard 19-inch rack. Up to two units can be mounted in a single rack space. | All-metal half-rack transmitter | Note: Always use both straddle bars when mounting two units.", confidence: 0.96, derivation: "Stated explicitly, including the two-in-one-U arrangement this planner models." },
      { field: "ports", sourceUrl: PSM300_GUIDE, sourceTitle: SHURE_PSM300, quote: "Audio Input Connector Type 6.35 mm (1/4in) TRS, Electronically balanced | Audio Output Connector Type 6.35 mm (1/4in) TRS, Electronically balanced, Impedance Connected directly to inputs | BNC Antenna Connector", confidence: 0.9, derivation: "Input and output connector types from the specification tables; the antenna connector type is named only in panel callout 13, as the spec tables omit it." },
    ],
  },
  {
    id: "shure-slx4",
    slug: "shure-slx4",
    brand: "Shure",
    model: "SLX4",
    category: "Wireless Mic Receiver",
    passive: false,
    description:
      "Half-rack analog UHF diversity receiver from the SLX system: balanced XLR mic-level and unbalanced 1/4-inch instrument outputs with a recessed rear output level control, and an antenna connector at each end of the rear panel. Discontinued, superseded by SLX-D.",
    formFactor: "half-rack",
    rackUnits: 1,
    depthMm: 134,
    depthIsOverall: true,
    weightLb: 1.8,
    powerTypicalW: null,
    powerMaxW: 2.9,
    inrushFactor: 1,
    poePowered: false,
    status: "discontinued",
    statusNote: "Analog SLX line, guide 27A15631 Rev. 2 dated 2012. Superseded by SLX-D.",
    productUrl: "https://www.shure.com/en-US/products/wireless-systems/slx",
    datasheetUrl: SLX_GUIDE,
    // This guide prints NO numbered callout list for either face, so unlike
    // the rest of the catalog the order here is read off the rear-panel
    // silkscreen in the figure and off the front-panel figures. Recorded at
    // lower confidence for exactly that reason.
    panel: {
      front: {
        elements: [
          { kind: "ledBar", label: "AUDIO" },
          { kind: "led", label: "READY" },
          { kind: "display", label: null, size: "lg", readouts: ["GROUP / CHANNEL", "MHz", "ANTENNA A / B"] },
          { kind: "button", label: "MENU" },
          { kind: "button", label: "SELECT" },
          { kind: "button", label: "SYNC" },
          { kind: "powerSwitch", label: null },
        ],
      },
      rear: {
        elements: [
          { kind: "jack", label: null, port: "ANTENNA B" },
          { kind: "jack", label: null, port: "POWER" },
          { kind: "jack", label: null, port: "MIC OUT" },
          { kind: "jack", label: null, port: "INSTRUMENT OUT" },
          { kind: "knob", label: "VOLUME" },
          { kind: "labelStrip", label: null, size: "sm" },
          { kind: "jack", label: null, port: "ANTENNA A" },
        ],
      },
    },
    ports: [
      { label: "ANTENNA B", connector: "BNC", direction: "input", signal: "antenna", channels: null, count: 1, face: "rear", projectionMm: null },
      { label: "POWER", connector: "Other", direction: "input", signal: "power", channels: null, count: 1, face: "rear", projectionMm: null },
      { label: "MIC OUT", connector: "XLR3", direction: "output", signal: "analog audio", channels: 1, count: 1, face: "rear", projectionMm: null },
      { label: "INSTRUMENT OUT", connector: "TS", direction: "output", signal: "analog audio", channels: 1, count: 1, face: "rear", projectionMm: null },
      { label: "ANTENNA A", connector: "BNC", direction: "input", signal: "antenna", channels: null, count: 1, face: "rear", projectionMm: null },
    ],
    unresolved: [
      "the antenna connector type is never named in the guide \u2014 BNC is inferred from the figure and the UA400 quarter-wave antenna range, not printed",
      "powerTypicalW",
      "the guide contradicts itself on current draw: the specification table prints 150 mA and the rear-panel silkscreen prints 160 mA",
      "panel element order \u2014 this guide prints no callout list, so the layout is read off the figures",
      "depth behind the rails (the guide prints overall chassis depth)",
    ],
    provenance: [
      { field: "panel.rear", sourceUrl: SLX_GUIDE, sourceTitle: SHURE_SLX, quote: "Rear panel silkscreen, left to right: ANTENNA B | 12-18 V, 160 mA, POWER | MIC OUT | INSTRUMENT OUT | VOLUME | SHURE INCORPORATED / NILES, IL 60714 / SLX4 RECEIVER | ANTENNA A", confidence: 0.6, derivation: "NO CALLOUT LIST EXISTS in this guide. The order above is read off the silkscreen printed in the rear-panel figure, which is weaker evidence than a numbered list and is recorded as such. The two circled numbers on that figure are cable-retainer assembly steps, not part callouts." },
      { field: "panel.front", sourceUrl: SLX_GUIDE, sourceTitle: SHURE_SLX, quote: "front-panel figures label: a five-segment LED ladder silkscreened audio | ready | menu | select | sync | power", confidence: 0.55, derivation: "NO CALLOUT LIST EXISTS. Element identities come from the labelled front-panel figures and running prose; their left-to-right order is inferred from those figures and is the weakest layout in this catalog." },
      { field: "depthMm", sourceUrl: SLX_GUIDE, sourceTitle: SHURE_SLX, quote: "Dimensions 42mm X 197mm X 134mm (H x W x D)", confidence: 0.92, derivation: "Axis-labelled by the manufacturer, so 134 mm is depth. Width 197 mm is half-rack and height 42 mm is under one rack unit." },
      { field: "weightLb", sourceUrl: SLX_GUIDE, sourceTitle: SHURE_SLX, quote: "Weight 816 g (1 lb 13oz.)", confidence: 0.95, derivation: "816 g x 2.20462 / 1000 = 1.799 lb, matching the printed 1 lb 13 oz." },
      { field: "powerMaxW", sourceUrl: SLX_GUIDE, sourceTitle: SHURE_SLX, quote: "Power Requirements 12-18 V DC @ 150 mA, supplied by external power supply (tip positive) | rear-panel silkscreen: 12-18 V, 160 mA", confidence: 0.55, derivation: "DERIVED, NOT PRINTED, and the guide disagrees with itself: the specification table says 150 mA, the rear panel says 160 mA. 18 V x 0.16 A = 2.9 W uses the higher figure at the top of the voltage range, which is the safe direction for a circuit budget." },
      { field: "formFactor", sourceUrl: SLX_GUIDE, sourceTitle: SHURE_SLX, quote: "Rack-Mounting SLX Receivers | Two Receivers - Required Accessories: 1 x UA440 | Rack Mount Kit for single Receiver - UA506 | Rack Mount Kit for Two Receivers - UA507", confidence: 0.85, derivation: "DERIVED. The guide never uses the words half-rack, but it shows two receivers occupying one rack space and sells a two-receiver kit, and the printed 197 mm width is half-rack." },
      { field: "ports", sourceUrl: SLX_GUIDE, sourceTitle: SHURE_SLX, quote: "Maximum Audio Output Level XLR connector: -13 dBV (into 600 ohm load); 6.35 mm (1/4in) connector: -2 dBV (into 3 kohm load) | Pin Assignments XLR connector: 1=ground, 2=audio, 3=no audio; 6.35 mm (1/4in) connector: Tip=audio, Ring=no audio, Sleeve=ground | rear panel silkscreen: MIC OUT, INSTRUMENT OUT, ANTENNA A, ANTENNA B", confidence: 0.75, derivation: "The XLR is wired 1=ground, 2=audio, 3=no audio, so it is impedance-balanced rather than a true balanced pair. The antenna connector type is NOT printed anywhere in this guide; BNC is inferred and is listed under unresolved." },
    ],
  },
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
    panel: { front: { elements: [{ kind: "vent", label: null, size: "lg" }] } },
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
    panel: { front: { elements: [{ kind: "fan", label: null, count: 4 }] } },
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
    panel: { front: { elements: [{ kind: "vent", label: null, size: "sm" }, { kind: "shelfLip", label: null }, { kind: "vent", label: null, size: "sm" }] } },
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

/**
 * Every unit in this rack is drawn from its own manufacturer's manual, so it
 * is the one to look at when checking that a panel matches the real thing.
 */
export const DEMO_RACK_MONITOR: RackSpec = {
  name: "Monitor world \u2014 8U, IEM and mics",
  case: SEED_CASES[1]!,
  circuits: [
    { label: "A", volts: 120, amps: 20 },
    { label: "B", volts: 120, amps: 15 },
  ],
  placements: [
    { deviceId: "shure-p3t", position: 1, slot: "left", circuit: "A", label: "IEM 1-2" },
    { deviceId: "shure-p3t", position: 1, slot: "right", circuit: "A", label: "IEM 3-4" },
    { deviceId: "sennheiser-sr-iem-g4", position: 2, slot: "left", circuit: "A", label: "IEM 5" },
    { deviceId: "sennheiser-sr300-iem-g3", position: 2, slot: "right", circuit: "A", label: "IEM 6 (spare)" },
    { deviceId: "generic-vent-1u", position: 3, slot: "full", circuit: null },
    { deviceId: "shure-slx4", position: 4, slot: "left", circuit: "B", label: "Vox 1" },
    { deviceId: "shure-slx4", position: 4, slot: "right", circuit: "B", label: "Vox 2" },
    { deviceId: "shure-slxd4", position: 5, slot: "left", circuit: "B", label: "Vox 3" },
    { deviceId: "shure-glxd4rp", position: 5, slot: "right", circuit: "B", label: "Gtr" },
    { deviceId: "shure-ad600", position: 6, slot: "full", circuit: "B" },
    { deviceId: "generic-fan-1u", position: 7, slot: "full", circuit: "A" },
  ],
};

export const DEMO_RACKS: RackSpec[] = [
  DEMO_RACK,
  DEMO_RACK_FIXED,
  DEMO_RACK_WIRELESS,
  DEMO_RACK_MONITOR,
];

export const DEMO_DEVICES: Map<string, DeviceSpec> = new Map(
  SEED_DEVICES.map((d) => [d.id, d as DeviceSpec]),
);
