# Frameless async axis and the two structural defects

## What the owner asked for

"Prepare for next line of work." Chosen through intake: **the product defects, carried
through to landing S8** — not the emitter-capability successor, and not the stale
`markless-storage` board.

## What must become true

Three measured wrong behaviours are repaired, and the async repair is **pinned by a corpus
scenario rather than by unit tests**:

1. **`DEFECTS.md` 12.2 — react post-await staleness.** Two clicks produce one increment,
   plus a dropped pre-await write. **REACT-ONLY** — measured by T001 and confirmed by T002's
   live six-lane probe. ~~Four of six emitters are broken, two of them silently; Angular's
   emitter contained `async` zero times~~ — **both figures were FALSE and are struck.**
   `toConstSsa` appears 4× in the react emitter and **0×** in all five others, `DEFECTS.md`
   says *"React alone reads a value fixed at handler-creation time"*, and the "four of six"
   figure **inverted** T043's headline *"emits **correctly** in four of six lanes"*. Angular
   carries an `isAsync` flag and emits the modifier today.
   **This was a FIFTH site.** T001 corrected `oracle.signal`, `final_proof`, T999's reject
   condition and `intake` — and reported "all four sites corrected". The charter was missed,
   and the final audit caught it. A refuted figure left in the editable charter is exactly
   the transmission path that put it into this board in the first place. This has never been on any board.
2. **`generated/S7` fails identically in react and solid at the same site** — react
   `TS2345`, solid `TS2769`, both on a cell initialised `null` and later set to `"on"`. Two
   independent emitters producing the same unsound shape points at **the IR or the
   scenario**, not at either emitter. Found by T020 of the emitter-capability phase.
3. **`generated-persistence/P1` reports `TS7017`** on the `globalThis.__FRAMELESS_STATE__`
   read that the persistence design depends on.

**All three are invisible to `pnpm e2e` today**, which passes S7 in all six lanes.

## The oracle

Three parts, all required.

1. **DEFECT REPAIR.** `DEFECTS.md` 12.2 is CLOSED on a **witnessed before-and-after
   behavioural measurement per lane** — a recorded RED before the repair and a GREEN after,
   not a green suite. S7's cause is **named** (IR, scenario, or lane) before anything is
   repaired, and P1's `TS7017` is closed or ruled.
2. **S8 LANDS AND PINS THE REPAIR.** The corpus goes to **nine scenarios in all six lanes**,
   the mutation budget to **54 cells with every one RED and every one restored**, and
   `pnpm e2e` reports **6 demos x 9 scenarios, all observations equal**.
3. **NOTHING REGRESSES.** `pnpm test` stays at its baseline plus only tests this goal adds;
   `pnpm check` **does not rise** above its inherited 267; `pnpm lint` and
   `pnpm check:citations` stay clean.

**Completion proof**: 12.2 closed on a per-lane witnessed before/after, S8 in the corpus at
9 scenarios / 54 red mutants, and `pnpm e2e` green at 6x9.

## Verify inventory, and what this goal does NOT own

- **Gate suites for this goal**: `pnpm test`, `pnpm e2e`, `pnpm lint`, `pnpm check:citations`,
  `pnpm mutate:corpus`.
- **PRE-EXISTING RED, inherited, NOT this goal's to fix**: `pnpm check` is at **267** and was
  exit 0 before the emitter-capability phase. Its successor owns driving it to zero. **This
  goal's obligation is only that it does not RISE.**
- **PRE-EXISTING FOREIGN FAILURE**: `pnpm test` is 1235 passed / **1 failed** —
  `package-inventory` ARM B, caused by the owner's uncommitted `pnpm-lock.yaml`. Foreign.
  It must stay at exactly 1.

## Non-negotiable constraints

- **Never test a framework outside its design envelope**, or read that output as a defect.
  Qwik refused effects on measurement in the prior phase and that refusal stands; if a lane
  cannot express async inside its envelope, **record it as a lane limit**.
- **Do not file anything upstream.** The owner is on the Qwik core team; outward-facing
  publication under their name is outside the autonomy grant.
- **The owner's three uncommitted paths** — `pnpm-lock.yaml`, `pnpm-workspace.yaml`,
  `website/` — are in-flight work. **Fingerprint them at the start and end of every task**
  and never modify them. `pnpm mutate:corpus` restores with `git checkout` over its surface,
  so it may only run on a quiescent tree.

## Likely misfire

**Repairing the async axis and declaring it done on a green unit suite.** 12.2's whole
history is that four of six emitters were broken and **two of them silently** — a green
suite is exactly what hid it. That is why S8 is inside this tranche rather than after it:
the scenario is what makes the repair falsifiable.

The second misfire is **repairing S7 in the emitters**. It fails identically in two
independent lanes, which is evidence the fault is upstream of both. **Diagnose before
repairing**, and if the cause is the IR or the scenario, say so and fix it there.

## Instrument warnings inherited from the prior phase, all measured

- **`pnpm e2e` type-checks nothing** — it runs each demo's `copy-emitted` then the witness
  against the **dev server**.
- **A lane's own checker can be blind** — a Vue lowering passed `compileDiagnostics`
  exact-empty in all four modes and `vue-tsc` then rejected it.
- **A lane's own checker can also over-fire** — Vue's `compileDiagnostics` demanded
  `scriptSetup` unconditionally and rejected the first template-only SFC the repo emitted.
- **Regeneration has three tiers, and four of them are wired to nothing.** Six
  `regenerate.ts`; six `regenerate-composition.ts` **files** but only **react and solid**
  expose a `regenerate:composition` npm script — qwik, svelte, vue and angular fail with
  `ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL` (T003, PM-confirmed all six). **Running "the six"
  through pnpm silently skips four tiers and then reads a vacuous empty diff.** Invoke those
  four directly with `node --experimental-strip-types`. Plus
  and `generated-persistence/P1` which has **no script at all** (written only by
  `UPDATE_GOLDENS=1` inside react/solid `test/emitter.test.ts`). A `generated*/` diff passes
  **vacuously** if nothing regenerates.
- **"The project reports 0" is not evidence of coverage.** Prove membership by planting an
  error and observing it reported. Use `TS2304`, not `TS2322` — `TS2322`'s message does not
  name the offending identifier.
- **Solid's `validateEnrichedIr` early-returns** into `validateCompositionIr` when
  `hasComposition(ir)` holds, which is true the moment `behaviors`, `elementHandleBindings`
  or `handleCalls` is non-empty. Checks placed after that return are unreachable for any IR
  carrying those records.

## Tranche

Diagnose the two structural defects and name their causes; repair the async axis across the
lanes that can express it, recording a lane limit for any that cannot; then land S8 as the
corpus scenario that pins the repair behaviourally — and stop.
