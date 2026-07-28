# T999 — Vue lane audit

**Verdict: `not_complete`.** The oracle PASSES. One tranche clause is unmet.

> Transcribed by the PM from the T999 Judge's returned reasoning. The Judge declined to
> write this file itself, reading the read-only contract as excluding it even though its
> dispatch explicitly permitted this one path. Recorded verbatim in substance; the PM added
> only this header. See "A note on the read-only reading" at the end.

## Oracle — verified, not inherited

Re-derived mechanically at `41aaed0` rather than read off the receipts:

- `scripts/e2e.mjs:39` carries `{ framework: 'vue', activation: 'hydrate', directory: demos/vue-official }`; six rows total.
- Equality is **ASSERTED, not eyeballed**: `scripts/e2e.mjs:426-440` diffs every non-reference
  lane's `JSON.stringify(observed[scenario])` against react's and `process.exit(1)`s on any
  divergence.
- It is **not vacuously equal**. `readThreeWayResults` (now in `scripts/corpus-mutation.mjs`)
  throws if the box did not pass, if the reported `activation` differs from the declared one,
  or if any required scenario recorded no observations. `threeWayScenarios = ['s1','s2','s3','s4']`.
- **Nothing was weakened.** `git diff 5ca20c7..41aaed0 -- demos/react-official/three-way-contract.ts scripts/e2e.mjs`
  is additive: unions widened, `servedClientEntry` and `expectedNavigations` still total
  `Readonly<Record<…>>`, and the negatives (`neither q:container nor the activation marker`)
  are unchanged. The only deleted block is `readThreeWayResults`, which moved with its guards intact.
- **The emitted Vue source is genuinely activated in a browser.** `demos/vue-official/scenarios.box.ts`
  drives all four scenarios through the demo's own `createSsrHandler`, and `calibrateDevSink`
  plants a real mismatch (`kit:2` → `kit:999`) into the real S1 payload, requires a `warn:`-level
  `[Vue warn] … Hydration` capture, then asserts the DOM reads back `kit:2` — proving the page
  *looks* right after a real mismatch, which is what makes the console channel load-bearing.
  All four goldens are byte-identical to the demo's copied `src/emitted/*.vue` (hashed pairwise).

## Spot-checks — one per task, all held

- **T005, verified by re-measurement.** `@vue/compiler-core@3.5.40` `ondirname` reads
  `raw === "." || raw === ":" ? "bind" : raw === "@" ? "on" : raw === "#" ? "slot"`, with
  `modifiers: raw === "." ? [createSimpleExpression("prop")] : []`. Re-ran the equivalence
  against `generated/S3.vue` and a mechanical longhand twin: **byte-identical template codegen
  across all four `ssr × isProd` modes**, 0 parse errors / 0 template errors / 0 tips both ways,
  with a planted `:checked="!checked"` control that *does* differ. The structural Gate 4 claim is sound.
- **T006, both flagged deviations hold.** The `require-directive-shorthand` rename is honest naming
  and the id string is what the violation prints. Removing `v-bind`/`v-on` from
  `BASELINE_FORM_INVENTORY` **does** satisfy the "every form the emitter MAY emit" contract —
  the four goldens contain zero `v-bind:`/`v-on:`, zero `#`, zero `.prop`, zero modifiers. The
  longhand twin still draws **both** detectors, because `directiveForm()` reads `rawName` and
  surfaces a reverted longhand as the un-inventoried form `v-bind`. The gate-fooling defect is
  real and really fixed: `.checked="checked"` compiles with **0 errors and 0 tips**, so the
  frameless-owned `rawName` policy is the only thing separating it from `:`.
- **T007, jsdom adjudicated SUFFICIENT.** The G5 FAIL rests on the throw arm, whose premise is
  visible in the shipped output: `generated/S1.vue` emits `defineProps([...,'onTrace'])` and then
  `props.onTrace('setup', { runs: 1 })` — a declared prop and an unguarded direct call, so the
  TypeError-vs-silent-no-op delta is a property of the emitted text plus Vue's props/attrs
  partition, not of layout or event dispatch. **No Chromium re-take required**; the ruling
  direction is conservative. Record as an optional cheap re-take, not owed evidence.
- **T008, the fix had a witnessed prior failure.** `grep 'stops the listener receiving native'`
  at `41aaed0` returns nothing; the live message names the three measured grounds and explicitly
  *withdraws* the `$attrs` rationale; `gate.test.ts` pins the text, calibrated by temporarily
  restoring the old string. Severity unchanged.
- **IR-8 is carried forward, not quietly closed** — recorded in `demos/vue-official/tsconfig.app.json`,
  `notes/T004-vue-demo.md` §4, the emitter's `propsDeclaration` comment, the `no-typed-props`
  dossier ref, and cross-board at `frameless-defects-and-targets-v1/notes/T024-corpus-breadth.md:96`.

## Why not complete

The board's tranche has two clauses. The second — *"then run the ratified idiom policy on Vue's
flagship sugar now that Gate 1 and Gate 6 can resolve"* — is unmet. `state.yaml:117` defines
flagship sugar unambiguously as **`v-model` / `defineModel`**.

1. `docs/emitter-idiom-policy.md@41aaed0` carries worked examples 1, 2a, 2b, 3, 4, 5, 6, 7, 8, 9,
   10, 11, 11b — and **no entry for Vue `defineModel`/`v-model`**. It appears only as a passing
   illustration under Gate 2 at line 173.
2. T002's dissent recorded a specific prediction and assigned it: *"PREDICTS defineModel is DENIED
   at Gate 2, not deferred … a prediction for T005 to TEST, not a finding."* **T005 tested a
   different entry.** The prediction is undischarged and unwithdrawn.
3. This is not bookkeeping. `state.yaml:23-36`'s binding inherited text says **IR-4 may not be
   invoked as a blocker before G2–G5 have been scored against a real emitter.** For `defineModel`
   they never have been. The board is carrying "blocked by IR-1 and IR-4" as *inherited prose*
   about the exact question its own ruling says must be measured.
4. It has a shipped consequence of precisely the class this board caught three times.
   `packages/frameworks/vue/src/gate/index.ts` fires **one** `no-two-way-binding` message for
   *both* macros, and the `defineModel` half is justified partly by *"worked example 3 rules the
   defineEmits form DENIED at Gate 5…"* — an entry about a **different macro**. The `defineModel`
   limb has no ruling of its own to cite. **A correct rule resting on a borrowed reason, in a
   user-facing string** — which is exactly what T008 was dispatched to fix for the other limb.

Everything else about the lane is finished and proven. This is one bounded ruling plus its fold.

## Next task

**T009 (Judge, high):** rule Vue `defineModel`/`v-model` through all six gates against `vue@3.5.40`
as resolved, scoring **G2–G5 before IR-4 is allowed to appear**, and state explicitly whether IR-4
was ever the blocker or whether IR-1 + G2 decide it. Distinguish **FAIL** (populated domain, no
sound narrowing) from **UNKNOWN** (empty domain), per T007.

Its follow-on Worker fold is one slice: add the worked example, and **split the
`no-two-way-binding` message so the `defineModel` limb cites its own grounds**, pinned in
`gate.test.ts` and calibrated red against the current string.

## Re-verification the PM owes before closing

The oracle run above is on `41aaed0`, but S5 is landing across six lanes. At closure, `pnpm e2e`,
`pnpm test:browser` and `pnpm mutate:corpus` must be re-run on the then-current clean tree — a
five-scenario corpus changes the observation count, and the Vue row must be read against the react
row per scenario again.

## A note on the read-only reading

The Judge declined to write this file, treating any write as a breach of the read-only contract.
Its dispatch explicitly permitted this one path, and the three preceding Judges on sibling boards
wrote their notes under identical wording. The stricter reading is defensible and cost nothing here
beyond a transcription — recorded so the next dispatch can say "you MUST write your note to this
path" rather than "you MAY", which removes the ambiguity.
