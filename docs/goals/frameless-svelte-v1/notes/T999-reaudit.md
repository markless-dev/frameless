# T999 — re-audit of the Svelte lane (2026-07-27)

Judge, read-only. This is the RE-AUDIT that follows T011. Every claim below was
checked against the tree, not inherited from a receipt. `pnpm e2e` and
`pnpm test:browser` were NOT run — two other Judges were live on this tree and a
concurrent witness run risks contaminated measurement; the PM's serial six-row
run is the standing evidence, corroborated by the Angular board's own T004
receipt (`'Three-way: 6 demos x 3 scenarios, all observations equal'`, 18
observation strings read side by side).

## Verdict

**COMPLETE. full_outcome_complete: true.**

## 1. The oracle

`scripts/e2e.mjs:33-50` lists six `officialDemos` rows including
`{ framework: 'svelte', activation: 'hydrate', demos/svelte-official }`.
`:461-490` stringifies each lane's whole `observed` array against the reference
lane per scenario and `process.exit(1)`s on any divergence. Equality is
**asserted**, not printed. `readThreeWayResults` (`:88-126`) additionally throws
unless the box ran, passed, wrote per-scenario observations, and reported the
activation kind the row declares — an empty or missing receipt cannot read as a
pass.

`demos/svelte-official` is a stock SvelteKit app: `src/routes/+layout.svelte`,
`+page.svelte`, `s2/`, `s3/`, `src/lib/emitted/{RenderOnce,KeyedTodo,EventForm}.svelte`,
committed (22 tracked files). `packages/frameworks/svelte/generated/{S1,S2,S3}.svelte`
exist with a byte-equality freshness test.

## 2. The three-part widening test, applied to Option D

The superseded byte-equality proxy was not used.

**(1) UNIFORM.** `assertS3` (`three-way-contract.ts:814-868`) is one function
serving all six lanes; the `text` read is a single `measureServedAttribute({
served, marker: 'data-action="text"', name: 'value', equals: 'hello' })` call
with no lane branch anywhere in the path. PASS.

**(2) UNIFORM TRADE, LOST CLASS ENUMERATED PER LANE, RE-OPEN TRIGGER NAMING IT.**
`three-way-contract.ts:731-772` carries the four-lane table (react REWRITES at
hydration; solid not written at hydration; svelte removed by
`remove_input_defaults`; qwik never written), states the trade in those words
("gains, in all four lanes, the class 'markup the server never sent'; it loses,
in one lane, the class 'S3's `text` seeded wrong at hydration, React only'"), and
ends with the trigger, which names the lost class explicitly: "*a state-seeding
hydration bug is suspected in any lane* — that last trigger IS the lost class
named above". Two-sided negative control: `measureServedAttribute:345-382` runs
**two** negative arms on **every call in every lane** — payload-wide deletion and
a scoped deletion from the marked element's own start tag — each preceded by a
vacuity guard that throws if the mutation did not actually change the payload.
PASS.

**(3) STILL INSIDE THE EQUALITY SET AND STILL EXACT.** The reading is pushed into
`observed` (`:832-835`) as `server-rendered text = ${servedText} with writes = …`,
and `observed` is exactly what `e2e.mjs:464-466` compares. `servedText` is
returned only after an exact `found !== equals` throw. PASS.

## 3. The boundary I was told to police

Per-lane declared values exist in exactly two places and both sit OUTSIDE the
compared array:

- `servedClientEntry` (`:103-109`), a total `Readonly<Record<HydrateFramework, string>>`
  — omission is a compile error, no `??`, no optional field. React and Solid keep
  `/src/entry-client.jsx` byte-unchanged.
- `expectedNavigations` (`:150-157`), total over the closed `Activation` union;
  consumed at `runScenario:967` and `:984` as an `expect.page.outcome` argument
  and as `evidence`, never pushed to `observed`.

`runScenario:938-1007` pushes exactly two further strings — the document-request
count and `no console errors and no failed requests` — neither per-lane. The
Svelte box's own dev-diagnostic string goes into `evidence`, not `observed`
(`demos/svelte-official/scenarios.box.ts:99-108`). **No option-C dodge.** The
neutrality negatives are unchanged and identical for every hydrate lane:
`forbidInServedPayload(served, ['q:container', ACTIVATION_MARKER])` at `:465`.

## 4. The correction chain — spot-checked, both links

I did not inherit T011. Both causal claims were read out of the shipped sources
in this tree:

- `demos/react-official/node_modules/react-dom/cjs/react-dom-client.development.js`
  (19.2.3, verified from its own package.json):
  `isHydrating || value === element.value || (element.value = value);` followed on
  the very next line by an unguarded `element.defaultValue = value;`. The property
  write is skipped while hydrating; the `defaultValue` write is not, and
  `.defaultValue` on an input reflects the `value` **content attribute**. React
  rewrites it. CONFIRMED.
- `demos/solid-official/node_modules/solid-js/web/dist/web.js` (1.8.22):
  `function setProperty(node,name,value){ if (isHydrating(node)) return; … }` and
  `function setAttribute(node,name,value){ if (isHydrating(node)) return; … }`.
  Both early-return. Solid does not write at hydration. CONFIRMED.

So the third correction reverses the earlier two in the right direction, and the
reversal is explicable from source rather than resting on the browser run alone.
I did not re-run the Chromium probes (command restriction); the source agreement
is what upgrades this from "asserted" to "corroborated". T011's own two-sided
control — a real post-activation edit moving Solid's attribute to `typed99` —
is what keeps DEFECTS.md finding 5 standing, and that distinction ("signal-tracked"
≠ "written at hydration") is the actual content of the correction.

## 5. The two PM board repairs — both correct

**T004 reverted to `blocked`: CORRECT.** Its own receipt records `pnpm e2e` at
`status: fail`. A `done` Worker receipt listing a failing verify command is the
exact shape this board spent three tasks refusing from an instrument; flipping it
green would have hidden a truthful failure and added nothing, because the lane's
success is carried by T007's receipt where `pnpm e2e` is actually green. The
objective is discharged and mapped, not lost.

**The duplicate-key repair: CORRECT, and I verified it independently.** Parsing
`git show HEAD:docs/goals/frameless-svelte-v1/state.yaml` with `yaml@2.9.0` under
`uniqueKeys: true` throws **two** `Map keys must be unique` errors, at the second
`stop_if` (line 459) and the second `constraints` (line 463). The current
working-tree file parses with **0 errors and 0 warnings**, and T004 now carries 9
`stop_if` entries and 5 `constraints`. The eight T002-derived stop conditions —
including the guessed-literal and the "any module script" prohibitions — are live
text again.

One small correction to the repair note, recorded rather than escalated: it says
"the stub's only non-duplicated entry — the dev-warning constraint — was folded
in". The stub also carried a stop_if, *"The official scaffold needs modification
beyond wiring in emitted components"*, which was not transcribed verbatim. It is
substantively covered by the surviving `OFFICIAL SCAFFOLD, AS IT SHIPS`
constraint plus the dev-warning constraint's "the ONLY permitted scaffold
addition beyond wiring emitted components". No rule was lost in substance; the
claim is a minor overstatement on a historical blocked card.

## 6. The named rejection grounds, one by one

- **Served-payload read without a two-sided negative control** — not the case;
  two arms plus two vacuity guards, on every call. `calibrateServedClientEntry`
  (`:183-210`) does the same for the entry literal and is called by the Svelte box
  on every scenario.
- **Carried-forward loss unrecorded** — recorded at `three-way-contract.ts:722-772`
  in the executable file's own doc comment, in `notes/T006-value-attribute-ruling.md`,
  and on T006/T007's receipts, with the re-open trigger naming the class. The
  latent `checked` twin is recorded in both places too.
- **IR-4 with no explicit ruling** — ruled DEFERRED at T002 ruling 3, with the
  reason (no forcing case; a general facility designed against zero forcing cases
  is folklore), the falsifiable re-open trigger, and the consequence for Vue and
  Angular stated and *propagated*: both sibling boards carry
  "INHERITED RULING, do NOT re-litigate". T005 then ran the version corollary
  live for the first time and it **resolved to NO**, and T008 converted the
  deferral's load-bearing precondition into a standing check.
- **Dev-only warnings observed and dismissed** — not observed, and not vacuous.
  Two independent enforcement points: `packages/frameworks/svelte/test/setup.ts`
  fails on ANY captured `console.warn`/`error` with no allowlist and a three-way
  calibration; and `demos/svelte-official/src/hooks.client.ts` installs a
  self-calibrating sink whose `calibrated` status the box asserts before it
  believes a count of zero (`scenarios.box.ts:33-60`). A missing attribute throws
  rather than reading clean.
- **Any activation-neutrality check weakened** — no. The two negatives are
  untouched and uniform; the entry literal was parameterised at a total Record,
  not relaxed; navigations are declared per lane and asserted exactly, never
  "any number".

## 7. T005 grounds

- **Baseline form inventory** — `packages/frameworks/svelte/src/gate/index.ts:489-554`,
  15 entries, every floor `unverified` **with a specific reason** (the resolved
  package ships no CHANGELOG and an absent `@since` tag is not a floor); the
  `verified` arm is kept alive by a test that re-reads every citation and is
  calibrated with a real needle, a false needle and a missing file. It goes red:
  `test/gate.test.ts:354-500`, six mutation rows through the throwing
  `mutate`/`mutateAll`, plus an anti-vacuity pin on `collectEmittedForms()` so an
  allowlist whose walk observes nothing cannot accept everything.
- **Lint-arbiter gap** — carried in writing at T005, then CLOSED at T009, not
  silently: `src/gate/index.ts:3-4` now imports `ESLint` and `eslint-plugin-svelte`.
  The gap's own finding (emitted `<!-- eslint-disable -->` could silence the
  arbiter judging it) was measured and the rule omitted as a deliberate
  strengthening, pinned by a two-vehicle test.
- **Worked example 6** — `docs/emitter-idiom-policy.md:368-442`, REWRITTEN not
  amended, all six outcomes present (G1 FAIL, G2 PASS, G3 PASS, G4 PASS-by-refusal
  with `UNKNOWN` recorded for the rule as previously written, G5 FAIL, G6 PASS/FAIL
  split), and it names which gate decides (G5).
- **Decision-site comment** — present at `src/emitter/index.ts:379`,
  "DECISION SITE - docs/emitter-idiom-policy.md, worked example 6", immediately
  above `syncPolicyGuard()`.

## 8. Carried forward, non-blocking

Recorded so a later board does not rediscover them as findings:

1. No inventory floor is `verified`, and none can be without network access. The
   verified arm is calibrated, not exercised.
2. `svelte-check` does not catch a wrong-**typed** prop passed from a route,
   because emitted output carries no prop types. Closable only by an emitter that
   emits types. The T002 ruling-6 re-open trigger already covers the neighbouring
   case.
3. `demos/svelte-official/tsconfig.json` sets `checkJs: false`, calibrated
   two-sided so unknown and missing route props still go red.
4. `modes: ['dev']` — the vite build + adapter path is never exercised. Repo-wide,
   named in the charter, not this board's to close.
5. The board's `checks:` block still reads `dirty_fingerprint: unknown` and
   `last_verification: { result: unknown, task: null, commands: [] }`. The PM
   should record the six-row verification there. This is a bookkeeping gap, not an
   evidence gap: the commands are on T007/T008/T010/T011 and the six-row run is
   receipted on the Angular board.

## 9. What I would have rejected on, and did not find

A per-lane value inside `observed`; an optional `served` or a `??` fallback; a
`contains` check that a string anywhere in the payload would satisfy; a sink whose
zero could mean "nothing was watching"; a six-gate entry amended rather than
rewritten; a lost class named without a trigger. None present.
