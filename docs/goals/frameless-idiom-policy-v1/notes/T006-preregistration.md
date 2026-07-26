# T006 pre-registration — PM's independent derivation for H3

Written BEFORE the cold agent was dispatched, and deliberately kept OUT of the repo so the cold
agent cannot read it. Timestamped by its commit into the repo only after the cold agent's verdict
was in hand.

Applying `docs/emitter-idiom-policy.md` to H3: Angular `input()` / `output()` (signal-based)
versus `@Input()` / `@Output()` (decorator-based) — a whole-component member-declaration choice.

## Baseline identification

Baseline is the sanctioned form that is (a) valid across the widest range of target versions and
(b) imposes fewest obligations on other parties. `@Input()`/`@Output()` work from Angular 2
through 20. `input()`/`output()` exist only from 17.1/17.2. **Baseline = decorators. Candidate
sugar = the signal form.**

## Gate outcomes

- **G1 Sanctioned and measured — FAIL.** Angular is not installed in this repo. There is no
  Angular lockfile entry, no scaffold, no toolchain to build both forms through. Any evidence for
  the equivalence is therefore *necessarily documentary*, which G1 names explicitly as not
  evidence. This gate cannot be passed today no matter how good the docs are.
- **G2 Locality — PASS.** The declaration lives inside the single component module being emitted.
  A parent binds `[prop]="x"` and `(event)="..."` identically against either form, so nothing is
  asked of another module.
- **G3 Declared trigger — PASS.** The choice is driven by declared IR facts (this component has
  props / events), not by inspecting a handler body or inferring intent from expression shape.
- **G4 Totality — PASS, with a caveat.** Stated in emitter terms as "every prop and event
  declaration the Angular emitter emits for a component", the form applies uniformly. The caveat
  is `@Input()` setters with custom set-time logic, which have no direct signal equivalent — but
  the frameless IR does not express those today, so the domain as stated holds.
- **G5 Behavioral neutrality — FAIL.** This is the substantive kill. Signal inputs are not a
  different spelling of the same construct: they change **reactivity depth** (a signal input
  participates in the signal graph and can be tracked by `computed`; a plain decorator field
  cannot) and they change **throw behavior** (a required signal input throws when read before it
  is set; a plain field reads `undefined`). G5 names reactivity depth and throw/error behavior as
  explicit failure conditions.
- **G6 Pinned by a standing check — DEFERRED.** No Angular lane exists on any official Angular
  scaffold, so nothing could catch a regression. The version corollary compounds it: the signal
  form requires ≥17.1 and `EnrichedIR` has no target-framework-version input.

## Ruling

**no-sugar.** Two hard FAILs (G1, G5) plus a DEFERRED. Because there are genuine FAILs and not
merely a DEFERRED, this is *denied*, not *deferred-not-denied* — it does not become sugar the
moment an Angular lane lands. G5 would still have to be answered.

## Why this is the trap

H3 is rhetorically identical to the Qwik case: the framework's own docs say both forms are valid
and one is "recommended for new projects". An agent that memorized the Qwik outcome, or that
reasons from "the framework sanctions it and prefers it", lands on **sugar**. The procedure
catches it in two independent places — G1 because nothing can be measured, G5 because the two
forms are not behaviorally the same construct. A wrong answer here is therefore diagnostic: it
tells us the agent read the *conclusion* of the policy rather than running it.

## Scoring rule, fixed in advance

- Cold agent says **no-sugar** on substantially G1 and/or G5 grounds → PASS.
- Cold agent says **no-sugar** but only via G6/DEFERRED reasoning (i.e. "no Angular lane yet")
  → PARTIAL. It reached the right verdict on the weakest of the three available grounds, and
  would flip to sugar the moment a lane landed, which is wrong.
- Cold agent says **sugar** → FAIL. The policy is not transferable as written.
- Hedged / no clear verdict → FAIL, per the T006 card.
