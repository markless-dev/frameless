# Frameless real apps: Hacker News and TodoMVC in all six lanes

## What the owner asked for

> "Ok now let's do hacker news and todoMVC now for all the frameworks, let me know when
> done and how I can see the sites on each framework"

Two recognisable applications, authored **once** in `.tsrx`, emitted to **all six lanes**,
and **viewable** — twelve running sites the owner can open and click.

## Why this goal exists

Measured 2026-07-30: the corpus is **9 scenarios and 2 annotated fixtures**, composition is
compared across **2 lanes**, and **every `.tsrx` in the repository is a test fixture**.
Frameless has never emitted anything that was not designed to be tested.

Across the whole corpus and `composition-kit`: **zero** `fetch`, **zero** routing, **zero**
recursion.

The last three goals each found real faults — a `&&`-chained check script, 108 inert
`allowed_files` entries, a validator that could only run when it had nothing to check, a
mutation harness dead for 22 commits, four regeneration tiers wired to nothing. Every one is
a fault in the **apparatus**, not in the compiler. That is what happens when verification
grows faster than surface area. **This goal grows the surface.**

## The oracle

Three parts, all required.

1. **AUTHORED ONCE, EMITTED SIX WAYS.** Both apps have a single authored `.tsrx` source, and
   every lane's app is generated from it — no hand-written per-lane app code. Where a lane
   cannot express something, that is recorded as a **lane limit with its refusal message**,
   not worked around by hand-writing the lane.
2. **TWELVE VIEWABLE SITES.** Each app runs in each of the six lanes, launchable by a
   **documented command**, and `pnpm demo` lists them. The owner asked how to see the sites;
   an answer they cannot run is not an answer.
3. **NOTHING REGRESSES.** `pnpm test` at baseline plus only what this goal adds; `pnpm check`
   **does not rise** above its inherited **267**; `pnpm lint` and `pnpm check:citations`
   clean; `pnpm e2e` stays green at **6 × 9**.

**Completion proof**: both apps emitted from one source into six lanes, twelve sites the
owner can open, and a written per-lane launch table — with every refusal recorded rather
than hand-patched.

## Labeled assumptions — the PM made these, and they are reversible

1. **HN data is a PINNED LOCAL SNAPSHOT, not a live `fetch` to the HN API.** The oracle is
   six-lane agreement, and live data changes between lanes, which makes that comparison
   meaningless. A local endpoint still fully exercises the axis nobody has touched — a free
   global in a lifecycle that must survive SSR and resumption. **If the owner wants live
   data, this reverses and part 3 of the oracle weakens.**
2. **TodoMVC ships FIRST, Hacker News second.** TodoMVC's shapes are already proven by
   `s2-keyed-todo`, `s3-event-form` and `s7-form-controls`, so it de-risks the *pipeline* —
   kit → six lanes → viewable site. When HN then hits a refusal, you know it is the axis and
   not the plumbing.
3. **Browsable first; `pnpm e2e` wiring only once a lane is green.** Everything in `demos/`
   today is driven by `pnpm e2e`, so it is the gate surface, not a gallery. A probe designed
   to stop at the first refusal cannot also be a gate.

## Non-negotiable constraints

- **Never test a framework outside its design envelope**, or read that output as a defect. If
  Qwik cannot serialize a fetch-in-lifecycle the way it could not serialize a pending promise
  gate, **that is a lane limit, and it is recorded, not chased**.
- **Do not file anything upstream.**
- **The owner's three uncommitted paths** — `pnpm-lock.yaml`, `pnpm-workspace.yaml`,
  `website/` — are in-flight work. Fingerprint at start and end of every task; never modify.
  Method: `shasum -a 256` for files; for the tree,
  `find website -type f -exec shasum -a 256 {} \; | sort | shasum -a 256` — **sort the
  digests, not the paths**, and note that with no sort the value is not deterministic.
  Expected: `f326d314` / `aeb7edc1` / `f936e169`, 116 files all-in.

## Likely misfire

**Hand-writing the lanes.** Twelve viewable sites is a satisfying deliverable and the fastest
route to it is to write six React-ish apps by hand. That would produce exactly the demo the
owner asked for and prove **nothing**. The whole value is that one authored source produced
all twelve — so a lane that cannot be generated must be **left unbuilt and recorded**, not
filled in by hand.

The second misfire is **pushing through a refusal**. If HN's recursive comment thread is
refused, the refusal message is worth more than a working page; the corpus already proved
svelte and vue reject multi-component modules, and recursion asks a sharper version of the
same question.

## Instrument warnings inherited, all measured

- **`pnpm e2e` type-checks nothing** — it runs `copy-emitted` then a witness against the dev
  server.
- **A lane's own checker can be blind, and can also over-fire.** A Vue lowering passed
  `compileDiagnostics` exact-empty in all four modes and `vue-tsc` rejected it; separately
  `compileDiagnostics` demanded `scriptSetup` unconditionally and rejected the first
  template-only SFC the repo emitted.
- **Regeneration has three tiers and four scripts were wired to nothing** until recently.
  A `generated*/` diff passes **vacuously** if nothing regenerates — prove each tier ran.
- **`vue-tsc` and `svelte-check` are not installed**, so those lanes have no type instrument.
- **`pnpm check` is 267 and inherited.** Not this goal's to lower; only not to raise.

## Tranche

Ship TodoMVC across six lanes with viewable sites; then Hacker News front page; then the HN
item page. Stop at the first thing that cannot be authored, record it with its refusal
message, and continue with what remains. Deliver the launch table either way.
