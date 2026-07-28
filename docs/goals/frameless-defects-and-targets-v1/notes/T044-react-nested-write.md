# T044 — React emitted a nested state write as an assignment to a `const`: witnessed, then refused

Worker, 2026-07-27. Board: `docs/goals/frameless-defects-and-targets-v1/state.yaml`.
Dispatched at `f2d8aaf`, 968 tests, tree clean. Spec: T031 receipt FINDING 2 and
`notes/T031-corpus-s8-async.md` §2.4.

## 0. Headline

**The defect was re-derived from scratch, not inherited, and it is exactly as
T031 reported it.** Verbatim from this repo's own `typescript@5.9.3`, over output
this session's emitter produced:

```
nested-then.jsx(16,7): error TS2588: Cannot assign to 'ticks' because it is a constant.
nested-then.jsx(17,7): error TS2588: Cannot assign to 'nextPhase' because it is a constant.
nested-callback.jsx(14,7): error TS2588: Cannot assign to 'ticks' because it is a constant.
```

**It has nothing to do with async.** `nested-callback` is
`defer(() => { ticks = ticks + 1 })` — no promise, no `.then`, no `async`
anywhere. The trigger is **nesting**.

**The repair is a refusal, and only a refusal.** `assertLowerableWrites` throws a
named error. No lowering was implemented; the card forbids it and Solid already
does it correctly, so a later ruling can port a proven approach.

**The test went RED before the fix, for the right reason** — the `TS2588` above
*is* the failure text (§2). 968 → 975 tests, all green, tree otherwise untouched.

## 1. What was measured, and how

A probe outside the repo (scratchpad only) built the enriched IR from three
authorings and ran each through `emit()` + `formatEmitted()` — the exact call
`packages/frameworks/react/scripts/regenerate.ts` makes — then type-checked the
emitted string with `typescript@5.9.3` under the **same compiler options
`emitted-typecheck.test.ts` uses**, so the oracle is the one this repo already
trusts over `generated/`.

| authoring                                            | before T044                     | after T044 |
| ---------------------------------------------------- | ------------------------------- | ---------- |
| `settle().then(() => { ticks = ...; phase = ... })`   | **emitted, `TS2588` × 2**       | refused    |
| `defer(() => { ticks = ... })` — no promise           | **emitted, `TS2588` × 1**       | refused    |
| the same writes at the **top level** (control)        | clean, lowers to `setTicks(...)` | unchanged  |

The pre-fix React output, verbatim:

```jsx
onClick={(event) => {
	const nextPhase = 'pending';
	setPhase(nextPhase);
	settle().then(() => {
		ticks = ticks + 1;
		nextPhase = 'done';
	});
	onTrace('run', event);
}}
```

Two separate defects in five lines:

1. `ticks = ticks + 1` was **never lowered**. `emitMutableHandler` iterates
   `fn.body.body`, the top-level statements, so a nested write was never a
   candidate. It reached output verbatim, assigning to the `const` that
   `useState` destructured.
2. `nextPhase = 'done'` is worse. `toConstSsa` → `replaceVersionReads` rewrote
   the nested write **target** as if it were a version **read**, renaming `phase`
   to `nextPhase`, then froze `nextPhase` with `const`. The emitter
   **manufactured** an assignment it had just made impossible.

Runtime consequence, which the type error understates: the setter is never
called, so **React never re-renders**. The component looked plausible and did
nothing.

## 2. Proof before fix — the witnessed failure

The tests were written and run **before** the emitter was touched. Four red, and
the first two failed on the `tsc` output rather than on a missing throw:

```
FAIL > a state write it cannot lower is refused, not miscompiled >
     nested-then: the emitter either refuses it or emits output tsc accepts
AssertionError: expected [ …(2) ] to deeply equal []

- []
+ [
+   "nested-then.jsx(16,7): error TS2588: Cannot assign to 'ticks' because it is a constant.",
+   "nested-then.jsx(17,7): error TS2588: Cannot assign to 'nextPhase' because it is a constant.",
+ ]

FAIL nested-callback: the emitter either refuses it or emits output tsc accepts
+   "nested-callback.jsx(14,7): error TS2588: Cannot assign to 'ticks' because it is a constant.",

FAIL the refusal names the write, the enclosing function, and the consequence
AssertionError: expected null not to be null

FAIL the plain callback prop is refused too - the defect is nesting, not promises
```

**The invariant asserted is the one that survives the repair**, which is why the
first two rows are permanent tests rather than a scaffold: *the emitter may
refuse a construct, and it may emit a construct, but it may never emit a
construct `tsc` rejects.* A refusal satisfies it. A silent miscompile does not.
The day someone lowers nested writes correctly, those rows go green through the
**other** branch with no edit.

In the same run and unchanged by the fix, two rows were **green from the start**:
the top-level control, and the sweep proving the guard fires on **nothing** in the
shipped corpus.

## 3. The repair

`assertLowerableWrites`, in `packages/frameworks/react/src/emitter/index.ts`,
called from `emitMutableHandler` **before** the renaming pass — so the diagnostic
carries the **authored** state name, not an SSA version the author has never
seen. It walks the handler's unresolved references, keeps those that are write
targets (including the root of a member chain, so `rows[0].label = x` is covered),
and throws when one sits inside a nested function scope.

The message, verbatim, on the `.then` authoring:

```
React emitter cannot lower the state write to "ticks" in event:0: it is inside the
function passed to settle().then(...), and write-lowering rewrites ONLY the top
level of a handler body. Emitting it would copy "ticks = ..." through verbatim, as
an assignment to the const that useState destructured - which tsc rejects (TS2588
"Cannot assign to 'ticks' because it is a constant") and which would not re-render
even if it ran. Move the write to the top level of the handler body. Nested writes
DO lower correctly in the Solid emitter; porting that is a design change this
refusal deliberately does not make. See docs/DEFECTS.md entry 8.
```

Three things it carries deliberately, per the T033/T039 precedent: **the write**,
**the enclosing function** (`settle().then(...)` vs `defer(...)` — a handler can
have several callbacks and "somewhere nested" would teach nothing), and **what
would otherwise have happened**, quoted by its `tsc` code. The failure mode was
silence; a bare throw would have replaced silence with a shrug.

Each of those three is asserted by a test, so the message cannot decay into a
bare throw without going red.

## 4. Calibration — an instrument that cannot fail is not an instrument

This guard fires on **zero** handlers in the shipped corpus. That makes its
planted-violation calibration the only thing making it real, exactly as with the
T039 whitespace v-limit.

- **Fires on the planted case:** two authorings, watched red pre-fix (§2), green
  post-fix through the refusal branch.
- **Fires on nothing else:** every ratified scenario golden **and** every
  composition fixture is re-emitted through the guard in a standing test. Not by
  inspection, and not by trusting that `pnpm test` would have noticed — the sweep
  is its own assertion. The fixture list is the derived one, so a scenario added
  later is swept with no edit.
- **Fires on nothing in the whole tree either.** A wider one-off sweep — **all 61
  tracked `.tsrx` files** in `packages/`, `demos/` and `poc/`, through
  `buildEnrichedIr` + `emit` — reports **GUARD FIRED: 0**. 53 emit clean; the
  other 8 throw for **pre-existing, unrelated** reasons (deliberately-broken `poc`
  graph fixtures, and `poc/08` wrappers that need tsrx-module resolution), none of
  them this guard's message. So the shipped corpus and the shipped demos are both
  clear, and the stop_if about firing on an existing handler did not trigger.
- **The negative control still lowers:** the same writes at the top level still
  produce `setTicks(...)` and no bare `ticks = `.
- **No golden moved.** `regenerate.ts` was run **twice** and
  `git diff --exit-code -- packages/frameworks/react/generated` was empty both
  times. The current corpus contains no nested write, so a correct repair is
  invisible to it — which is precisely why the planted case was mandatory.

## 5. Scope — what was deliberately NOT done

- **No nested-write lowering.** Out of scope by ruling. Solid does it correctly;
  porting that is a design change and belongs to T043.
- **`replaceFreeNames` / the `await` re-parse (`index.ts:161`) was not touched.**
  T031 ruled that repairing that **loud** symptom before this **silent** one would
  make the silent one harder to find. It is still there, still loud.
- **No other lane was touched.** The Angular silent-`async` finding from the same
  T031 sweep is more serious than this one by T031's own ranking and is **not**
  filed in `docs/DEFECTS.md` here — it awaits T043, and filing it from this card
  would be pre-empting a ruling.
- **No fixture, no golden, no `generated/`, no demo, no contract, no budget row.**
  S8 still does not exist; this card removes one of the two lanes blocking it, not
  both.
- **`pnpm mutate:corpus` was not run**, per the card: it restores with
  `git checkout --` over `MUTATION_SURFACE` and is unsafe on a shared tree.
- **No commit.**

## 6. Verification

| command                                                                                              | result |
| ---------------------------------------------------------------------------------------------------- | ------ |
| `pnpm test`                                                                                          | 975 passed / 50 files (968 at dispatch + 7 new) |
| `pnpm check`                                                                                         | pass   |
| `pnpm lint`                                                                                          | pass   |
| `node packages/frameworks/react/scripts/regenerate.ts` + `git diff --exit-code -- .../react/generated` | clean, **run twice** |
| `git diff --exit-code --` the five other lanes, `packages/compiler`, `demos`, `scripts`               | clean  |
| `git status --short`                                                                                 | only the four files below |

Changed: `packages/frameworks/react/src/emitter/index.ts`,
`packages/frameworks/react/test/emitter.test.ts`, `docs/DEFECTS.md`, and this
note.

## 7. Parallel safety

`git status --porcelain` and `git log -1` were checked at the first command of
this session — clean, `f2d8aaf` — and again at the last. No other test runner was
live: the only node processes touching this repo were LSP servers, an esbuild
daemon, a `docs:serve` and a `vite preview`, none of which writes to the tree. The
PM's "nothing else running" was verified rather than trusted, as T030's experience
warranted.

## 8. What the PM still owns

Nothing on this card, but two things it deliberately leaves standing for **T043**:

1. **Whether React should LOWER nested writes** rather than refuse them, and
   whether Solid's approach ports. Until that ruling, `docs/DEFECTS.md` entry 8 is
   **OPEN** with a lift trigger, not closed.
2. **The Angular silent-`async` finding**, which T031 ranked *above* this one and
   which nothing in this repo currently detects. It is unfiled and unrepaired.
