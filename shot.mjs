import { chromium } from "playwright-core";
import fs from "node:fs";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const p = await b.newPage({ viewport: { width: 1600, height: 1240 }, deviceScaleFactor: 2 });
await p.setContent(fs.readFileSync("/tmp/claude-0/pw.html", "utf8"), { waitUntil: "load" });
const secs = await p.$$("section.sheet");
for (let i = 0; i < secs.length; i++) await secs[i].screenshot({ path: `/tmp/claude-0/sheet-${i}.png` });
console.log(secs.length + " sections");
await b.close();
