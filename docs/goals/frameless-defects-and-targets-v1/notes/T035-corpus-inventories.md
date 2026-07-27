# T035 — the eleven inventories are derived, the six verdicts are in, and there were THIRTEEN files, not eleven

Worker, 2026-07-27. Board: `docs/goals/frameless-defects-and-targets-v1/state.yaml`.
Tree at `8e5f8f3`, carrying T034's uncommitted S4 registration.
Spec: T034 receipt and `notes/T034-s4-registration.md`.

## 0. Headline

**ALL SIX LANES ACCEPT S4. Every gate, every framework compiler, every
type-checker, every third-party arbiter — zero violations, zero diagnostics,
zero warnings, zero upstream messages.** The six verdicts are in §2, each in the
instrument's own words. Nothing was weakened to get them; the widening was
mechanical and the acceptance was measured.

**BUT T034's eleven was an UNDERCOUNT. There are thirteen files of this class,
and the two it could not see are the interesting ones.**

- **#12 `packages/frameworks/vue/test/emitted-smoke.browser.test.ts:105`** —
  fails identically to the eleven, and is **outside `allowed_files`**. It was
  invisible to T034 because `pnpm test:browser` is
  `test:react && test:solid && test:svelte && test:vue`: the Svelte failure
  aborted the chain before the Vue lane ever ran. **`pnpm test:browser` reports
  the FIRST failing lane, not all of them.** This is the blocker.
- **#13 `packages/frameworks/angular/test/parse-emitted.test.ts:54,74,173`** —
  **PASSES**, and covers three files out of four. Its test name is `GREEN SIDE:
  every emitted template parses with an exactly empty error set`. It says
  *every*; it means S1, S2, S3. Also outside `allowed_files`.

#13 is strictly worse than the twelve red ones and is the finding this card
should be remembered for. A literal that goes red when the corpus grows is a
nuisance. A literal that stays **green** while its own name promises whole-corpus
coverage is a green vacuum, and this one sits on the arbiter Angular's own T002
ruling 4 designated **PRIMARY** — the doc comment above it says it "interrogates
this board's central risk directly: did FORCED LOWERING produce a template
Angular's own parser accepts?". S4 is the first nested-repeat template this repo
has ever emitted. It is precisely the template that arbiter exists for, and the
arbiter has never been shown it.

I measured it out-of-band anyway (§2.6). It is clean. But a passing probe is not
a standing test.

## 1. What changed, and why DERIVED rather than re-literalled

All eleven inventories now derive the scenario corpus from the compiler's
ratified goldens — `packages/compiler/test/goldens/s<n>-*.json` — instead of
naming `S1/S2/S3`. S5..S8 will join every lane's gate with **no edit to any of
these files**.

The derivation source is deliberately NOT the directory being asserted:

| side | source | what it means |
| --- | --- | --- |
| expected | `test/goldens/s<n>-*.json` | the IR this repo agreed to compile |
| actual | `discoverGeneratedFiles()` over `generated/` | what the emitter actually wrote |

Two independent readings, so the comparison is a real cross-check rather than a
restatement of itself. It is two-sidedly fail-closed: a scenario the emitter
stopped writing is red, and a stray extra file in `generated/` is red.

The one way a derived list could be **greener** than the literal it replaced is
the degenerate case — an empty derivation agreeing with an empty directory. Every
derivation therefore **throws** on an empty result rather than returning `[]`,
and every lane also carries an explicit S1..S4 **floor** (`arrayContaining`, a
lower bound, so growth is free and shrinkage is red).

### 1.1 The instrument was watched failing

Per the discipline line, a derived inventory nobody has watched go red is not an
instrument. Six new `CALIBRATION: the derived inventory goes red on a missing and
on an extra file` tests (one per gate lane) drive **both** directions through the
SAME `discoverGeneratedFiles()` the real assertion calls, against a throwaway
root: write `n-1` files → red; write the last → green; add `S99` → red.

### 1.2 Where the count was widened, so was what is checked

The two `emitted-typecheck` lanes failed with `expected 12 to be 11` — a count.
Bumping `11` to `12` would have been the green vacuum this board has rejected
twice: a count cannot tell "S4 was emitted" from "a fifth composition module
appeared and a scenario went missing". Those two tests now assert:

1. the **SET** of emitted files, derived from two independent sources — the
   goldens for scenarios, `test/composition-fixtures/*.tsrx` for the composition
   modules — so a missing, extra or renamed file is red;
2. that **tsc's own program** resolved exactly that set, read back off
   `program.getSourceFiles()`. `files` being right is not the same fact as the
   compiler having taken all of them.

Three more sites were widened from `S1/S2/S3` to the derived corpus, because they
enumerate the corpus in tests whose names say "the shipped corpus":

- `svelte` / `vue` / `angular` gate — `GREEN SIDE: the shipped corpus draws no
  message from any applied rule` (the three third-party ESLint arbiters);
- `vue` gate — `MEASURED: the excluded tiers report exactly the recorded rule ids`;
- `angular` gate — `ANTI-VACUITY: the shipped corpus is accepted, newlines
  between elements and all`.

The `svelte`/`vue` `compile-emitted` lanes had a **second** literal — the
`test.each` row list — which is why a widened inventory alone would have left
them discovering S4 and never compiling it. Both are now derived. They must be
derived **synchronously** (`readdirSync`), because `test.each` needs its rows at
collection time while `discoverGeneratedFiles()` only resolves in `beforeAll`;
the `covers exactly…` test asserts the two readings agree.

The svelte browser lane cannot use `node:fs` at all, so its derivation is a
second `import.meta.glob` over the goldens with `eager: false` — only the keys
are needed, and Vite resolves those at build time without fetching a golden.

### 1.3 What was deliberately NOT derived

The per-scenario **mutation rows** in the svelte/vue/angular gates keep their
`s1`/`s2`/`s3` bindings. They are per-scenario by design: each cites a construct
only one scenario ships (`v-for="row in group.rows"`, `$state(untrack(...))`,
`>increment</button>`). A whole-corpus loop there would be a category error. The
whole-corpus rows now iterate a derived `emittedSources` map; the named bindings
are read out of that same map, so there is one read of disk, not two.

## 2. THE SIX VERDICTS, in each instrument's own words

Every one of these was **unreachable** before this card: the inventory assertion
was the first statement in each test, so the run aborted before the gate ran.

### 2.1 React — `checkGeneratedFiles()` over four files

`React dossier gate > discovers, parses, and accepts every checked-in generated
component` — **PASS**. `result.violations` is `[]`; `result.files` equals the
derived corpus, so the gate checked four and not three. `generated/S4.jsx` draws
no message from any of the React gate policies, nor from
`eslint:react/*`, `eslint:react-hooks/*` or the base `eslint:recommended` tier
that gate applies. `result.unevaluated` is unchanged at the same three
artifact-requiring policies.

### 2.2 Solid — `checkGeneratedFiles()` over four files

`Solid dossier gate > discovers and accepts every checked-in generated component`
— **PASS**, `violations: []`, `result.files` equals the derived corpus. Every
emitted file still carries `@generated by @frameless/solid`, S4 included.

### 2.3 Qwik — `checkGeneratedFiles()` over four files

`Qwik v2 dossier gate > discovers and accepts the clean emitted scenario corpus`
— **PASS**, `violations: []`. This is the lane carrying `eslint-plugin-qwik` and
the frameless-owned `frameless/no-handler-sync-action` policy from defect 1.
Neither fires on S4. `result.unevaluated` is unchanged at exactly
`[{ policy: 'persistence-render-lowering', reason: 'requires-artifact' }]`.

### 2.4 Svelte — the gate, `svelte/compiler`, and `eslint-plugin-svelte`

Three separate instruments, three verdicts, all clean:

- `Svelte dossier gate > discovers and accepts the clean emitted scenario corpus`
  — **PASS**, `violations: []`.
- `generated/S4.svelte compiles with an EXACT EMPTY warning set in every mode` —
  **PASS**. That is `svelte/compiler`'s own `compile()` at the resolved 5.56.x, in
  **all four** modes (`client`/`server` × `dev`/`prod`), producing an empty
  warning-code set and non-empty JS in each. A nested keyed `{#each}` inside an
  `{#each}` draws nothing, `svelte/require-each-key` included.
- `third-party arbiter: eslint-plugin-svelte (T009) > GREEN SIDE` — **PASS** over
  the derived corpus: S4 draws zero messages from all 34 applied rules.
- Browser lane: `import.meta.glob(..., { eager: true })` compiles every match
  through the real Svelte plugin at import time, so `S4.svelte` was compiled by a
  real Chromium build and the precondition now asserts the derived set.
  13/13 green.

### 2.5 Vue — the gate, `@vue/compiler-sfc`, and `eslint-plugin-vue`

- `Vue dossier gate > discovers and accepts the clean emitted scenario corpus` —
  **PASS**, `violations: []`.
- `generated/S4.vue compiles with an EXACT EMPTY diagnostic set in every mode` —
  **PASS**. `@vue/compiler-sfc` at the resolved 3.5.x across all four
  `COMPILE_MODES`, including the `ssr` mode that selects `@vue/compiler-ssr`, a
  different code generator. Both the `errors` and the `tips` channel are empty —
  the tips channel is the one that carries `validateHtmlNesting`, so a nested
  `<ul>`/`<li>` shape had a live way to complain and did not.
- `third-party arbiter: eslint-plugin-vue > GREEN SIDE` — **PASS** over the
  derived corpus: zero messages from all applied rules, `vue/require-v-for-key`
  included, on a template with two nested `v-for`s.
- `MEASURED: the excluded tiers report exactly the recorded rule ids` — **PASS**
  with S4 added to the linted set. The excluded tiers fire **exactly** the
  already-recorded rule ids; S4 adds no new one. Worth stating plainly: this was
  the one widening that could have forced an edit outside `allowed_files`
  (`firesOnCorpus` lives in `src/gate/index.ts`). It did not.

### 2.6 Angular — the gate, `@angular-eslint`, and `@angular/compiler`

- `Angular dossier gate > discovers and accepts the clean emitted scenario
  corpus` — **PASS**, `violations: []`.
- `third-party arbiter: @angular-eslint > GREEN SIDE` — **PASS** over the derived
  corpus: zero messages from all 17 applied rules.
- `MUTATION: whitespace-stable-text (M1) > ANTI-VACUITY` — **PASS** over the
  derived corpus. S4's template layout does not trip the policy that guards
  Angular's `preserveWhitespaces: false` default.
- **`@angular/compiler` `parseTemplate` — MEASURED OUT-OF-BAND, NOT A STANDING
  TEST.** `parse-emitted.test.ts` is file #13 and is outside `allowed_files`, so
  its `['S1','S2','S3']` list could not be widened here. Using that file's own
  `inlineTemplate()` extractor verbatim and its own `templateDiagnostics()`:

  ```
  S1: template  300 bytes -> 0 diagnostics []
  S2: template  970 bytes -> 0 diagnostics []
  S3: template  830 bytes -> 0 diagnostics []
  S4: template 1077 bytes -> 0 diagnostics []
  ```

  Angular's own parser accepts the nested `@for`-inside-`@for` template with an
  exactly empty error set. **This reading is a probe, not a test. Until #13 is
  widened, nothing in CI re-checks it.**

## 3. What each verdict does and does not license

All six are **acceptance**, not correctness. The gates say the emitted source
obeys the policies this repo wrote and the rules the six framework teams wrote.
T034's six-lane behavioural equality says the six agree at runtime. They are
different instruments answering different questions, and S4 now has both.

What no lane has: a **size budget**. `react/test/size.test.ts` and
`solid/test/size.test.ts` record `physicalLoc`/`structuralNodes` for S1/S2/S3
only. S4 has no recorded budget in any lane. Both files are outside
`allowed_files`; flagged, not fixed.

## 4. THE BLOCKER

`packages/frameworks/vue/test/emitted-smoke.browser.test.ts:105` — outside
`allowed_files`, and `pnpm test:browser` cannot go green without it. Verbatim:

```
FAIL |vue-browser (chromium)| test/emitted-smoke.browser.test.ts >
  preconditions > discovers exactly the three emitted scenario components
AssertionError: expected [ '../generated/S1.vue', …(3) ] to deeply equal
  [ '../generated/S1.vue', …(2) ]
  [ "../generated/S1.vue", "../generated/S2.vue", "../generated/S3.vue",
+   "../generated/S4.vue",
  ]
```

The repair is the same one applied to the Svelte twin: replace the literal with
a golden-derived `import.meta.glob`, plus the S1..S4 floor.

**The Vue browser lane's verdict on S4 is already partly in, and it is clean.**
That file's glob is `eager: true`, so `@vitejs/plugin-vue` compiled
`generated/S4.vue` in a real Chromium build at module-import time; the module
graph loaded and 17 of the file's 18 tests passed. A compile failure would have
taken down the whole file, not one assertion.

Recommended follow-up scope: files #12 and #13, plus the two `size.test.ts`
budgets, plus the `emitter.test.ts` `fixtures` tables in all six lanes (which
also stop at `s3-*.json`, so no standing test asserts S4's emitted bytes equal
`formatEmitted(emit(golden))` — T034 proved that by re-running `regenerate` and
diffing, but nothing re-proves it on every run).

## 5. Verification, and the two commands that could not run

| command | result |
| --- | --- |
| `pnpm test` | **PASS** — 50 files, 887 tests (was 879; +8 calibration/derivation rows) |
| `pnpm check` | **PASS** |
| `pnpm lint` | **PASS** — 0 warnings, 0 errors, 341 files, 93 rules |
| `pnpm e2e` | **PASS** — `6 demos x 4 scenarios, all observations equal`, unchanged |
| `pnpm test:browser` | **FAIL** — react 60/60, solid 49/49, svelte 13/13, **vue 17/18** (file #12) |
| `pnpm mutate:corpus --scenario s4` | **COULD NOT RUN** |
| `pnpm mutate:corpus --scenario s1 s2 s3` | **COULD NOT RUN** |

### 5.1 The mutation harness, and a correction to the card

The card anticipated the dirty-surface refusal and instructed: "run the two
`--dry-run` arms (which spawn no servers and need no clean surface)". **That
premise is wrong on this tree.** `assertCleanSurface()` is called from `main()`
at `scripts/corpus-mutation.mjs:719`, *before* the dry-run branch is reached, so
`--dry-run` is refused exactly like a full run:

```
Error: The mutation surface is dirty before the first mutation, so no verdict
this harness issues would be attributable to its own mutant, and restoring would
discard uncommitted work. Commit or stash first:
?? packages/frameworks/react/generated/S4.jsx
… (12 paths)
```

No arm of the harness can execute against this uncommitted tree. History was not
rewritten and no temporary commit was created.

**Nothing this card did could have degraded either mutation result.** The entire
diff is under `packages/frameworks/*/test/`, and `MUTATION_SURFACE`
(`corpus-mutation.mjs:88`) is the six `generated/` directories and the six demo
`emitted/` directories — **disjoint from every file T035 touched**. T034's
`6/6 RED` and `18/18 RED` therefore still stand as the applicable measurement.
The PM should re-run both after committing.

### 5.2 The emitted/golden/compiler diff check

The card's literal `git diff --exit-code -- …/generated …/compiler` reports a
diff, but it is **T034's**, not T035's: HEAD is `8e5f8f3`, which predates T034's
landed-but-uncommitted work. The check that answers the question T035 was asked:

```
$ git status --porcelain -- packages/frameworks/*/generated
?? packages/frameworks/{react,solid,qwik}/generated/S4.jsx
?? packages/frameworks/svelte/generated/S4.svelte
?? packages/frameworks/vue/generated/S4.vue
?? packages/frameworks/angular/generated/S4.ts

$ git status --porcelain -- packages/compiler
 M packages/compiler/test/enriched-ir.test.ts        # T034's
?? packages/compiler/test/goldens/s4-nested-list.json # T034's
```

**Not one tracked emitted file is modified. No golden moved. No compiler source
moved.** T035's surface is eleven test files and this note, and nothing else.

## 6. Reproducing every claim

```
pnpm test        # 887/887, and every lane's gate now REACHES S4
pnpm check && pnpm lint
pnpm e2e         # 6 demos x 4 scenarios, all observations equal
pnpm test:browser  # red at file #12 only; the first three lanes are green

# the Angular parseTemplate probe of §2.6, using parse-emitted.test.ts's own
# inlineTemplate() and templateDiagnostics() against generated/S{1..4}.ts

# watch a derived inventory go red on purpose:
rm packages/frameworks/react/generated/S4.jsx && pnpm test   # red
git checkout -- . # (S4.jsx is untracked on this tree - regenerate instead)
```
