import { writeFileSync } from "node:fs";
import { draw } from "@/lib/rack/panels";
import { isHalfWidth } from "@/lib/rack/geometry";
import { SEED_DEVICES } from "@/lib/seed-data";

const rows = SEED_DEVICES.map((d) => {
  const half = isHalfWidth(d) ? ("left" as const) : null;
  const ru = Math.max(1, Math.ceil(d.rackUnits));
  const src = d.panel?.front ? `layout · ${d.panel.front.elements.length} elements` : "category fallback";
  return `<section>
    <h2>${d.brand} ${d.model} <em>${d.category} · ${d.formFactor} · ${src}</em></h2>
    <div class="pair">
      <figure><figcaption>front</figcaption>${draw(d, "front", ru, { half })}</figure>
      <figure><figcaption>rear</figcaption>${draw(d, "rear", ru, { half })}</figure>
    </div>
  </section>`;
}).join("\n");

writeFileSync("/tmp/claude-0/contact.html", `<!doctype html><meta charset=utf8><style>
:root{--pf-face:#FFF;--pf-ear:#F4F7F9;--pf-edge:#14181C;--pf-hole:#E7ECF0;--pf-pin:#4A545D;
--pf-silk:#14181C;--pf-knob:#C3CCD4;--pf-btn:#EDF1F4;--pf-lcd:#E7ECF0;--pf-lcd-ink:#4A545D;
--pf-led-on:#4A545D;--pf-led-dim:#C3CCD4;--pf-led-off:#E7ECF0;
--dir-in:#1F5FA8;--dir-out:#B4491C;--dir-bi:#14785A}
body{font:13px -apple-system,Helvetica,sans-serif;background:#fff;margin:18px;color:#14181C}
section{margin-bottom:16px;border-bottom:1px solid #E4E9ED;padding-bottom:12px}
h2{font-size:13px;margin:0 0 6px}
h2 em{font-style:normal;color:#7C8792;font-weight:400;font-size:11px}
.pair{display:grid;grid-template-columns:1fr 1fr;gap:16px}
figcaption{font:10px monospace;color:#7C8792;letter-spacing:.1em;text-transform:uppercase;margin-bottom:3px}
figure{margin:0}
svg.panel{width:100%;height:auto;display:block}
svg.panel text{font-family:monospace;fill:var(--pf-silk)}
svg.panel .silk-brand{font-size:44px;font-weight:600;letter-spacing:3px}
svg.panel .silk-model{font-size:34px;opacity:.72}
svg.panel .silk-sm{font-size:26px;opacity:.7}
</style>${rows}`);
console.log("ok");
