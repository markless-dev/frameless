# T036 — the widening is finished, `pnpm test:browser` is green, and the arbiter that was lying now goes red on S4

Worker, 2026-07-27. Board: `docs/goals/frameless-defects-and-targets-v1/state.yaml`.
Tree at `8e5f8f3`, carrying T034's S4 registration and T035's eleven derived inventories.
Spec: T035 receipt and `notes/T035-corpus-inventories.md`.

## 0. Headline

**Every instrument in this card ACCEPTS S4, and every one of them was watched
rejecting it first.** Ten test files changed; nothing else moved. `pnpm test`
is 887 → 915, and `pnpm test:browser` — the command T035 could not clear — is
**fully green at react 60, solid 49, svelte 13, vue 18**.

The one finding worth the card's name is not an acceptance. It is that
`packages/frameworks/angular/test/parse-emitted.test.ts` — file #13, the PRIMARY
arbiter — **could not have failed on S4 at all**, and can now. §2 shows it doing
so.

## 1. What changed

| # | file | class | now |
| --- | --- | --- | --- |
| 12 | `vue/test/emitted-smoke.browser.test.ts` | red literal, blocked `test:browser` | derived from a second `import.meta.glob` over the goldens, + S1..S4 floor |
| 13 | `angular/test/parse-emitted.test.ts` | **green literal covering 3 of 4** | derived corpus map; both whole-corpus loops iterate it; precondition + calibration added |
| — | `react/test/size.test.ts`, `solid/test/size.test.ts` | budget by omission | derived corpus; a scenario with no recorded budget is now RED |
| — | six `*/test/emitter.test.ts` | fixture table stopped at `s3-*.json` | derived table; S4 byte-freshness is now a standing test in all six lanes |

All four groups derive the corpus from `packages/compiler/test/goldens/s<n>-*.json`
— T035's pattern, and deliberately **not** the `generated/` directory being
asserted. Two independent readings: the IR this repo agreed to compile, and what
the emitter actually wrote. Every derivation **throws** on an empty result rather
than returning `[]`, and every lane carries an S1..S4 floor (`arrayContaining`,
a lower bound, so S5..S8 widen it with no edit).

## 2. FILE #13 — THE INSTRUMENT THAT COULD NOT FAIL, MADE ABLE TO

T035 probed `parseTemplate` out-of-band and S4 came back clean. That reading is
now a standing test, and before trusting its green I planted a defect **only S4
could carry** — dropping the `track` from its inner `@for`, the nested repeat no
earlier scenario has:

```
FAIL packages/frameworks/angular/test/parse-emitted.test.ts >
  arbiter 1: @angular/compiler parseTemplate >
  GREEN SIDE: every emitted template parses with an exactly empty error set
AssertionError: S4.ts: expected [ Array(1) ] to deeply equal []
- []
+ [ "@for loop must have a \"track\" expression" ]
```

**Before this card that plant produced no failure anywhere in the file.** The
generated file was restored byte-identically (`shasum -a 256 -c`, OK) and the
test is green again.

The verdict, in the instrument's own words, now that it is a test and not a probe
— `templateDiagnostics()` returns an **exactly empty array** for every emitted
template:

```
S1: template  300 bytes -> 0 diagnostics []
S2: template  970 bytes -> 0 diagnostics []
S3: template  830 bytes -> 0 diagnostics []
S4: template 1077 bytes -> 0 diagnostics []   <- first nested @for-in-@for this repo has emitted
```

`@angular/compiler`'s own parser accepts the forced-lowered nested-repeat
template with an exactly empty error set, and **CI re-checks it every run.**

## 3. Every derived list was watched going RED, both ways

Twelve of the fourteen new/changed lists carry a **standing** `CALIBRATION`
row that drives both directions through the same functions the real assertion
calls, against throwaway roots: write `n-1` files → red; write the last → green;
add `S99` → red; delete a golden → red; add an `s99-*.json` golden → red; empty
the golden root → **throws**.

Two lists cannot host a standing calibration and were driven red by hand instead:

- **`vue/test/emitted-smoke.browser.test.ts`** — a browser lane has no `node:fs`,
  so it cannot write a throwaway root (the Svelte twin has the same limit).
  Measured out-of-band, verbatim:
  ```
  MISSING  expected [ '../generated/S1.vue', …(2) ] to deeply equal [ '../generated/S1.vue', …(3) ]
  EXTRA    expected [ '../generated/S1.vue', …(4) ] to deeply equal [ '../generated/S1.vue', …(3) ]
  ```
- **`angular/test/parse-emitted.test.ts`'s source map** — a missing emitted file
  makes `beforeAll` throw `ENOENT` and the whole file reports `12 skipped`, which
  is fail-closed but not expressible as a passing row. The extra-file direction
  IS standing and was watched: `expected [ 'S1.ts', 'S2.ts', 'S3.ts', …(2) ] to
  deeply equal [ 'S1.ts', 'S2.ts', 'S3.ts', 'S4.ts' ]`.

## 4. The six emitter lanes: S4's bytes are now re-proved every run

T034 proved once, by regenerating and diffing, that each emitted S4 equals
`formatEmitted(emit(golden))`. Nothing re-proved it. Six new standing rows now
do, and **all six pass** — react, solid and qwik `S4.jsx`, `S4.svelte`,
`S4.vue`, `S4.ts`.

Deriving the table also widened every OTHER loop those tables drive, which is the
larger part of the payout and all of it green on S4:

- **Vue** — `<script setup>` with no `lang=`, no `export`, the VALUED `v-bind`/`v-on`
  shorthands only with no longhand/modifier/`v-slot`/`.prop`, no `untrack`,
  `watchEffect` or `onMounted`, and no 3.3+/3.5+ construct. A template with two
  nested `v-for`s draws none of them.
- **Angular** — no `standalone`, no `imports:`, **no `changeDetection` (so S4 is
  OnPush-checked like the rest)**, no surviving `state(`/`computed(`, and the
  `: any` totality rows including their anti-vacuity arms.
- **Svelte** — no `svelte/events`, no `on(`, no `on:` attribute; and nothing
  above the 5.0 baseline (`$props.id(`, `{@attach`, `<svelte:boundary`,
  `$derived.by(`).
- **All six** — `formatEmitted` accepts the emitted S4 byte-for-byte (LF, single
  trailing newline, tab indentation, no trailing whitespace).

## 5. Size budgets — recorded as MEASURED, not as tidy

S4 has no handwritten reference to be paired against, so its row is a **budget**
rather than a comparison, and `scripts/measure-size.ts` (outside this card's
`allowed_files`) exports only the paired `measureAll()`. The emitted-only
measurement is therefore re-derived inside each `size.test.ts` and **tied** to the
shared one: `the local measurement agrees with the shared measureAll() ruler`
asserts the two methods produce identical numbers for every scenario the script
covers, so a change to the shared ruler goes red here instead of quietly grading
S4 with a retired one. The component name is read from the **golden IR**, not from
the file being measured, so a renamed component is a missing function rather than
a silently re-measured one.

| lane | scenario | physicalLoc | structuralNodes |
| --- | --- | --- | --- |
| react | S3 | 84 | 326 |
| react | **S4** | **77** | **425** |
| solid | S3 | 81 | 334 |
| solid | **S4** | **78** | **438** |

Worth stating plainly rather than smoothing: **S4 is the corpus's structural
heavyweight in both lanes — more `structuralNodes` than anything else — while
having FEWER physical lines than S3.** A repeat nested inside a repeat buys a lot
of AST for a little text. No budget was breached, because none existed; this is
the first one, and it says what the ruler said.

## 6. The small lesson T035 asked to be recorded

`pnpm test:browser` is `react && solid && svelte && vue`. The Svelte failure
aborted the chain, so T034 counted eleven files of this class where there were
thirteen. **A `&&` chain is not an inventory**: it reports the first failing lane,
not all of them. The same shell operator that makes the command fail fast is what
hid a failure from the instrument counting failures.

## 7. Verification

| command | result |
| --- | --- |
| `pnpm test` | **PASS** — 50 files, **915** tests (was 887; +28) |
| `pnpm test:browser` | **PASS** — react 60, solid 49, svelte 13, vue 18 |
| `pnpm check` | **PASS** |
| `pnpm lint` | **PASS** — 0 warnings, 0 errors, 341 files, 93 rules |
| `pnpm e2e` | **PASS** — `6 demos x 4 scenarios, all observations equal`, unchanged |
| `pnpm mutate:corpus` | **NOT RUN** — this card's `stop_if` forbids it; the surface is dirty and `--dry-run` does not bypass `assertCleanSurface()` |

### 7.1 The emitted/golden/compiler diff check

The card's literal `git diff --exit-code -- …/generated …/compiler` reports a
diff, but it is **T034's**, not T036's: HEAD is `8e5f8f3`, which predates T034's
landed-but-uncommitted work. The check that answers what T036 was asked:

```
$ git diff --stat -- 'packages/frameworks/*/generated' \
      packages/compiler/src packages/compiler/test/goldens packages/compiler/test/fixtures
(empty)
```

**No emitted output, no golden, no fixture and no compiler source moved.** The
two files temporarily mutated for the §2 and §3 red demonstrations were verified
byte-identical afterwards by SHA-256. T036's surface is ten test files and this
note.

### 7.2 Nothing here could have degraded the mutation results

The entire diff is under `packages/frameworks/*/test/`. `MUTATION_SURFACE`
(`scripts/corpus-mutation.mjs:88`) is the six `generated/` directories and the six
demo `emitted/` directories — disjoint from every file this card touched. T034's
`6/6 RED` and `18/18 RED` still stand; the PM re-runs the harness after committing.

## 8. Reproducing every claim

```
pnpm test && pnpm test:browser && pnpm check && pnpm lint && pnpm e2e

# watch the PRIMARY arbiter reject S4 - the thing it could not do before:
#   drop `; track row.id` from the inner @for of angular/generated/S4.ts
pnpm vitest run packages/frameworks/angular/test/parse-emitted.test.ts   # red
#   then restore the file

# watch the vue browser inventory go red both ways:
mv packages/frameworks/vue/generated/S4.vue /tmp && (cd packages/frameworks/vue && pnpm test:browser)
mv /tmp/S4.vue packages/frameworks/vue/generated/
```
