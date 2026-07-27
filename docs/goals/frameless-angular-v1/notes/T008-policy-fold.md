# T008 — folding the T005 decorator-vs-signal ruling into the policy and the emitter

**Docs-and-comments only. No emitted output moved.** `packages/frameworks/angular/generated` is
byte-identical across two regeneration runs, and `packages/compiler`, the react, solid, qwik, svelte
and vue lanes, `demos`, `scripts`, `pnpm-lock.yaml` and `pnpm-workspace.yaml` are untouched.

## What landed, in the four parts the card asked for

### 1. Worked examples 11 and 11b

Added to `docs/emitter-idiom-policy.md`, immediately after worked example 10 and before
"The baseline form inventory". Entry 11 records **G1 PASS, G2 PASS, G3 PASS, G4 PASS (narrowed),
G5 FAIL, G6 FAIL** — **no `DEFERRED` at any gate**, because the lane landed and both deferring
conditions are discharged. `FAIL` at Gates 5 and 6 → **denied, not deferred**, and the entry says
which one decides it: **Gate 5**, because Gate 6's `FAIL` is retirable in principle and Gate 5's is
not.

Both Gate 5 limbs are recorded as measured: the `computed()` divergence (`kit:2` under `@Input()`
while the DOM reads `kit:10`; `kit:10` under `input()`), and the exported member type moving
`any` → `InputSignal<any>` so a consumer write throws `TypeError`. The refuted limb is recorded **as
refuted** — "required inputs throw NG0950" is stated in the entry as the reason that was measured
false and must not be carried forward, with both grounds (plain `input()` returns `undefined`
identically; `input.required()` is unreachable because `PropDestructuringEntry` has no `required`
field and `propMembers()` throws on `defaultValue`).

Gate 6's `FAIL` is written as the honest negative result, in the entry rather than in a footnote:
`pnpm e2e` would **not** go red on this sugar, the six-row green proves activation neutrality and
does not pin the form choice, and the only thing pinning it is the frameless-owned
`no-signal-members` gate policy.

### 2. Gate 1's absent-framework paragraph

The Vue T006 fold had already rebuilt that paragraph into a **one-line-per-framework discharge
list**, with Svelte's and Vue's lines in and Angular's deliberately left out. **That structure was
read first and extended, not overwritten** — Vue's line is untouched and the list shape is unchanged.
Angular's line names `frameless-angular-v1` T004, `@angular/core@22.0.8` and the official Angular CLI
SSR scaffold, exactly as the Svelte and Vue lines name theirs.

The trailing paragraph's now-stale sentence — "Angular's line is the Angular board's to add; it is
deliberately not written here" — was replaced by a sentence recording that T008 added it, and that
this is the moment the retired "Vue and Angular are absent today" sentence went from half-false to
**fully** false.

**One deliberate non-edit, and it is the interesting one.** Angular's line also states that worked
examples 4 and 5 are stale by that line alone and their re-run is queued as T009. Those two entries
were **left standing unmodified** — re-scoring them is T009's, and T005 explicitly declined to rule
them. Naming them in the discharge list is the smallest thing that keeps the document from
contradicting itself in one paragraph without re-scoring anything.

### 3. The decision-site comment at `propMembers()`

`docs/emitter-idiom-policy.md`'s "Recording a ruling" item 2 requires a comment at the decision site
in the **emitter**. `propMembers()` had none — the only comment naming this question lived in the
gate. It now carries the ruling, the six outcomes, the deciding gate (**G5**), both measured limbs,
the refuted NG0950 reason marked as refuted, and the Gate 6 negative result. The edit is
**comment-only**; `return { text: \`@Input() ...\` }` is unchanged.

### 4. The gate's provisional wording

`packages/frameworks/angular/src/gate/index.ts` carried the ruling as provisional in three places,
all now settled:

- the `DossierRef` union member and its comment —
  `'frameless-idiom-policy-v1 T006 (decorator-vs-signal, held out for T005)'` →
  `'frameless-angular-v1 T005 (decorator-vs-signal, DENIED at G5 and G6)'`;
- the `no-signal-members` policy's `dossierRef`, same replacement;
- the `SIGNAL_APIS` doc block and the violation message, which both said T005 "is the task that
  re-runs the six gates" and that shipping a signal would "hand T005 a fact to ratify instead of a
  question to rule". Both now state the settled outcome and both Gate 5 limbs.

**The policy itself is UPHELD, unchanged in behaviour.** No `SIGNAL_APIS` entry was added, removed or
narrowed; `input`, `output` and `model` are all still in the set; no assertion was relaxed. The only
thing that changed is what the policy *says about why it exists* — it no longer holds a question
open, it enforces an answer.

## The one addition beyond the card's four parts

`packages/frameworks/angular/test/gate.test.ts` now **pins the new `dossierRef` as a literal** on the
`no-signal-members` violation, alongside the existing policy-id assertion. Reason: the gate is the
sole enforcement point for a ruling Gate 6 measured as unpinnable by any behavioural check, and the
thing this fold changed is precisely the text of that record. A silent revert to the provisional
wording would mean the ruling had been quietly un-recorded, with nothing red. One added assertion,
no existing assertion touched.

## What was NOT done, and why

- **Worked examples 4 and 5 were not re-run, re-scored or rewritten.** T009 owns them, and worked
  example 5 is a live contradiction (the policy calls `@if`/`@for` a deferred candidate while all
  three Angular goldens already emit them) that a task scoped to a different entry must not resolve
  by accident.
- **11b does not borrow entry 11's Gate 5.** The output half is `UNKNOWN` at Gates 1, 4 and 5 and
  `FAIL` at Gate 6, with **Gate 4** the decider. Scoring its unmeasured gates `PASS` to satisfy the
  six-gate count was refused explicitly: this document says a fabricated `PASS` "claims a neutrality
  check that was never run and is the more damaging of the two errors". The note's own text scored
  only Gate 4; the remaining five are recorded here because item 1 of "Recording a ruling" requires
  an outcome for all six, and every one of them is recorded at the honest label rather than the
  convenient one.
- **No emitted output, no golden, no `@Input()` → `input()` change.** That was a stop_if, and it is
  the ruling's substance.

## Verification

`pnpm check`, `pnpm test`, `pnpm lint`, the double regeneration + `git diff --exit-code` over
`packages/frameworks/angular/generated`, and the protected-path `git diff --exit-code` all pass.
Unlike earlier tasks on this board, the tree was clean at `5edee60`, so the `git diff --exit-code`
gates worked normally rather than needing sha256 substitutes.
