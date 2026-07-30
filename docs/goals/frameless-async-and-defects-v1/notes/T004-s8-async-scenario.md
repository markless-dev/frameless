# T004 — S8 LANDED in six lanes, and the served payload refuted two things the board believed

Worker, 2026-07-30. Board: `docs/goals/frameless-async-and-defects-v1/state.yaml`.
Dispatched at `61a6779`. Nothing committed.

## 0. Headline

**S8 is in the corpus. `pnpm e2e` reports 6 demos × 9 scenarios, all observations
equal. `pnpm mutate:corpus` reports 54 mutants, every one RED, every one
restored.** Scenarios 1–7 and 9 are byte-unchanged.

**Three things in the brief were wrong, and the two that mattered were found by
running the thing rather than by reading it:**

1. **`pnpm mutate:corpus` COULD NOT RUN AT ALL in react, solid or qwik.** The
   harness's `LANES` table still declared `extension: 'jsx'` after the emitted
   modules were renamed to `.tsx`, so it threw `ENOENT` on
   `generated/S1.jsx` — on every scenario, in three lanes, before issuing a
   single verdict. The 54-cell budget the card asks for was **unreachable at
   HEAD**, and nothing had reported it because a harness that dies before its
   first mutant produces no survivors either.
2. **The overlap requirement is satisfiable, but NOT the way anyone had assumed.**
   T001's "two dispatches overlapping the `await`" is real and S8 drives it in all
   six lanes — but only because the promise is armed by a **click**. Qwik's SSR
   serializer *awaits* every promise it reaches, so a gate that is pending at
   serialization hangs the render, and a timer gate arrives at the client already
   resolved.
3. **An entirely new defect, invisible to every instrument this repo had:**
   emitted Angular never re-rendered a state write made after an `await`. See §3.
   `docs/DEFECTS.md` entry 14.

## 1. The authoring, and why each part of it is load-bearing

`packages/compiler/test/fixtures/s8-async-handlers.tsrx` is T043's **A7 and A8**
verbatim in shape — `await` on a promise-**valued** prop, no call and no free
global, plus a second handler opening with `event.preventDefault()`.

| element | why |
| --- | --- |
| `phase` written on BOTH sides of the `await` | 12.2 mechanism **(b)**, the dropped pre-await write, needs a cell whose first write a final-sync retention can collapse |
| `ticks` written ONLY after the `await`, reading itself | 12.2 mechanism **(a)**, the stale render-closure read, needs a post-await read driven by two dispatches in flight at once |
| `cancels` as a third cell | A8's counter must be observable without disturbing the counter the overlap claim is read off |
| both buttons carry a TEXT CHILD | **T002's measurement.** A self-closing `<button/>` makes the svelte emitter refuse: `a11y_consider_explicit_label` |
| the props are **ANNOTATED** | see §5 |

## 2. Why the gate is HELD OPEN by a click, and not timed

This is the design decision the scenario turns on, and it was forced by
measurement in two independent places.

**Mechanism (b) has exactly one observable: a render taken WHILE the handler is
suspended.** It leaves no trace afterwards, because the post-await write to the
same cell lands either way — a final-state reading passes under both lowerings.
So the driver must be able to read the DOM mid-flight, deterministically.

**Mechanism (a) needs two dispatches genuinely in flight at once.** A single
dispatch, and a sequential pair, both pass under either lowering, because the
framework re-renders between clicks and the closure is fresh.

A promise on a timer gives both only by racing the driver. So `/s8` in every lane
renders two harness controls **outside** the emitted component —
`[data-harness="arm"]` hands the board a promise nobody has resolved, and
`[data-harness="release"]` resolves it. There is no timeout anywhere in the
scenario: every value it waits for appears because a click made it appear.

**QWIK IS WHY THE INITIAL GATE IS RESOLVED.** Measured in
`@qwik.dev/core@2.0.0-beta.38`: the SSR serializer treats a promise by
registering it and looping on `await Promise.race(this.$promises$)` until none
remain. A promise pending at serialization time **hangs the server render**; one
that resolves on a timer is serialized **resolved**, so the client deserializes a
settled promise and that lane has no suspension window at all. Neither is a
defect — a pending promise with a live resolver is by construction not
serializable, which is what resumability means, and the owner's standing rule is
not to read an out-of-envelope result as a defect. Arming client-side is what
makes the window reachable in **six** lanes rather than five.

**A SECOND QWIK MEASUREMENT, which cost one red run.** `page.click` returns when
the click is dispatched, not when its effect has landed. Arming is a state change
in the PAGE component, and in a lane whose route component must be *imported*
before it can re-render, the two `run` clicks after the arm both read the old,
resolved gate and completed: the lane read `done` where `pending` was required,
and the failure looked exactly like an emitter fault. Every lane now projects
`open`/`held` from the same state its board's prop is derived from, and the
contract waits for `held`. That is the arm having landed, not a settle delay.

## 3. THE DEFECT S8 FOUND: emitted Angular never re-rendered a post-`await` write

`docs/DEFECTS.md` entry 14. The witnessed red, verbatim:

```
expected '[data-async="ticks"]' to have text "3", but it was "1"
  (page http://127.0.0.1:5173/s8, waited 5000ms)
```

**The diagnosis was measured, not inferred.** The same run was repeated with one
extra click on an unrelated harness control inserted after the release. The
reading became `3` immediately, and the run then failed one step later at
`expected "4", but it was "3"` — the same fault one dispatch downstream. Both
continuations had run and both writes had landed: **the state was correct and the
DOM was stale.**

Angular 22 scaffolds are zoneless and this lane holds state in plain class
fields. That works for a synchronous handler for one reason only: invoking a
template `(click)` listener notifies the scheduler itself. An `await` ends that.

**It was invisible to every instrument this repo had.** `ng build` compiles it,
`parse-emitted` parses it, `emitted-typecheck` type-checks it, `pnpm check` is
silent, and the emitted output *reads* correctly. Only a browser renders. This is
the case the tranche's `likely_misfire` describes, arriving from a lane nobody
was watching.

**Repaired narrowly:** `notifyAfterSuspension` in the Angular emitter injects
`ChangeDetectorRef` and ends every suspension segment after the first with
`markForCheck()`. Gated on `handler.isAsync`, so **zero generated bytes moved**
outside S8. The alternative — lowering every cell to an Angular signal — is a
re-lowering of the whole lane and is recorded as not taken.

## 4. The React gate policy had to be scoped, and that is the repair speaking

`generated/S8.tsx` was **refused by React's own dossier gate**:

```
one-call-per-setter (T002 ruling 5): A handler may call each state setter at most once
```

T003's segmentation of the final-sync retention is precisely what makes the
emitted handler call `setPhase` twice — once either side of the boundary. Ruling
5 was written when no handler in this repo could contain `await` at all, so a
second call could only be an emitter fault. The count is now keyed by
**(suspension segment, setter)**: inside one segment nothing can render in
between and the ruling's original force is unchanged; across a boundary two calls
are the repair. The four synchronous mutation rows that pin the policy are
untouched and still pass.

## 5. Why S8's props are ANNOTATED, and why that is not instrument-masking

Unannotated, S8 added **7 errors to `pnpm check`** — two TS7031 in react, one
TS7006 in solid, four TS18046 in qwik — the same per-scenario classes that make
up the inherited 267. Annotating the fixture's props takes it back to **exactly
267**.

That is a real reason to be suspicious, so the justification is stated on the
axis rather than on the number: **`ready` is the thing the handlers `await`.**
T043's re-specification of S8 is "`await` on a promise-VALUED prop", and on an
unannotated prop that sentence is unprovable — the emitted `await ready` is an
`await` of `any`, which is also what awaiting a number looks like. The annotation
is what makes the emitted output say what the scenario claims, and it exercises
IR-8's supply channel through a second fixture. It is **not** T002's rejected
`tsrx-core.d.ts` move: that one would have changed nothing a consumer sees, and
this one changes the emitted type of every S8 artifact in all six lanes.

The IR-8 control arm survives: `ANNOTATED` is now a named set of two, the control
is what is left over, and both sets are asserted non-empty and complete.

## 6. The mutation budget

54 cells, every one RED, every one restored. The six S8 mutants share one axis —
*state written either side of an `await`, with the post-await read taken LIVE* —
and the **react** one is not invented: it is the pre-T003 emitted output restored
verbatim, both mechanisms at once. It is red at three of the scenario's five
readings.

Two harness repairs were needed to run it at all:

- `extension: 'tsx'` for react, solid and qwik (§0.1).
- The clean-surface precondition and the restoration check now compare the
  working tree to the **INDEX** rather than to HEAD. `git checkout -- <path>`
  restores from the index, so that is the correct comparison, and it is what lets
  the harness run on a tree whose new corpus artifacts are staged but — per this
  card — **not committed**. Untracked paths are still refused, because
  `git checkout` cannot restore a file git does not know about.

## 7. T003's remaining blocker, closed

The four unwired `regenerate:composition` scripts (qwik, svelte, vue, angular)
are now wired. All three regeneration tiers were **proved real before any diff
was trusted**: a `__T004_PLANT__` marker was planted in one artifact per tier —
`react/generated/S1.tsx`, `angular/generated/S1.ts`,
`qwik/generated-composition/C1-slot.tsx`,
`vue/generated-composition/M1-panel.vue`, and both
`generated-persistence/P1.tsx` — and every one was restored by the run.

After that, the only generated paths that differ from HEAD are the six new
`S8.*`. Nothing else moved.

## 8. What was deliberately NOT done

- **S7 was not touched.** Its cause is the IR and T002 routed it out of this
  tranche.
- **No emitter was changed except Angular's**, and that one only for a defect
  measured in a browser.
- **The scenario was not weakened to fit any lane.** The one thing that changed
  shape is the gate protocol, and it changed because of a measured property of
  resumability, not to make a lane pass.
- **`pnpm check` was not lowered.** It is exactly 267, as inherited.
