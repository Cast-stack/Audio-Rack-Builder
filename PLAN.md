# Where this is, and what is left

Last updated after the planner was made the only planner. 56 assertions green,
`npm run sheet:check` clean on ten sheets, `npm run planner:check` clean on
five case profiles x six presets, `npm run typecheck` clean for the first time.

This file is the honest state of the project. It is kept in the repo rather
than in a chat log so that anything opening the folder — you, VS Code, an
assistant working in it — reads the same version.

---

## The planner question is settled

There used to be two of these, and only one had any features. `/planner` now
serves `planner/template.html`, built into `public/planner.html` with the whole
engine inlined and rewritten onto that URL in `next.config.ts`. The React
scaffold — `RackPlanner.tsx`, `BudgetRail.tsx` — is deleted; it is in history
at `8133eb9` if the port ever wants it.

That was option 2 of the three this file used to list, taken in the order it
recommended: ship, then port. What it costs, still true and still deferred:

- **No server-side rendering on that page.** It is a client-rendered tool; the
  marketing pages around it are not. Fine until the planner needs to be
  indexed for anything but its title.
- **No per-user saved racks on that page.** State is `localStorage` under
  `arb.planner.v3`, one browser. This is the thing accounts will actually
  collide with, and the point at which option 1 — porting the interaction
  layer into React, roughly a week — has to be reconsidered. The drawing code
  is framework-free already (`panels.ts`, `elevation.ts` and `cables.ts`
  return strings), so a port is the interaction layer and nothing else.

Do not restart a second planner. If the React port happens, it replaces this
one on the same URL; it does not sit beside it.

---

## What works today

Engine — `src/lib/rack`, pure, tested, no database, no network:

- **Real depth.** Chassis + deepest mated rear connector + cable bend. Four
  devices in the seeded catalog pass a naive depth comparison and are
  physically impossible; the README has the arithmetic.
- **Power.** Per-circuit load against the NEC 80% continuous derate, plus
  worst-case inrush — the biggest unit's surge with everything else already
  steady. Catches the rack that runs fine and trips at power-up.
- **Weight and balance.** Gross weight, vertical centre of gravity, and for a
  multi-bay case the lateral imbalance that tips a wide case on a ramp.
- **Heat.** Watts per rack unit against what a closed case sheds by convection.
- **Placement.** Half-rack pairs sharing a U, multi-bay occupancy, collisions,
  overflow, open halves.
- **Rear rails.** Patch bays, splitters and strips mount facing the back of
  the case, sharing a U with whatever faces forwards. The check that earns the
  feature is depth: front unit plus rear unit, nose to nose, against what the
  case has between the rails. A case with no rear rails refuses them outright.
- **The patch.** A connector wired twice, two outputs facing each other, a run
  that needs an adapter nobody packed.

Drawing and export:

- **Device panels drawn from the manufacturer's own callout list.** Sixteen
  devices; fifteen have a researched front layout, four also have a rear one.
  Element order comes from the manual, sizing is ours, and every layout carries
  the callout numbers it came from.
- **The patch sheet.** Cover with findings, front and rear elevations, device
  schedule, connection schedule, cable schedule, circuit schedule, depth ledger,
  and a sources appendix quoting every figure verbatim. This is the thing being
  sold.
- **`npm run sheet:check`** renders every rack and every case profile and fails
  on overlapping text or a section that overflows its page.
- **`npm run planner:check`** boots the built planner in a browser and drives
  it through every case profile and every preset, front and rear, failing on a
  console error or a panel that comes back empty. It also walks the catalog
  under both groupings and asserts every device is reachable under each. The
  planner's interaction code is the one part of the product `npm test` cannot
  see.

Catalog:

- **Twenty-three devices**, browsed by family or by brand. `Family` in `catalog.ts`
  puts all 56 categories on twelve shelves; the planner shows the ones with
  gear on them and names the ones without, so the taxonomy's reach is visible
  rather than implied.
- **Power is the first family filled on purpose**: three Furman Merit
  conditioners and a Tripp Lite 2U UPS, covering Power Conditioner and UPS.
  Power Distro and Sequencer are still empty — see note 9.

Asking for gear that is not in the catalog:

- **`/api/gear/request`** takes a name plus links to a product page or a
  manual PDF, researches the device against them, and returns it marked
  provisional. Anthropic's `web_fetch` reads PDFs natively, so a link to a
  manual needs no parsing on our side.
- **Supplied links are vetted** (`src/lib/gear/sources.ts`): schemes, private
  addresses and the cloud metadata address are refused, the list is capped, and
  every host is marked manufacturer or not. One off-allowlist source and the
  job loses its auto-publish for good.
- **It never publishes**, and it works with or without Postgres. With a
  database the result is filed as a revision for review; without one it lives
  in that browser, badged unverified in the catalog, called out in the findings
  when placed, and printed with a NOT REVIEWED line on the patch sheet.
- **In the planner only when served.** The action is hidden on the file://
  hand-out copy, which can never reach an endpoint.

**Feedback, from the planner to you.** A link in the planner footer, open to
everyone — no account, no captcha, no required email, because the message worth
the most ("the depth on that unit is 30 mm short") comes from someone standing
in a loading dock who will never sign up. `src/lib/feedback.ts` holds the rules
and nothing else; `/api/feedback` stores it and `/admin/feedback` reads it
behind `ARB_ADMIN_TOKEN`.

- **What is kept**: the message, the rack that was on screen, and a reply
  address only if they chose to leave one. **No IP.** It would be the only
  personal data in the app, it would need a privacy policy to explain, and it
  would not make a single message more useful.
- **What stands in for a login**: a hidden honeypot field that is accepted and
  dropped silently, six messages an hour per address, and length caps. A bot
  told it was caught learns which field to leave alone next time.
- **It never claims to have sent.** If there is no database, or the write
  fails, it says so and leaves the text in the box. Someone who thinks they
  have reported a wrong depth will not report it twice.
- Hidden on the file:// hand-out copy, like the add-a-device panel: a Send
  button with nowhere to send is worse than no button.

Research pipeline — `src/lib/gear`, written and typechecked, **never run
end to end**. It needs `ANTHROPIC_API_KEY`. Treat it as unproven until the
twenty-device baseline in the README has been done.

---

## Not built yet

In the order the launch plan put them.

| | Why it blocks selling |
|---|---|
| Accounts and saved racks | There is nowhere to keep a rack. Everything is in `localStorage` on one browser. |
| Stripe — subscription primary, perpetual as an option | Three prices: monthly, annual, perpetual-plus-one-year-of-updates. The perpetual one needs an `updatesUntil` date on the licence, checked at download. |
| Metering on gear lookup | `/api/gear/request` has a crude per-process, per-IP cap of 10/hour — a floor, not the real thing. It resets on redeploy and does not hold across instances. Real metering needs accounts. |
| Export escape hatch | If people are paying for their data, they have to be able to take it out. JSON of the rack plus the PDF. |
| Landing and pricing page | `src/app/page.tsx` and `how-it-works` exist and are scaffold-grade. |
| Catalog backfill | 176 devices across 41 brands, up from 23. Four of the twelve families are still empty: Monitoring, Comms, Lighting, Video. About 115 of the 275 rack-relevant names on the industry list are covered; the rest are mostly gear that turned out not to be rack-mountable or publishes no usable specs. |
| Weight for passive panels | Neutrik's two patch panels, Heritage Audio's HA-73 and Rupert Neve's Portico II were all dropped for one reason: no published unit weight. Depth was made optional for the same reason and made safe by a warning; weight could follow, but erring light on weight is the opposite direction from erring deep on depth. |
| Provenance by path, not just host | The Whirlwind DA-2's manual lives on Webflow's shared CDN, linked from whirlwindusa.com. The rule matches on domain, so it cannot say "this file is linked from the maker's own page", and the device is out. |
| Rack power as a supply | A conditioner or distro is what other gear plugs into, and the engine does not model that. Circuits are still `{label, volts, amps}` on the rack. See note 7. |
| Legal pages | Terms, privacy. Required before taking money. |
| Mobile pass | Untested below tablet width. A patch sheet gets read on a phone at load-in. |

---

## Things that are known to be wrong or unverified

Stated plainly because they are easy to forget and expensive to discover.

1. **Connector projection and bend allowance are estimates.** They are the
   tables the whole depth claim rests on, and nobody has measured them.
   `CONNECTOR_PROJECTION_MM` and `BEND_ALLOWANCE_MM` in `geometry.ts`. The
   patch sheet says so in print, but a footnote is not a fix. **Measure a real
   XLR, a real DB25 and a real powerCON behind a panel before charging anyone.**
2. **The case profiles are generic.** Usable depth varies more than a model
   number suggests, and every depth check turns on it.
3. ~~**`prisma generate` has never run.**~~ It runs now, and the six files
   that touch Prisma typecheck. It found two real bugs on the way, both fixed:
   `Placement` had a unique index on a `slot` column that did not exist and no
   `bay` column at all, so a two-bay rack or a half-rack pair could not survive
   a round trip through the database; and `toRackSpec` dropped `bay` even once
   the column was there. Same disease as the `anchorKey` bugs in `CLAUDE.md` —
   a key one dimension short, two physical cells collapsing into one.

   **Still unproven: nothing has been written to a real Postgres.** The schema
   change needs a `prisma db push` and a seed against a live database before
   anyone trusts it. `npx prisma generate` is now part of `npm run build`.
4. **The PDF route drives a local Chromium.** On Vercel there is none. Swap to
   `@sparticuz/chromium` with `puppeteer-core`; only the launch differs, and it
   is isolated in `resolveChromium()` in `pdf.ts`, which now also finds Chrome
   and Edge on Windows and macOS. `sheet:check` could not run outside its
   original Linux sandbox until it started using that same function.
5. **The Sennheiser SR 300 IEM G3 has no rear layout** and the Shure SLX4's
   layout is read off figures rather than a callout list, at 0.55 confidence.
   Both say so in `unresolved`, and the sheet prints it.
6. **Cable length is never computed.** It is a blank column on purpose — the
   drawing does not know how the loom is dressed, and a guess is worse than a
   pen.
7. **A power conditioner is modelled as a load, not as a supply.** The Furman
   M-8x2 occupies its U, carries its weight and depth, and has nine outlets in
   its port list — but nothing plugs into those outlets in the engine's eyes.
   Devices still draw from the rack's abstract circuits. Its own draw is null,
   because Furman prints no consumption figure and the 15 A on the datasheet
   is what it *passes*; entering that as a draw would add a phantom 1800 W to
   every rack it sits in. The planner says "1 unit missing a figure" and calls
   the totals a floor, which is honest but is not the same as modelling the
   chain.
8. **The research pipeline is still unproven.** There is no `.env` in the
   working tree, so every device added recently was researched by hand from
   manufacturer documents. That does not validate the pipeline; it only shows
   what the pipeline has to produce.
9. **Two allowlisted manufacturers could not be sourced at all.** SurgeX's
   store refuses the TLS handshake and their product pages 404; Middle
   Atlantic's technical-document URLs now redirect to a generic Legrand AV
   landing page. Both are in `MANUFACTURER_DOMAINS`. Worth knowing before the
   pipeline is pointed at the whole allowlist and quietly returns nothing for
   them, and it is why Power Distro and Sequencer are still empty.
10. **The Tripp Lite UPS publishes a minimum rack depth the engine ignores.**
    Its chassis is 342 mm and Tripp Lite separately require a 17 in / 432 mm
    rack — 90 mm more than the box. `requiredDepth()` derives its own figure
    from chassis plus connector plus bend and never reads a published
    clearance, because until now nothing in the catalog printed one. If more
    do, the manufacturer's number should win over the estimate. Recorded in
    that device's `unresolved` in the meantime.
11. **Nobody has ever run the researcher.** `/api/gear/request` is built,
    typechecked and driven end to end in `planner:check` against a stubbed
    endpoint — the request, the badge, the findings warning, persistence across
    a reload and removal are all covered. What is NOT covered is the one call
    that costs money: `researchDevice` against the real API. Its prompt, its
    tool budget and its repair round have never met a live model. **Run it
    against a device you already own and check every figure by hand before
    letting anyone else near it.**
12. **The M-8Dx's power figure is known to understate.** 8 W covers its two
    lamps; the voltmeter that distinguishes it from the M-8Lx draws too and
    Furman do not say how much. Confidence is set to 0.55 to say so. It is the
    only figure in the catalog recorded as a floor rather than a ceiling.

---

## Decisions already made

Recorded so they do not get relitigated by accident.

- **Positioning:** cited specs, broader than IEM and playback, free where the
  competition charges.
- **Pricing:** subscription primary, perpetual offered as an option with one
  year of updates.
- **Stack:** Next.js App Router, Postgres, Prisma, Vercel.
- **Panel images:** drawn from manuals, not scraped. Manufacturer photos are
  their copyright and this is a product being sold.
- **Colour:** direction on connectors uses three validated slots; cables use
  five, chosen by a search over 575,757 combinations against the
  colour-blindness validator. Every cable class also carries a dash pattern,
  because the sheet gets photocopied.
- **Provenance:** automated jobs never edit a device in place. They write a
  revision; a person promotes it.

---

## If you are picking this up cold

```bash
npm install                 # npm.cmd install in PowerShell
npx prisma generate
npm test                    # 56 assertions, no network
npm run dev                 # then open /planner
```

The planner is the fastest way to see what the app actually does; `npm run
planner:build` alone gives you the same page as a file you can open directly.
`npm run sheet:demo -- monitor out.pdf` gives you the document it produces.
