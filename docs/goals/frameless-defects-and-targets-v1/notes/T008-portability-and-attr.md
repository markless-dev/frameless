# T008 — Windows portability, defect 6, defect 5, and the truth in DEFECTS.md

Phase C worker package. Test, configuration and documentation only: no emitter, no
adapter, no `src/`, no generated output, no golden.

Spec: `notes/T007-phase-b-audit.md` §6.1. Everything below either executes that
spec or records where the evidence forced a departure from it.

---

## 0. Verification

| command             | result                                                            |
| ------------------- | ----------------------------------------------------------------- |
| `pnpm check`        | pass                                                              |
| `pnpm test`         | pass, **569 passed (569)**, 39 files (baseline 561)                |
| `pnpm test:browser` | pass, react **55/55**, solid **44/44**                             |
| `pnpm e2e`          | pass, `[e2e] PASS`, 3 demos × 3 scenarios                          |
| `git status --short`| every path inside `allowed_files`                                  |

**The renormalise gate passed.** `git add --renormalize .` after adding
`.gitattributes` staged **nothing** — zero tracked files had their content
rewritten. That is what proves the working copy was already LF and that the new
attribute pinned an existing invariant rather than silently changing 700 files.
Independently confirmed by scanning all 721 tracked files for a `CR` byte: none.

Nothing in this package touches runtime behaviour, so the **+8 tests** are the only
expected delta: one calibration on the Solid gate's mutation constructor, two on
the CR invariant, four on the rename invariant (three permuting cases plus the
authored-reorder guard), and one authored-reorder guard in the generative lane.

---

## 1. Defect 3 — Windows, four causes

### Cause A — `execFileSync('npx', …)`. Confirmed, fixed on its own terms.

Unrelated to line endings and fixed independently of them, in **both** copies
(`react/test/format-emitted.test.ts`, `solid/test/format-emitted.test.ts`).

The commonly cited reason — "`ENOENT` because `npx` is `npx.cmd`" — is only half
of it. Since the CVE-2024-27980 hardening, Node also **refuses** to spawn
`.cmd`/`.bat` through `child_process` without a shell, throwing `EINVAL` even when
the extension is named in full. So naming `npx.cmd` alone would not have fixed it.
The form used is `npx.cmd` **plus** `shell: true`, gated on `process.platform ===
'win32'` so nothing changes on POSIX. The argument vector is entirely static and
contains no spaces or shell metacharacters, which is stated at the site: shell
interpretation is inert here, and that is a property worth recording rather than
assuming.

### Cause B — the `S-SH7` green vacuum. Two fixes, not one.

`packages/frameworks/solid/test/gate.test.ts`. The row's mutation search literal
embedded `\n\t\t`, and `shared` is read **from disk**. On a CRLF checkout the
literal cannot match, `String.replace` returns the input unchanged with no error,
and the row asserts `S-SH7` against a **non-mutant** — green, measuring nothing.

Witnessed in the scratchpad before touching anything:

```
old literal on LF   -> mutated? true
old literal on CRLF -> mutated? false   <-- the green vacuum
regex on LF   -> mutated? true
regex on CRLF -> mutated? true
CRLF mutant keeps CRLF? true
```

Both halves shipped:

1. **CRLF-proof.** The search is now a regex whose separator is `(\r?\n\t*)`, and
   the replacement writes `$1` back, so the mutant stays byte-faithful to whatever
   was read from disk instead of smuggling LF into a CRLF file.
2. **Impossible to no-op silently.** A local `mutate(source, search, replacement)`
   throws when the search does not match, in the pattern already used at
   `metamorphic.test.ts:79`. A checked-in calibration exercises both halves: a
   deliberate miss throws, and the repaired pattern still produces a real mutant on
   a CRLF-ised copy of the fixture.

**Scope held deliberately.** Only this row was converted. The corpus-wide
conversion of all three gate suites is **T018**, and it is a separate package
because every mutation the conversion reveals to be *already* vacuous is a finding
needing individual adjudication, not a cleanup. Converting them here would have
smuggled that unbounded work into this package.

### Third and fourth causes, and the one-file root

Both are line-ending consequences of the same missing decision, and neither needed
its own fix:

- **Third** (T006): `packages/compiler/test/goldens/*.json` bake AST **byte
  offsets** taken from LF sources. The goldens are **untouched** — their offsets
  are correct for the bytes they were built from, and T006 already showed that
  CRLF-ising a golden does not fix it. The checkout was wrong, not the golden.
- **Fourth** (T007): `react/test/emitter.test.ts:133-134,141,150` and
  `solid/test/emitter.test.ts:153,162` compare `readFile(generated/*.jsx)` to
  `emit(ir)` byte-for-byte while `formatEmitted` hard-codes `endOfLine: 'lf'`.

**I could not confirm the fourth cause, and say so.** It is an inference read off
the assertions. I have no Windows log, no Windows runner, and no Windows checkout.
What can be confirmed locally is only the antecedent: `formatEmitted` does pin LF,
and those assertions are byte comparisons — so *if* the checkout is CRLF the
assertions must fail. Whether that is what actually happened in the reported run is
unsettled, and only the CI cell can settle it.

**Root fix:** `.gitattributes` with `* text=auto eol=lf`, plus explicit `binary`
for `*.png`/`*.tgz` (which `text=auto` would detect anyway — declared so the intent
is not implicit). The file carries the reasoning inline, because the next person to
see it needs to know that three test-suite behaviours depend on it.

### The invariant now asserts itself

`packages/compiler/test/package-inventory.test.ts` enumerates tracked files via
`git ls-files -z` and **fails if any tracked text file contains a `CR`**, skipping
binaries by git's own heuristic (a NUL in the first 8000 bytes) so it skips exactly
what `text=auto` skips.

Two design choices worth defending:

- **It fails rather than skips when git is unavailable.** "Tracked" is a git word;
  a precondition that cannot be checked must say so rather than pass by default.
  Silently skipping would have re-created the exact failure mode this whole phase
  ruled on.
- **It is calibrated.** A search that returns nothing on a healthy tree is
  indistinguishable from a search that looks at nothing, so a companion test pins
  both discriminations it makes. Witnessed end to end: staging a CRLF file makes it
  fail **by name** (`expected [ '.crlf-witness.txt' ] to deeply equal []`).

On a CRLF checkout this now fails first and loudest, which converts every
downstream CRLF failure from mysterious into attributable.

### The flag stays

`ci.yml`'s Windows cell keeps `continue-on-error`. Only the **comment** changed —
the previous one stated a reason T006 had refuted ("`gate.test.ts:610` fails a hash
assertion"), and a flag whose stated reason is known-false is indistinguishable
from an unexamined flag at audit. The arithmetic is in the comment: four named
causes account for ~6 of 35 failures across 4 of 8 files, and the fourth is a
hypothesis. Removal gate is an **observed** green cell, owned by T009.

---

## 2. Defect 6 — order-insensitive view, cited and witnessed

### What is included, and the line that justifies each

Every collection below names the `packages/compiler/src/build.ts` line whose
comparator keys on a name-derived field, **and** was watched to permute under an
equal-length rename. Citation alone was not treated as sufficient.

| collection                                | cited sort line                                        | key                                       | witnessed by                                                    |
| ----------------------------------------- | ------------------------------------------------------ | ----------------------------------------- | --------------------------------------------------------------- |
| `records.bindings`                        | `build.ts:428`                                          | `compareText(id)`, `state:<name>`         | `beta`→`zeta`: `[computed:total, state:beta, state:delta]` → `[computed:total, state:delta, state:zeta]` |
| `records.aliases`                         | `build.ts:429`, ids built at `2440`                     | `alias:<Component>:<aliasName>`           | `{ first: beta, second: delta }` → `[alias:Probe:beta, alias:Probe:delta]` becomes `[alias:Probe:delta, alias:Probe:zeta]` |
| `records.stateReads`                      | `build.ts:431` → `collectCanonicalReads` → `2725` (`compareReads`, `2732`) | componentId, graphNodeId, path | positions 1 and 2 swap in the same probe                          |
| `records.stateWrites`                     | `build.ts:342` → `sortWrites`, `2740-2752`              | componentId, **graphNodeId**, path, …     | see below — witnessed explicitly                                  |
| every `reads` array, any depth            | `build.ts:1370` → `dedupeReads`, `2866-2874`            | graphNodeId, path, via                    | `bindings[].reads`, `bindings[].computed.reads`, `locals[].reads`, `events[].handlers[].reads` all moved |
| every `writes` array, any depth           | `build.ts:2671` and `:389` → `sortWrites`, `2740-2752`  | as above                                  | `events[].handlers[].writes` moved                                |
| `components[].locals[].semanticRecordIds` | `build.ts:629`, bare `.sort()`                          | `state:` / `alias:` ids                   | `const [beta, delta] = pack` → `["alias:Probe:beta","alias:Probe:delta"]` becomes `["alias:Probe:delta","alias:Probe:zeta"]` |

### `records.stateWrites` — the witnessed permutation

T006's guardrail said `stateWrites` is "`writes` unsorted, authored write order"
and must be excluded. That is **false**: `build.ts:342` is
`const writes = sortWrites(...)`, and `sortWrites` (`2740-2752`) keys on
`componentId`, then **`graphNodeId`**, which is name-derived. T007 caught this. A
Worker obeying the original guardrail would have reproduced the same species of
false finding from a second collection.

It is included here **only** because it was watched to permute. Program: two state
locals `beta` and `delta`, both written in one handler (`{ beta++; delta++; }`),
renamed `beta` → `zeta` (equal length, so every source offset is preserved):

```
before: [ state:beta @267-271, state:delta @275-280 ]
after : [ state:delta @275-280, state:zeta  @267-271 ]
```

Two whole entries, identical after identifier blanking except for their spans,
occupying swapped positions. The positional comparison fails; the multiset
comparison passes. That is exactly the defect-6 signature, from a second
collection, and it would have gone on producing false findings.

### What is excluded, and why

Exclusion is the conservative direction — the collection stays order-sensitive — so
these are recorded rather than argued away.

- **`records.events`** (`build.ts:430`). It *does* sort by `compareText(id)`, so it
  passes a naive "is it name-keyed?" test. But an event id is
  `` `event:${nextEventId++}` `` or `` `event:${hostNodeId}:${eventName}` `` — an
  allocation index, or a host-node/DOM-event pair. No local rename can move either.
  **Probed and confirmed:** in a program with two handlers and a renamed written
  local, `records.events` order was unchanged; only its *nested* `reads`/`writes`
  moved, and those are covered above. This refines T007's "bindings, aliases and
  events" grouping: the third member of that trio is not reachable.
- **`module.exports`** (`build.ts:464`, keyed on `exportedName`). Export names are
  part of the observable contract, which a meaning-preserving rename never touches.
  T007 flagged "probably not reachable" as the shape of assumption to avoid; the
  resolution is that no witness can be produced, so it is excluded rather than
  included on a guess.
- **`records.sharedWrites`** (`build.ts:2079`, `targetSpan.start`) and
  **`events[].handlers`** (`build.ts:326`, `expression.start`). Span-keyed, not
  name-keyed. Order-sensitive by design.

### Multiset of whole entries, never sort-then-compare

Implemented as a **counting map keyed on canonical JSON of each whole entry** —
literally a multiset, not a sorted array comparison, so the distinction T007 drew
is structural rather than a matter of interpretation. Everything outside the cited
collections stays positional and is compared exactly.

The reason this matters is provable rather than stylistic: a `stateWrites` entry
carries its own `sourceSpan`, so swapping two authored writes changes the multiset
even though it does not change the set of names written. Sorting both sides and
comparing would discard precisely that evidence.

### Calibration — the instrument still fails

- **`metamorphic.test.ts` "changing a literal is caught": still fails as intended.**
  Rewired to run through the new view. It previously compared `structural()` output
  directly, which after this change would have calibrated a comparison no property
  makes — a calibration for the wrong instrument is not a calibration.
- **"dropping a cell is caught by the wrap comparison": untouched and still
  failing.** It compares `components[].locals`, which the view does not alter.
- **New: "a genuine authored reorder of two writes is still caught."** The specific
  thing the view could have silenced. Present in both `metamorphic.test.ts` and
  `generative.test.ts`.

### The third vacuous green

The fixture-level invariant ran on **one** fixture (`renames` gives s2 and s3 empty
lists, which hit `continue`), and `s1-render-once`'s golden has a single state
binding — `computed:derived < prop:props < state:count` holds before and after
every rename it performs. It was structurally incapable of exhibiting defect 6.

Three checked-in cases that **can** permute now sit alongside it, one per mechanism
(top-level records, aliases, `semanticRecordIds`). Each asserts **both** halves:
the order-insensitive view holds, **and** the positional comparison would have
failed. The second assertion is the anti-decay guard — if a future change makes a
case stop permuting, it fails there instead of quietly proving nothing again.

### The narrowed generative property is released, with evidence

`generative.test.ts` property 3 had been narrowed to compare the multiset of
template node **kinds**, explicitly as a holding measure. It now compares the
**whole IR** under the order-insensitive view, which is far stronger.

A narrowed expectation must never be released alone, so the release ships a witness
counter: the property counts how many generated renames the *positional* comparison
would have rejected, and fails if that count is zero. A green run therefore means
the property holds, not that the corpus stopped exercising it.

Measured before writing it, across four seeds at 500 runs each:

| seed     | renames exercised | positional failures | multiset failures |
| -------- | ----------------- | ------------------- | ----------------- |
| 20260726 | 220               | 29                  | **0**             |
| 1        | 225               | 23                  | **0**             |
| 987654   | 221               | 27                  | **0**             |
| 20260101 | 244               | 30                  | **0**             |

910 renames, 109 reproductions of defect 6, zero violations of the repaired
invariant. Nothing outside the cited collections moved.

### One consequence of `allowed_files`

The view helper is **duplicated** between `metamorphic.test.ts` and
`generative.test.ts` rather than shared. A shared helper needs a new module, which
is outside `allowed_files`, and importing one test file from another registers its
suites twice. Both copies carry the citation table and a "change one, change both"
note. This is the right call for T018/T013 to revisit if a `test/support/` module
is ever created.

---

## 3. Defect 5 — measured, then decided

**Method.** T006-style, entirely in the scratchpad; no repo file was changed for
the experiment and no emitted output was touched. Copies of `generated/S1.jsx`,
`S2.jsx` and `S3.jsx` with **every `attr:value={…}` line removed** (plain `value`
only) were driven through the repo's own Solid browser lane — real headless
chromium, the analyzer's own `runScenario` and `compareRuns`, the same
`calibrationScenarios`, the same handwritten `solidReferences`. A scratchpad vitest
config pointed the solid plugin and the lane at the modified copies.

**Result: divergent, and not marginally.**

| comparison                                            | S1        | S2                     | S3                     |
| ----------------------------------------------------- | --------- | ---------------------- | ---------------------- |
| plain-`value` emitted vs handwritten reference         | identical | **33 DOM divergences** | **13 DOM divergences** |
| plain-`value` emitted vs shipped `attr:value` emitted  | identical | **33 DOM divergences** | **13 DOM divergences** |

Every divergence is on the `dom` channel at `attributes.length` of the input
element, at `mount` and at every subsequent `before` / `after` / `microtask` /
`quiescence` phase of every action. S1 is identical because it has no input.

Direct DOM probe on S2's row input after dispatching an `input` action:

```
attr:value   attribute="Beta!"   property="Beta!"
plain value  attribute=null      property="Beta!"
```

With plain `value`, Solid sets the DOM **property** only. The `value` **attribute**
is never written and never tracks the signal. `packages/analyzer/src/serialize.ts`
serializes element attributes into the observation, so this is observable state the
three-way oracle compares — not a cosmetic difference.

**Decision, per the card's own rule.** Divergent behaviour → **`attr:` is
required**, this is purely solid-js's typing gap,
`packages/frameworks/solid/test/solid-attr-namespace.d.ts` is **correct
documentation** and stays, and the deliverable is an upstream report. The emitter
is untouched, and the measurement says it should stay untouched.

**A second fact worth recording:** the handwritten Solid references diverge from
plain-value output *identically*. The emitter is not inventing a house idiom — it
is reproducing one, and the idiom is load-bearing rather than stylistic. That
removes the last reading in which `attr:` could have been called gratuitous.

### Upstream report — draft for the owner to file against solid-js

Nothing has been sent. This is filing material.

> **Title:** `InputHTMLAttributes` does not admit `attr:*` namespaced props that
> Solid supports at runtime
>
> **Version:** solid-js 1.8.22
>
> **What happens.** Solid supports `attr:*` namespaced props generically, forcing a
> value to be written as an HTML **attribute** rather than a DOM property. The
> shipped `JSX.InputHTMLAttributes` does not declare them, so `attr:value={…}` on an
> `<input>` is a type error under `tsc` even though it is correct, supported code:
>
> ```
> TS2322: Property 'attr:value' does not exist on type 'InputHTMLAttributes<HTMLInputElement>'.
> ```
>
> **Why it is not merely cosmetic.** For `<input>`, plain `value` sets the property
> only; the attribute is never written. Anything that reads the serialized DOM — SSR
> hydration comparison, snapshot testing, cross-framework differential testing,
> `getAttribute('value')`, `outerHTML` — sees a different document. Measured on
> chromium 1.8.22:
>
> ```
> <input value={sig()} attr:value={sig()} />   attribute="Beta!"  property="Beta!"
> <input value={sig()} />                      attribute=null     property="Beta!"
> ```
>
> So `attr:*` is the only way to express "keep the attribute in sync", and it is
> currently unexpressible in TypeScript without an augmentation.
>
> **Workaround in the wild.** Consumers declare it themselves:
>
> ```ts
> declare module 'solid-js' {
> 	namespace JSX {
> 		interface CustomAttributes<T> {
> 			[key: `attr:${string}`]: string | number | boolean | undefined;
> 		}
> 	}
> }
> ```
>
> **Ask.** Admit `attr:${string}` (and, for symmetry, the other supported
> namespaces) on the JSX attribute interfaces that already accept `CustomAttributes`,
> so the augmentation is unnecessary.

---

## 4. `docs/DEFECTS.md`

Retitled to **Findings ledger**, and the opening framing replaced outright. The old
opening claimed "nothing in this list is unfinished testing work" and "the suite
that found them is complete and green". The first is false — three of six are
test-suite defects. The second is false twice: the adjudicated tally is **one
product defect, one non-defect, three test-suite defects and one upstream**, and
three instances of *vacuous* green are on record.

Replaced with an adjudicated-provenance table, the three vacuous greens named, the
common-shape ruling (every one measured the product through a proxy whose stability
the product never promised, and asserted nothing about the proxy), and a checkable
claim in place of "complete and green": the suite is green, and its green is worth
exactly as much as its calibration.

Entries 2, 3, 4, 5 and 6 rewritten. **Defect 2 is recorded as NOT A DEFECT**, with
the instrument artifact explained — clicking at `domcontentloaded`, before any
framework installs listeners; the harness's own asymmetry against React and Solid;
and the fact that reproducing on an untouched scaffold was proof the test was
unfair rather than proof of an upstream defect. The upstream filing is marked
retracted and never sent.

**`qwikLoader: 'inline'` is deliberately NOT recorded as a workaround.** T005's
rider recommending it is superseded by the owner's overturn: with no defect there
is nothing to work around, and documenting a non-default render option against a
non-defect would be the same error in documentation form.

### Note on T007 §5.1's tally

T007 recorded defect 5 as "open" and expected T008 to settle it. It is now settled
as **upstream**, so the final tally reads *one product defect, one non-defect,
three test-suite defects, one upstream* rather than "one open question".
`docs/DEFECTS.md` states the settled version.

---

## 5. What this package did not settle

- **Whether the ~29 unaccounted Windows failures share the CRLF root.** The
  fourth-cause hypothesis fits the file count (4 named files + three emitter test
  files ≈ 8) but remains an inference from reading assertions. No Windows log, no
  Windows runner. Only the CI cell can settle it, which is why the flag stays.
- **Whether `.gitattributes` fixes anything on Windows.** It provably fixes the
  *mechanism* — a fresh checkout will now be LF — but the claim "the Windows cell
  goes green" is untested and is not being made.
- **Defect 4 is untouched here.** Diagnosis stands; the repair is T017's.
- **No upstream issue has been filed.** §3 is filing material and needs the owner.
