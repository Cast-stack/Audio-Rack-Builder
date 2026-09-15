# Audio Rack Builder

A planner for live-production racks that tells you the build will fail.

Every rack planner draws a rack and totals up power, weight and depth. This one
runs the checks those totals hide: whether a unit physically goes in once its
connectors are mated, whether a circuit survives power-up as well as steady
state, whether the loaded case wants to go over on a ramp. And every spec it
uses links to the line of the datasheet it came from.

---

## The two things that make it different

### 1. Real depth, not chassis depth

Manufacturers publish the chassis. What has to fit is the chassis, plus the
mated connector behind it, plus room for the cable to turn. From the seeded
catalog, in a 305 mm shallow case:

```
Radial SW8    152 mm chassis + 70 mm DB25 + 90 mm bend = 312 mm   short by  7 mm
MOTU 24Ao     229 mm chassis + 70 mm DB25 + 90 mm bend = 389 mm   short by 84 mm
Shure ADTQ    240 mm chassis + 55 mm XLR  + 60 mm bend = 355 mm   short by 50 mm
Shure AD600   286 mm chassis + 50 mm RJ45 + 60 mm bend = 396 mm   short by 91 mm
```

Every one of those passes a naive `depthMm < usableDepthMm` comparison. All four
are physically impossible. `src/lib/rack/geometry.ts` holds the connector
projection and bend allowance tables.

### 2. Specs that show their work

A device's numbers are stored as an immutable revision plus one `FieldProvenance`
row per field, each with the verbatim quote it came from and an honest
confidence. The Shure AD600 seeds with **no typical wattage at all**, because
Shure publishes none — only "Current Drain 1.2 A" — and a derived 144 W ceiling
at 0.6 confidence, flagged as derived. A catalog that cannot say that is a
catalog you cannot check.

Automated jobs never edit a device in place. They write a revision; a person
promotes it. The diff is the review UI.

---

## Running it

```bash
npm install
cp .env.example .env          # set DATABASE_URL, and ANTHROPIC_API_KEY for research
npx prisma db push
npx tsx prisma/seed.ts
npm run dev
```

`/planner` and `/` work against the seeded demo data with no database at all —
they import `src/lib/seed-data.ts` directly, so you can see the checker working
before wiring Postgres up.

```bash
npm test          # feasibility engine, 15 assertions, no network
npm run typecheck # requires `npx prisma generate` first
```

### Researching a device from the command line

```bash
ANTHROPIC_API_KEY=... npm run gear:research -- "Shure AD600"
ANTHROPIC_API_KEY=... npm run gear:research -- --price "Radial SW8"
```

Prints the record, the guardrail verdict and what the run cost. Run this on
twenty devices you already know before trusting it on any you do not — that is
the accuracy baseline, and it costs about six dollars to get.

---

## Layout

```
src/lib/rack/      the feasibility engine — pure, tested, no Prisma, no network
  types.ts         DeviceSpec / RackSpec / CheckResult
  geometry.ts      RU maths, connector projection, bend allowance, real depth
  budget.ts        space, weight, centre of gravity, per-circuit load, heat
  checks.ts        the rules that produce findings
  checks.test.ts   15 assertions covering each rule

src/lib/gear/      the research pipeline
  schema.ts        canonical device + provenance zod schema
  validate.ts      deterministic guardrails and triage — no model, no network
  research.ts      allowlisted search, server-side fetch (reads PDFs), forced
                   structured output, one repair round
  pricing.ts       separate, cheaper, its own cadence and its own table
  catalog.ts       the taxonomy and the manufacturer search allowlist
  persist.ts       revisions, provenance, publication

src/lib/db/        the only seam between Prisma and everything else
src/app/api/       research, lookup, search, rack check, review queue, crons
src/components/    planner canvas, budget rail, check panel, spec table
prisma/            schema and seed
```

The engine never imports Prisma. It runs in tests, in a worker, and in the
browser on every drag — which is why the planner's numbers are never stale.

---

## Guardrails

Deterministic checks that run after the researcher returns and before a human
sees anything. No API key, no network. These are the six mistakes a language
model actually makes on a spec sheet:

| Failure | Looks like | Caught by | Verdict |
|---|---|---|---|
| Inches read as mm | depth 9 mm | below 60 mm is not a rack device | error |
| Shipping weight | 42 lb in 1U | pounds-per-RU outside 0.4–30 | warning |
| PSU rating as draw | 150 W typ / 45 W max | typical exceeds maximum | error |
| Phantom consumption | passive splitter drawing 20 W | category is passive | warning |
| Undated price | $9,460, no date | price without verifiedAt | error |
| Uncited value | a depth with no quote | required field has no provenance | error |

Power is deliberately *not* a required-for-publish field. Requiring
`powerTypicalW` rejects correctly-researched records for manufacturers who print
amps and not watts — most of them. The rule is "at least one cited power figure".

---

## Before deploying

- **Pin the server tool versions.** `WEB_SEARCH_TOOL`, `WEB_FETCH_TOOL` and
  `WEB_FETCH_BETA` in `src/lib/gear/research.ts` are dated identifiers and do get
  retired. Check them against current tool-use docs.
- **Decide how strict `ports` is.** Dimensions come off a spec table and are
  nearly always right. Port enumeration comes off prose and rear-panel photos,
  and is where the confident errors will live. Consider mandatory review on that
  field alone for the first few hundred records.
- **Measure a real case.** The seeded cases are generic profiles. Usable depth
  varies by more than the model number suggests, and it is the number every
  depth check turns on.
- **Set `CRON_SECRET`** before exposing `/api/cron/*`.
