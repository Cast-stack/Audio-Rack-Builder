# Working in this repo

Context for anyone — human or assistant — picking up work here. Read `PLAN.md`
for what is built and what is left; this file is about how to change it without
breaking the things that make it worth anything.

## What this app claims, and why that constrains the code

It tells someone a rack will fail before they buy the case, and it shows the
source for every number it used. Both halves are load-bearing:

- A figure with no provenance is worth less than no figure. If you add a spec,
  add the row that says where it came from and quote it verbatim.
- If the app derives something rather than reading it, the derivation is
  printed. `derivation` on a provenance row is not a comment field.
- Confidence is honest. 0.55 means 0.55. The sheet prints it as a pill and the
  reader is entitled to distrust it.

## Invariants

**The engine never imports Prisma.** `src/lib/rack/*` runs in tests, in a
worker, in the browser bundle and in the PDF renderer. The only seam is
`src/lib/db/mappers.ts`. Breaking this breaks the standalone planner silently.

**One key shape for a connector.** `anchorKey(deviceId, bay, position, slot,
port, index)` in `cables.ts`. Three separate bugs have come from a key missing
a dimension — first `slot`, then `bay` — where two different physical sockets
collapsed into one. If a fourth dimension ever appears, it goes in that
function and nowhere else.

**The drawing and the schedule are computed from the same source.** Cable tags
come from `cableTags()`, used by both the elevation and the table. A tag on the
drawing that is not in the schedule sends someone chasing a cable that does not
exist.

**Never edit a device in place.** Automated jobs write a `DeviceRevision`; a
person promotes it. The diff is the review.

**Erring deep is safe, erring shallow strands a build.** Where a dimension is
ambiguous — and Sennheiser's unlabelled `202 x 212 x 43` is the live example —
take the larger figure as depth and say why in the derivation.

## Style

- Comments explain *why*, and especially why an obvious alternative is wrong.
  There are several in here that exist because someone has to know not to
  "simplify" the thing back into a bug.
- Prose in the UI and on the sheet is the language a rack tech uses, not the
  language a spec sheet uses. "Runs off the top of the case", not
  "placement exceeds container bounds".
- No em-dash-free rule, no house voice to imitate — just write it plainly.

## Before you commit

```bash
npm test              # 56 assertions. Fast, no network.
npm run typecheck     # needs `npx prisma generate` first
npm run sheet:check   # layout: overlapping text, sections overflowing a page
npm run planner:check # boot the built planner and drive it
```

The last two are not in `npm test` because they drive a browser. Both find
things the unit tests structurally cannot:

- `sheet:check` — the unit tests check what the document *says*, not where it
  *lands*, and a legend printing through a table is perfectly valid HTML.
- `planner:check` — the planner's interaction code lives in an HTML template
  that `npm test` never loads. A typo in it takes the product down and all 56
  assertions stay green.

Both resolve their browser through `resolveChromium()` in `src/lib/export/pdf.ts`,
which is also what the PDF export uses. Add a path there, not in a script.

## One planner

`planner/template.html` is the planner. It builds to two identical files —
`planner/planner.html` to hand out, `public/planner.html` for Next to serve at
`/planner` through the rewrite in `next.config.ts` — from one bundle, so they
cannot drift.

The React scaffold that used to own that route is gone (`RackPlanner.tsx` and
`BudgetRail.tsx`, last alive at `8133eb9`). It had none of the features and
the two interfaces had started to disagree. `PLAN.md` records why, and what a
real React port would take if accounts ever need that page server-rendered.

Links to `/planner` are plain `<a>`, never `next/link`: it is outside the
router, and a client-side navigation would fetch an RSC payload that is not
there and then hard-navigate anyway.

## The catalog is browsed, not scrolled

`Family` in `src/lib/gear/catalog.ts` is the shelf a person walks to; `Domain`
is what the research pipeline reasons about. They are not the same cut and
should not be merged — Dante converters browse next to network switches and
research as AUDIO.

**A new category needs a family.** `CategoryDef.family` is required, so the
compiler will tell you. Pick the shelf someone would look on, not the one the
domain implies.

The planner browses two levels: shelf, then gear, with a Type/Brand toggle at
the top and a filter that cuts through both. `npm run planner:check` asserts
that **every device is reachable under both groupings** — a device that lands
on no shelf is a device nobody finds, and it would otherwise fail silently.

## Adding gear

Every figure needs a manufacturer source quoted verbatim. Two rules that have
already bitten:

- **Never enter a throughput rating as a draw.** The Furman M-8x2 passes 15 A
  and Furman prints no consumption figure at all. Entering the 15 A as
  `powerMaxW` would put a phantom 1800 W on every circuit budget. Power stays
  null and `unresolved` says why.
- **Prefer the metric figure where a sheet prints both.** RF Venue's DISTRO4
  is `45(H) mm / 2(H) in`. 45 mm is 1U; the inch column is a rounding, and
  reading it as two rack units wastes a U on every DISTRO4 in every rack.

Do not copy specs out of another planner's catalog. A competitor's listing is
not a manufacturer source, and it can be wrong — the Gator "GRW-DRAWER2U" one
of them lists is not a part Gator sells. The real model is GRW-DRW2.

## Gear the user asks for

`/api/gear/request` takes a name and a list of links and hands back a
researched device. Three rules hold it in place, and none of them are
negotiable:

- **It never publishes.** Not on a clean triage, not from a manufacturer PDF.
  A device reaches the shared catalog when a person promotes a revision. This
  is the same rule as "never edit a device in place" and it is the reason the
  provenance story is worth anything.
- **A user's link is a strong lead and a weak citation.** `vetSources()` marks
  every supplied URL as manufacturer or not. One off-allowlist source and
  `researchDevice` downgrades `auto-publish` to `review` — it can only ever
  hold a job back, never wave one through. `triage()` reads the record and
  cannot see where the reading came from, which is why this lives in the
  researcher rather than in the validator.
- **Provisional gear is marked everywhere it appears.** Palette badge,
  findings warning when it is placed, and a "NOT REVIEWED" line at the top of
  its `unresolved` on the printed sheet. `printPatchSheet` merges provisional
  provenance into the sources appendix for exactly this reason: a sheet that
  lists a device with an empty appendix looks like a device nobody had to
  check.

`toProvisionalDevice()` fills the fields a researcher cannot read — `passive`,
`inrushFactor`, `depthIsOverall`, `panel`. Every one is an assumption and every
one is recorded in `unresolved`. **`depthIsOverall` is always true**: erring
shallow strands a build, which is the same rule as the Sennheiser note above.

## Colour

Categorical colour in this app is validated, not chosen. The five cable
classes came out of a search over 575,757 combinations scored by the
colour-blindness validator; the three direction slots were validated the same
way. **If you add a category, re-run the validator** — do not eyeball it, and
do not add a sixth cable colour without checking what it does to the other
five. Every cable class also carries a dash pattern so the sheet survives a
monochrome photocopy.

## Things that are deliberately missing

Do not "fix" these without talking to Jose first:

- **Cable length is not computed.** The drawing does not know how the loom is
  dressed. The column is blank on purpose.
- **Power is not required to publish a device.** Most manufacturers print amps,
  not watts. The rule is "at least one cited power figure".
- **Incompatible connectors are a warning, not a block.** Adapters exist. The
  planner lets you draw one and the checker tells you that you did.
