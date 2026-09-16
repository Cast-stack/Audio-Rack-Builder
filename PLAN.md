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
  console error or a panel that comes back empty. The planner's interaction
  code is the one part of the product `npm test` cannot see.

Research pipeline — `src/lib/gear`, written and typechecked, **never run
end to end**. It needs `ANTHROPIC_API_KEY` and a database. Treat it as
unproven until the twenty-device baseline in the README has been done.

---

## Not built yet

In the order the launch plan put them.

| | Why it blocks selling |
|---|---|
| Accounts and saved racks | There is nowhere to keep a rack. Everything is in `localStorage` on one browser. |
| Stripe — subscription primary, perpetual as an option | Three prices: monthly, annual, perpetual-plus-one-year-of-updates. The perpetual one needs an `updatesUntil` date on the licence, checked at download. |
| Metering on gear lookup | The live "device not found" lookup costs money per call. Unmetered, one user with a script is the whole margin. |
| Export escape hatch | If people are paying for their data, they have to be able to take it out. JSON of the rack plus the PDF. |
| Landing and pricing page | `src/app/page.tsx` and `how-it-works` exist and are scaffold-grade. |
| Catalog backfill | Sixteen devices is a demo. The pipeline exists to make it hundreds. |
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
