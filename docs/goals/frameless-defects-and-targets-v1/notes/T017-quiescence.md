# T017 — the quiescence instrument

Defect 4. The settle loop bounded **wall-clock time** over a wait gated entirely on
`requestAnimationFrame`. It now bounds **settle ticks**, and wall clock survives only
as a runaway guard. All three adapters moved together, and the loop ships with a
two-sided calibration.

---

## 1. What was wrong, in one paragraph

`stable >= 2` needs three rAF deliveries. rAF's contract is *ordering* — "before the
next repaint" — and never a **rate**. An engine that never composites owes no repaint
and therefore no callback on any schedule. So `performance.now() + 500` silently
encoded a sustained frame-rate floor of roughly 4 fps that no specification provides.
Worse than a wrong number: while the loop was parked on `await new Promise((r) =>
requestAnimationFrame(...))`, the wall-clock check at the top of the `while` could not
run at all. On an engine that delivers no frames the loop did not fail — it **hung**.

## 2. The witnessed failure, in-repo

Run against the **unmodified** adapters, before any `src/` change, with the calibration
already written. Chromium, both lanes, identical results:

| calibration test | react (pre-repair) | solid (pre-repair) |
| --- | --- | --- |
| resolves on a DOM that quiesces | pass | pass |
| throws on a DOM that never quiesces | throws, but `…within 500ms` | throws, but `…within 500ms` |
| **resolves at a starved 300ms frame cadence** | **`Error: Observable DOM did not quiesce within 500ms`** | **same** |
| resolves when the compositor never delivers a frame | **`Test timed out in 15000ms`** | **same** |
| the wall-clock runaway guard still fires | **`Test timed out in 15000ms`** | **same** |

Row 3 is the **verbatim CI error** from `findings-005`, reproduced on Chromium by
slowing frame cadence alone, at `src/adapter.ts:77`. Rows 4 and 5 are the stronger
result and were not previously on record: with no frames at all the old loop did not
report anything, it hung until the runner killed it. T006 measured the *tolerance*
(passes at 240ms/frame, fails at 260ms); this pins the *limit case*.

Row 2 also establishes that the churning fixture is a genuinely non-quiescing DOM
rather than a fixture that merely fails to be observed: the old loop threw on it too.

## 3. What the loop now bounds

```
SETTLE_TICK_BUDGET     30   ticks — the bound
SETTLE_STABLE_TICKS     2   unchanged settle semantics: three equal snapshots
SETTLE_TICK_FALLBACK_MS 50  the delivery-contracted floor of one tick
SETTLE_RUNAWAY_MS     2000  runaway guard only
```

**Ticks**, because ticks are the quantity the loop actually consumes. One tick is
`Promise.race`-shaped: a frame when the compositor delivers one, and a **macrotask
turn** regardless. The HTML event loop contracts to run a queued task; the animation
frame callback is explicitly skippable. rAF is therefore *raced, never awaited* — it
wins on an engine that composites and is ignored on one that does not, so the loop can
no longer be parked on a promise the engine owes on no schedule.

`30 × 16ms ≈ 480ms` — deliberately the same work the old 500ms budget bought on a
60fps engine. This is **not** "raise the bound", which T007 rejected: the number did
not grow, the *unit* changed from one the engine does not guarantee to one it does.

**The runaway guard.** Wall clock is retained and checked once per tick, but it can
only ever be reached now, because every tick is guaranteed to complete. It catches the
case a tick bound cannot: a page whose timers are themselves clamped, where 30 ticks
would take half a minute. It is *not* the primary bound, and on a healthy engine the
tick budget always fires first (30 × 50ms = 1500ms < 2000ms even with no frames at all).

A main thread that is genuinely wedged still runs no JS at all, so no in-page guard can
fire; the runner's own test timeout remains the backstop for that case. Recorded so the
guard is not read as promising more than it does.

## 4. The calibration is two-sided

`react/test/calibration.browser.test.ts` and `solid/test/calibration.browser.test.ts`,
five tests each, all green post-repair (react 55 → 60, solid 44 → 49, nothing
pre-existing regressed).

- **passes on a DOM that settles** — the plain case, plus the same case at 300ms/frame
  and at no frames at all.
- **throws on a DOM that never settles** — a component that mutates its own `<output>`
  from a self-rescheduling macrotask, forever. Observed throw:
  `Observable DOM did not quiesce within 30 settle ticks`.
- **throws when ticks themselves are clamped** — frames stubbed off and the loop's own
  50ms floor clamped to 1000ms. Observed throw:
  `Observable DOM settle hit the 2000ms runaway guard after 2 tick(s)`.

The churner is the component's **own behaviour**, not external DOM surgery on a
framework-owned tree — the discipline the mutant table in the same file already states.

## 5. All three adapters, verifiably together

The settle block is **byte-identical** in all three files
(`sha256` of the text from `// SETTLE LOOP` to EOF, 2554 bytes each):

```
react f2420e4ab9fc2bd8…
solid f2420e4ab9fc2bd8…
qwik  f2420e4ab9fc2bd8…
```

To get there, `solid` and `qwik` gained the `flush` parameter `react` already had, and
pass `() => Promise.resolve()` — the microtask their loops previously inlined. That is
the only call-site change, and it is what makes the three copies textually identical
rather than merely equivalent, so drift is now a one-line diff to detect.

## 6. Two things this does not close, recorded rather than assumed

- **The Qwik adapter has no test lane at all.** `createQwikAdapter` is exported from
  `packages/frameworks/qwik/src/index.ts` and has zero consumers in the repo: no browser
  project, no node test, no demo. Its repair rests entirely on byte-identity with the two
  copies that *are* calibrated. That is a real coverage gap and it predates this task.
- **Whether the CI WebKit incident had this cause is still open, by design.** T007 §3
  ruled the `continue-on-error` flag is the adjudicating instrument, so it was not
  touched and `.github/workflows/ci.yml` was not edited. Its comment block already
  points at this repair and states the removal gate.

**Prediction, stated before the cell runs.** The ubuntu WebKitGTK `browser-engines`
cell should now go **green**, on the reading that the CI failure was frame starvation
on a port that does not composite headlessly. If it stays red, that is the *useful*
outcome: a tick-bounded loop that still cannot reach three equal snapshots — or that
reaches them over a different `innerHTML` — is evidence of a genuine engine divergence,
which is precisely reading 2 and precisely what T006 could not exclude. Either way the
cell now answers the question instead of restating it. The distinguishing signature is
in the error text: `within 30 settle ticks` means the DOM genuinely kept changing on
WebKitGTK; `runaway guard` means its timers are clamped; anything else means the
divergence is in the assertions, not the settle loop.
