/**
 * Panel drawing.
 *
 * Every unit is drawn to scale from its own record — 19 inches wide, 1.75 in
 * per U — rather than from a hand-made picture per product. That matters more
 * than it sounds: the catalog is filled by a research pipeline, so a device
 * added on Tuesday has to have a drawing on Tuesday. Nobody is going to
 * illustrate three hundred rear panels by hand, and a library that depends on
 * someone doing so is a library that stops growing.
 *
 * Front faces get furniture appropriate to the category (a display and knobs on
 * a receiver, a meter ladder on an interface, blades on a fan panel). Rear
 * faces get the actual connectors, one drawn shape per physical connector, laid
 * out and scaled to fit the panel width.
 *
 * Output is a plain SVG string with no DOM dependency, so the same function
 * serves the planner in the browser and the PDF patch sheet on the server.
 */

import type { DeviceSpec, PortSpec } from "./types";

/** The slice of a device this renderer needs. */
export type PanelDevice = Pick<
  DeviceSpec,
  "brand" | "model" | "category" | "ports"
>;

export const W = 1900;            // 19 in × 100
export const U = 175;

type Half = "left" | "right" | null;
type Drawer = (x: number, y: number, s: number, c: string) => string;             // 1.75 in × 100
var EAR = 118;           // rack ear width
var PAD = 34;            // inset from the ear to usable panel face
var LABEL_W = 430;       // brand/model zone on a front panel, as on real gear

/** Unbranded infrastructure: a vent panel has no logo on it. */
function isBlankFace(cat: string) { return /Vent Panel|Rack Shelf|Blank Panel|Rack Drawer/.test(cat); }

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
function esc(s: unknown): string {
  return String(s).replace(/[&<>"]/g, function (c) {
    return ESCAPES[c] ?? c;
  });
}

// ------------------------------------------------------------ connectors
// Widths are in panel units, chosen so a full-width row of eight XLRs looks
// like a full-width row of eight XLRs.
var CONN: Record<string, { w: number; draw: Drawer }> = {
  xlr:     { w: 104, draw: drawXLR },
  combo:   { w: 104, draw: drawCombo },
  jack:    { w: 62,  draw: drawJack },
  dsub:    { w: 168, draw: drawDsub },
  bnc:     { w: 62,  draw: drawBNC },
  rj:      { w: 74,  draw: drawRJ },
  sfp:     { w: 92,  draw: drawSFP },
  usb:     { w: 62,  draw: drawUSB },
  usbc:    { w: 54,  draw: drawUSBC },
  hdmi:    { w: 84,  draw: drawHDMI },
  din:     { w: 84,  draw: drawDIN },
  speakon: { w: 92,  draw: drawSpeakon },
  iec:     { w: 104, draw: drawIEC },
  outlet:  { w: 104, draw: drawOutlet },
  twist:   { w: 96,  draw: drawTwist },
  block:   { w: 92,  draw: drawBlock }
};

var SHAPE_OF: Record<string, string> = {
  "XLR3": "xlr", "XLR4": "xlr", "XLR5": "xlr", "XLR/TRS combo": "combo",
  "TRS": "jack", "TS": "jack", "RCA": "jack",
  "DB25": "dsub", "DB25 (Tascam)": "dsub", "EDAC": "dsub",
  "BNC": "bnc", "TNC": "bnc", "SMA": "bnc",
  "RJ45": "rj", "Dante RJ45": "rj", "AES50 RJ45": "rj", "etherCON": "rj",
  "SFP": "sfp",
  "USB-A": "usb", "USB-B": "usb", "USB-C": "usbc", "Thunderbolt": "usbc",
  "HDMI": "hdmi", "MIDI DIN": "din", "Speakon": "speakon",
  "IEC C14": "iec", "IEC C20": "iec", "Edison": "outlet",
  "powerCON": "twist", "powerCON TRUE1": "twist",
  "Terminal block": "block", "Other": "block"
};

function connFor(shape: string): { w: number; draw: Drawer } {
  return CONN[shape] ?? CONN["block"]!;
}

export function shapeFor(connector: string): string {
  return SHAPE_OF[connector] ?? "block";
}

var DIR_VAR: Record<string, string> = { input: "var(--dir-in)", output: "var(--dir-out)", bidirectional: "var(--dir-bi)" };

function drawXLR(x: number, y: number, s: number, c: string) {
  var r = s * 0.46;
  return ring(x, y, r, c) +
    dot(x - r * 0.4, y - r * 0.22, r * 0.17) +
    dot(x + r * 0.4, y - r * 0.22, r * 0.17) +
    dot(x, y + r * 0.42, r * 0.17);
}
function drawCombo(x: number, y: number, s: number, c: string) {
  var r = s * 0.46;
  return ring(x, y, r, c) +
    '<rect x="' + (x - r * 0.42) + '" y="' + (y - r * 0.42) + '" width="' + r * 0.84 +
    '" height="' + r * 0.84 + '" fill="none" stroke="' + c + '" stroke-width="' + s * 0.05 + '"/>';
}
function drawJack(x: number, y: number, s: number, c: string) {
  return ring(x, y, s * 0.3, c) + dot(x, y, s * 0.12);
}
function drawBNC(x: number, y: number, s: number, c: string) {
  return ring(x, y, s * 0.3, c) + dot(x, y, s * 0.09) +
    '<path d="M' + (x - s * 0.36) + ' ' + (y - s * 0.18) + 'L' + (x - s * 0.26) + ' ' + (y - s * 0.3) +
    'M' + (x + s * 0.36) + ' ' + (y - s * 0.18) + 'L' + (x + s * 0.26) + ' ' + (y - s * 0.3) +
    '" stroke="' + c + '" stroke-width="' + s * 0.06 + '" fill="none"/>';
}
function drawDsub(x: number, y: number, s: number, c: string) {
  var w = s * 0.78, h = s * 0.3;
  var d = "M" + (x - w) + " " + (y - h) + "H" + (x + w) + "L" + (x + w * 0.86) + " " + (y + h) +
    "H" + (x - w * 0.86) + "Z";
  var pins = "";
  for (var i = -3; i <= 3; i++) pins += dot(x + i * w * 0.24, y, s * 0.045);
  return '<path d="' + d + '" fill="none" stroke="' + c + '" stroke-width="' + s * 0.055 + '"/>' + pins;
}
function drawRJ(x: number, y: number, s: number, c: string) {
  var w = s * 0.34, h = s * 0.28;
  return '<path d="M' + (x - w) + " " + (y - h) + "h" + w * 2 + "v" + h * 1.7 + "h" + -w * 0.6 +
    "v" + h * 0.5 + "h" + -w * 0.8 + "v" + -h * 0.5 + "h" + -w * 0.6 + 'Z" fill="none" stroke="' +
    c + '" stroke-width="' + s * 0.055 + '"/>';
}
function drawSFP(x: number, y: number, s: number, c: string) {
  var w = s * 0.42, h = s * 0.22;
  return rect(x - w, y - h, w * 2, h * 2, c, s) +
    '<path d="M' + (x - w * 0.35) + " " + (y - h) + "v" + h * 2 + '" stroke="' + c +
    '" stroke-width="' + s * 0.05 + '"/>';
}
function drawUSB(x: number, y: number, s: number, c: string) {
  var w = s * 0.3, h = s * 0.16;
  return rect(x - w, y - h, w * 2, h * 2, c, s) +
    '<rect x="' + (x - w * 0.6) + '" y="' + (y - h * 0.35) + '" width="' + w * 1.2 +
    '" height="' + h * 0.7 + '" fill="' + c + '" opacity=".75"/>';
}
function drawUSBC(x: number, y: number, s: number, c: string) {
  var w = s * 0.26, h = s * 0.1;
  return '<rect x="' + (x - w) + '" y="' + (y - h) + '" width="' + w * 2 + '" height="' + h * 2 +
    '" rx="' + h + '" fill="none" stroke="' + c + '" stroke-width="' + s * 0.055 + '"/>';
}
function drawHDMI(x: number, y: number, s: number, c: string) {
  var w = s * 0.36, h = s * 0.15;
  return '<path d="M' + (x - w) + " " + (y - h) + "h" + w * 2 + "v" + h * 1.2 + "l" + -w * 0.3 + " " +
    h * 0.8 + "h" + -w * 1.4 + 'Z" fill="none" stroke="' + c + '" stroke-width="' + s * 0.055 + '"/>';
}
function drawDIN(x: number, y: number, s: number, c: string) {
  var r = s * 0.34, g = "";
  for (var i = 0; i < 5; i++) {
    var a = Math.PI * (0.15 + 0.175 * i);
    g += dot(x - Math.cos(a) * r * 0.55, y - Math.sin(a) * r * 0.55, s * 0.05);
  }
  return ring(x, y, r, c) + g;
}
function drawSpeakon(x: number, y: number, s: number, c: string) {
  var r = s * 0.36;
  return ring(x, y, r, c) +
    '<path d="M' + (x - r * 0.55) + " " + (y + r * 0.55) + "A" + r * 0.78 + " " + r * 0.78 +
    " 0 0 1 " + (x + r * 0.55) + " " + (y - r * 0.55) + '" fill="none" stroke="' + c +
    '" stroke-width="' + s * 0.06 + '"/>';
}
function drawIEC(x: number, y: number, s: number, c: string) {
  var w = s * 0.4, h = s * 0.26;
  return '<rect x="' + (x - w) + '" y="' + (y - h) + '" width="' + w * 2 + '" height="' + h * 2 +
    '" rx="' + h * 0.55 + '" fill="none" stroke="' + c + '" stroke-width="' + s * 0.055 + '"/>' +
    dot(x - w * 0.45, y, s * 0.055) + dot(x, y, s * 0.055) + dot(x + w * 0.45, y, s * 0.055);
}
/** A NEMA duplex, as seen on the back of a power conditioner. */
function drawOutlet(x: number, y: number, s: number, c: string) {
  var w = s * 0.34, h = s * 0.42;
  var g = '<rect x="' + (x - w) + '" y="' + (y - h) + '" width="' + w * 2 + '" height="' + h * 2 +
    '" rx="' + w * 0.5 + '" fill="none" stroke="' + c + '" stroke-width="' + s * 0.05 + '"/>';
  [-1, 1].forEach(function (k) {
    var cy = y + k * h * 0.45;
    g += '<rect x="' + (x - w * 0.42) + '" y="' + (cy - h * 0.16) + '" width="' + w * 0.16 +
      '" height="' + h * 0.3 + '" fill="' + c + '"/>' +
      '<rect x="' + (x + w * 0.26) + '" y="' + (cy - h * 0.16) + '" width="' + w * 0.16 +
      '" height="' + h * 0.3 + '" fill="' + c + '"/>' +
      dot(x, cy + h * 0.2 * k, s * 0.05);
  });
  return g;
}
function drawTwist(x: number, y: number, s: number, c: string) {
  var r = s * 0.36;
  return ring(x, y, r, c) +
    '<path d="M' + x + " " + (y - r * 0.6) + "A" + r * 0.6 + " " + r * 0.6 + " 0 1 1 " +
    (x - r * 0.6) + " " + y + '" fill="none" stroke="' + c + '" stroke-width="' + s * 0.07 + '"/>';
}
function drawBlock(x: number, y: number, s: number, c: string) {
  var w = s * 0.36, h = s * 0.22;
  return rect(x - w, y - h, w * 2, h * 2, c, s) +
    '<path d="M' + (x - w * 0.3) + " " + (y - h) + "v" + h * 2 + "M" + (x + w * 0.3) + " " +
    (y - h) + "v" + h * 2 + '" stroke="' + c + '" stroke-width="' + s * 0.045 + '"/>';
}

function ring(x: number, y: number, r: number, c: string) {
  return '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="var(--pf-hole)" stroke="' + c +
    '" stroke-width="' + r * 0.16 + '"/>';
}
function dot(x: number, y: number, r: number) { return '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="var(--pf-pin)"/>'; }
function rect(x: number, y: number, w: number, h: number, c: string, s?: number) {
  return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h +
    '" fill="var(--pf-hole)" stroke="' + c + '" stroke-width="' + (s || 60) * 0.05 + '"/>';
}

// ------------------------------------------------------------ rear layout
/**
 * One drawn connector per physical connector. A unit with eight XLR outputs
 * gets eight XLRs, because that is what you count when you are deciding
 * whether the loom reaches.
 */
interface Group { port: PortSpec; shape: string; each: number; n: number; width: number }

function rearGroups(device: PanelDevice, face: "front" | "rear"): Group[] {
  var ports = device.ports.filter(function (p: PortSpec) { return p.face === face; });
  if (face === "rear") ports = ports.slice().reverse();
  return ports.map(function (p: PortSpec) {
    var shape = shapeFor(p.connector);
    var each = connFor(shape).w;
    var n = Math.min(p.count || 1, 16);
    return { port: p, shape: shape, each: each, n: n, width: each * n };
  });
}

function drawFace(device: PanelDevice, face: "front" | "rear", units: number, PW: number, half: Half): string {
  PW = PW || W;
  var h = units * U;
  var b = faceBounds(PW, half);
  var labelW = half ? LABEL_W * 0.62 : LABEL_W;
  var left = b.left + (face === "front" && !isBlankFace(device.category) ? labelW : 0);
  if (face === "front") left += (b.right - left) * 0.5;
  // The rear carries the model name on the right, the way a real panel does,
  // so the connector field stops short of it.
  var right = b.right - (face === "rear" ? labelW : 0);
  var inner = { x: left, y: PAD * 0.5, w: Math.max(80, right - left), h: h - PAD };
  var groups = rearGroups(device, face);
  if (!groups.length) return "";

  var GAP = 26;
  var total = groups.reduce(function (s: number, g: Group) { return s + g.width; }, 0) + GAP * (groups.length - 1);
  var scale = Math.min(1, inner.w / total);
  // Below about 45% the connectors stop reading as themselves; wrap to a
  // second row instead, which multi-U panels have room for.
  var rows = [groups];
  if (scale < 0.45 && units > 1) {
    var mid = Math.ceil(groups.length / 2);
    rows = [groups.slice(0, mid), groups.slice(mid)];
    scale = Math.min(1, rows.reduce(function (m: number, r: Group[]) {
      var t = r.reduce(function (s: number, g: Group) { return s + g.width; }, 0) + GAP * (r.length - 1);
      return Math.min(m, inner.w / t);
    }, 1));
  }

  var rowH = inner.h / rows.length;
  var out = "";
  rows.forEach(function (row: Group[], ri: number) {
    var t = row.reduce(function (s: number, g: Group) { return s + g.width; }, 0) + GAP * (row.length - 1);
    var x = inner.x + (inner.w - t * scale) / 2;
    var cy = inner.y + rowH * ri + rowH * (rows.length > 1 ? 0.44 : 0.42);
    var size = Math.min(84, rowH * 0.62) * Math.max(scale, 0.42);

    row.forEach(function (g: Group) {
      var colour = DIR_VAR[g.port.direction] ?? "var(--dir-bi)";
      var gw = g.width * scale;
      for (var i = 0; i < g.n; i++) {
        var cx = x + (g.each * scale) * (i + 0.5);
        out += connFor(g.shape).draw(cx, cy, size, colour);
      }
      // Silkscreen, the way it is printed on the panel.
      if (size > 30 && gw > 76) {
        out += '<text x="' + (x + gw / 2) + '" y="' + (cy + size * 0.74) +
          '" class="silk-sm" text-anchor="middle">' + esc(trim(g.port.label, gw / 15)) + "</text>";
      }
      x += gw + GAP * scale;
    });
  });
  return out;
}

function trim(s: string, max: number): string {
  max = Math.max(4, Math.floor(max));
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

// ----------------------------------------------------------- front faces
/** Furniture by category, so a receiver looks like a receiver. */
/** Where the silkscreen starts, allowing for which side the ear is on. */
function textLeft(PW: number, half: Half): number { return (half === "right" ? EAR : half === "left" ? EAR : EAR) + PAD; }

function faceBounds(PW: number, half: Half) {
  return {
    left: (half === "right" ? EAR : half === "left" ? EAR : EAR) + PAD,
    right: PW - (half === "left" ? 0 : half === "right" ? EAR : EAR) - PAD,
  };
}

function frontFurniture(device: PanelDevice, units: number, PW: number, half: Half): string {
  PW = PW || W;
  var h = units * U;
  var b = faceBounds(PW, half);
  var labelW = isBlankFace(device.category) ? 0 : (half ? LABEL_W * 0.62 : LABEL_W);
  var x0 = b.left + labelW;
  var x1 = b.right, mid = h / 2;
  // A unit with connectors on the front gives them the right-hand half; the
  // furniture takes what is left rather than being drawn underneath them.
  if (device.ports.some(function (p: PortSpec) { return p.face === "front"; })) {
    x1 = x0 + (x1 - x0) * 0.46;
  }
  var cat = device.category;
  var g = "";

  function display(x: number, y: number, w: number, dh: number): string {
    return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + dh +
      '" rx="6" fill="var(--pf-lcd)" stroke="var(--pf-edge)" stroke-width="3"/>' +
      '<rect x="' + (x + 8) + '" y="' + (y + 8) + '" width="' + (w - 16) + '" height="' + (dh * 0.3) +
      '" fill="var(--pf-lcd-ink)" opacity=".35"/>';
  }
  function knob(cx: number, cy: number, r: number): string {
    return '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="var(--pf-knob)" stroke="var(--pf-edge)" stroke-width="3"/>' +
      '<path d="M' + cx + " " + cy + "L" + cx + " " + (cy - r * 0.72) + '" stroke="var(--pf-silk)" stroke-width="' + r * 0.16 + '"/>';
  }
  function led(cx: number, cy: number, r: number, colour: string): string {
    return '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + colour + '"/>';
  }

  if (/IEM Transmitter|Receiver|Wireless|Spectrum Manager|System Processor/.test(cat)) {
    var dw = (x1 - x0) * 0.34;
    g += display(x0 + 60, mid - h * 0.26, dw, h * 0.52);
    g += knob(x0 + 60 + dw + 110, mid, Math.min(46, h * 0.19));
    g += knob(x0 + 60 + dw + 230, mid, Math.min(46, h * 0.19));
    for (var i = 0; i < 4; i++) g += led(x1 - 90 - i * 46, mid, 11, i < 2 ? "var(--pf-led-on)" : "var(--pf-led-off)");
    g += led(x0 + 26, mid, 12, "var(--pf-led-on)");
  } else if (/Audio Interface|Dante Converter|MADI Converter|Stage Box|Mic Preamp/.test(cat)) {
    var cols = 12, cw = (x1 - x0 - 200) / cols;
    for (var c = 0; c < cols; c++) {
      for (var r2 = 0; r2 < 4; r2++) {
        var on = r2 > 1 - (c % 3 === 0 ? 1 : 0);
        g += led(x0 + 150 + cw * (c + 0.5), mid - h * 0.16 + r2 * (h * 0.105), 8,
          on ? "var(--pf-led-dim)" : "var(--pf-led-on)");
      }
    }
    g += display(x1 - 210, mid - h * 0.2, 170, h * 0.4);
  } else if (/Playback Switcher|FX Processor|Word Clock/.test(cat)) {
    for (var bt = 0; bt < 4; bt++) {
      g += '<rect x="' + (x0 + 80 + bt * 150) + '" y="' + (mid - h * 0.16) + '" width="108" height="' +
        h * 0.32 + '" rx="7" fill="var(--pf-btn)" stroke="var(--pf-edge)" stroke-width="3"/>';
      g += led(x0 + 134 + bt * 150, mid - h * 0.26, 10, bt === 0 ? "var(--pf-led-on)" : "var(--pf-led-off)");
    }
    g += display(x1 - 320, mid - h * 0.18, 280, h * 0.36);
  } else if (/Power Conditioner|Sequencer|Power Distro|UPS/.test(cat)) {
    g += '<rect x="' + (x0 + 40) + '" y="' + (mid - h * 0.16) + '" width="70" height="' + h * 0.32 +
      '" rx="6" fill="var(--pf-btn)" stroke="var(--pf-edge)" stroke-width="3"/>';
    g += display(x1 - 260, mid - h * 0.17, 220, h * 0.34);
    for (var v = 0; v < 3; v++) g += led(x0 + 190 + v * 52, mid, 13, v === 0 ? "var(--pf-led-on)" : "var(--pf-led-off)");
  } else if (/Rack Fan/.test(cat)) {
    var fans = 4, fw = (x1 - x0) / fans;
    for (var f = 0; f < fans; f++) {
      var fx = x0 + fw * (f + 0.5), fr = Math.min(fw * 0.36, h * 0.36);
      g += '<circle cx="' + fx + '" cy="' + mid + '" r="' + fr + '" fill="var(--pf-hole)" stroke="var(--pf-edge)" stroke-width="4"/>';
      for (var bl = 0; bl < 5; bl++) {
        var a2 = (Math.PI * 2 * bl) / 5;
        g += '<path d="M' + fx + " " + mid + "L" + (fx + Math.cos(a2) * fr * 0.8) + " " +
          (mid + Math.sin(a2) * fr * 0.8) + '" stroke="var(--pf-knob)" stroke-width="7"/>';
      }
    }
  } else if (/Vent Panel/.test(cat)) {
    var vc = 26, vr = Math.max(2, Math.floor(units * 3));
    for (var vx = 0; vx < vc; vx++) {
      for (var vy = 0; vy < vr; vy++) {
        g += '<circle cx="' + (x0 + ((x1 - x0) / vc) * (vx + 0.5)) + '" cy="' +
          (PAD * 0.7 + ((h - PAD * 1.4) / vr) * (vy + 0.5)) + '" r="9" fill="var(--pf-hole)"/>';
      }
    }
  } else if (/Rack Shelf|Rack Drawer/.test(cat)) {
    g += '<rect x="' + x0 + '" y="' + (mid - h * 0.08) + '" width="' + (x1 - x0) + '" height="' +
      h * 0.16 + '" rx="5" fill="var(--pf-hole)" opacity=".5"/>';
  } else if (/Network Switch|Router|WiFi/.test(cat)) {
    for (var p2 = 0; p2 < 12; p2++) {
      g += led(x0 + 150 + p2 * 54, mid, 9, p2 % 4 === 0 ? "var(--pf-led-on)" : "var(--pf-led-off)");
    }
  }
  return g;
}

// -------------------------------------------------------------- the face
export function draw(
  device: PanelDevice,
  face: "front" | "rear",
  units: number,
  opts?: { half?: "left" | "right" | null },
): string {
  opts = opts || {};
  var half = opts.half === "left" || opts.half === "right" ? opts.half : null;
  // Half-rack panels are drawn at half width with a single outer ear — the
  // inner edges butt together through the jointing plate, which is how the
  // mounting kit actually puts two of them in one U.
  var PW = half ? W / 2 : W;
  var ears = half
    ? [half === "left" ? 0 : PW - EAR]
    : [0, PW - EAR];
  var h = units * U;
  var parts: string[] = [];

  parts.push('<rect x="0" y="0" width="' + PW + '" height="' + h + '" fill="var(--pf-face)"/>');
  ears.forEach(function (ex: number) {
    parts.push('<rect x="' + ex + '" y="0" width="' + EAR + '" height="' + h + '" fill="var(--pf-ear)"/>');
    for (var u = 0; u < units; u++) {
      parts.push('<rect x="' + (ex + EAR * 0.32) + '" y="' + (u * U + U * 0.22) + '" width="' + EAR * 0.36 +
        '" height="26" rx="13" fill="var(--pf-hole)"/>');
      parts.push('<rect x="' + (ex + EAR * 0.32) + '" y="' + (u * U + U * 0.66) + '" width="' + EAR * 0.36 +
        '" height="26" rx="13" fill="var(--pf-hole)"/>');
    }
  });
  ears.forEach(function (ex: number) {
    var lx = ex === 0 ? EAR : ex;
    parts.push('<line x1="' + lx + '" y1="0" x2="' + lx + '" y2="' + h +
      '" stroke="var(--pf-edge)" stroke-width="3"/>');
  });

  if (face === "front") {
    parts.push(frontFurniture(device, units, PW, half));
    parts.push(drawFace(device, "front", units, PW, half));
    if (!isBlankFace(device.category)) {
      parts.push('<text x="' + textLeft(PW, half) + '" y="' + (units > 1 ? U * 0.44 : h * 0.44) +
        '" class="silk-brand">' + esc(trim(device.brand.toUpperCase(), half ? 9 : 13)) + "</text>");
      parts.push('<text x="' + textLeft(PW, half) + '" y="' + (units > 1 ? U * 0.82 : h * 0.82) +
        '" class="silk-model">' + esc(trim(device.model, half ? 12 : 18)) + "</text>");
    }
  } else {
    parts.push(drawFace(device, "rear", units, PW, half));
    parts.push('<text x="' + (PW - (half === "right" ? EAR : 0) - PAD) + '" y="' + (h - 12) +
      '" class="silk-model" text-anchor="end" opacity=".55">' +
      esc(trim(device.brand + " " + device.model, half ? 18 : 40)) + "</text>");
  }

  parts.push('<rect x="0" y="0" width="' + PW + '" height="' + h +
    '" fill="none" stroke="var(--pf-edge)" stroke-width="4"/>');

  return '<svg class="panel" viewBox="0 0 ' + PW + " " + h +
    '" preserveAspectRatio="xMidYMid meet" role="img" aria-label="' +
    esc(device.brand + " " + device.model + " " + face + " panel") + '">' +
    parts.join("") + "</svg>";
}

