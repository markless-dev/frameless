# T022 — the three `continue-on-error` flags, made honest

Worker package for `frameless-defects-and-targets-v1`. Oracle half 1's only unmet
bullet was the `qwik-throttled` flag, whose justification evaporated when the
owner overturned finding 2. This note records what was measured, because two of
the three outcomes here are *numbers*, and a number without its measurement is
the exact fault finding 4 was.

Every CI figure below was read from `gh api .../actions/jobs/<id>/logs`. Status
fields were not used and are not usable: T009 proved GitHub reports
`conclusion: success` for a **failed** `continue-on-error` **step**, not merely a
failed job.

---

## 1. `qwik-throttled` — rescoped, flag OFF

### What it used to measure

`demos/qwik/throttled-resume.mjs` loaded with `waitUntil: 'domcontentloaded'`
and clicked immediately afterwards — before any framework installs listeners. The
assertion was therefore not "Qwik drops clicks under throttling" but "is this page
interactive with no JavaScript executed yet", which answers **no** in every
framework. React and Solid are never held to it: `waitForInteractive` in
`demos/react-official/three-way-contract.ts` blocks them on the activation marker
first. The asymmetry belonged to the harness.

### What it measures now

The click fires only after **Qwik's own** report that the container has resumed:

```js
await page.waitForFunction(
  () => document.documentElement.getAttribute('q:container') === 'resumed',
  undefined,
  { timeout: 30_000 },
)
```

`q:container="resumed"` is set by `@qwik.dev/core` once container state is
deserialized (`dist/core.mjs`, `setAttribute(QContainerAttr, "resumed")`), and it
is the same attribute the three-way contract already asserts as resume evidence.
It is deliberately **not** a browser lifecycle event, a fixed sleep, or
`networkidle` — each of those would be a second silent proxy replacing the one
this rescope removed.

Deciding this empirically mattered, because the obvious worry was that Qwik only
initializes its container in response to an event, which would make the gate
deadlock. Probed on the production build: it does not. The container reaches
`resumed` **with no user interaction at all** — `+291 ms` unthrottled, `+2197 ms`
under 300 ms / 400 kbit, in a probe that polled every 250 ms and never clicked.

### Result: the rescoped lane PASSES under real throttling

Production build (`pnpm --dir demos/qwik build`), `vite preview` on 5175,
chromium via CDP `Network.emulateNetworkConditions` at 300 ms latency /
400 kbit down:

| run             | time to `resumed` | outcome                       |
| --------------- | ----------------- | ----------------------------- |
| control (0 ms)  | **21 ms**         | pass, exit 0                  |
| throttled #1    | **1591 ms**       | pass, exit 0                  |
| throttled #2    | **1588 ms**       | pass, exit 0                  |
| throttled #3    | **1592 ms**       | pass, exit 0                  |
| throttled #4    | **1592 ms**       | pass, exit 0                  |

The control was run **first**, as required: an unproven instrument makes any
throttled result meaningless. Spread across the throttled runs is 4 ms — this is
not a marginal pass.

So the stop_if branch — "if the rescoped lane still fails under 300 ms/400 kbit,
that is a genuine finding, report it verbatim and leave the flag on" — **was not
taken**. There is no slow-link finding hiding behind this flag. The flag is off
and the step is now a normal required step: a red there is a real finding, which
is precisely what the flag was preventing anyone from ever seeing.

### The gate was calibrated two-sided before the flag came off

A gate that cannot fail is worth nothing, and this board has three vacuous greens
on record. With the container's scripts blocked via `context.route('**/*.js', …
abort)`, `q:container` stays `paused`, the wait throws, and the script exits 1.
Verified before unflagging. (The calibration was run as a scratch probe and not
checked in — `demos/qwik/throttled-resume.mjs` was the only file in this
package's write scope under `demos/`.)

### Assertions added while rescoping

Two silent preconditions were removed rather than left in place:

- the server-rendered value `kit:2` is now asserted against the **served bytes**,
  alongside the paused-container check, instead of being read off the live DOM
  where a fast connection could have resumed first;
- after the gate fires, the DOM is checked to still read `kit:2` — resumption
  must not clobber the state it inherited. This is a new claim the old script did
  not make.

`waitUntil: 'domcontentloaded'` survives on the `goto` call, and a comment says
why: it decides only when `goto` *returns*, nothing is asserted or clicked
between it and the gate, and the cheapest return is the right one.

---

## 2. Windows — timeout raised on a measured basis, flag STAYS

### The measurement

All eight samples, from the `windows-latest` / node 24 logs of four consecutive
post-fix runs in which neither `format-emitted.test.ts` copy changed at all:

| run       | cell  | react   | solid   | vs the 5000 ms default |
| --------- | ----- | ------- | ------- | ---------------------- |
| `e04b823` | RED   | 6747 ms | 7143 ms | +34.9% / +42.9%        |
| `dfa9350` | green | 4139 ms | 4339 ms | −17.2% / −13.2%        |
| `0cf937b` | RED   | 5150 ms | 5214 ms | +3.0% / +4.3%          |
| `39c8a6d` | green | 4504 ms | 4706 ms | −9.9% / **−5.9%**      |

macOS on this tree, same tests: **602 ms** (react) and **605 ms** (solid). So
Windows costs 6.9–11.9×, the run-to-run spread on Windows alone is 1.73×, and the
cell was decided by nothing except whether both tests beat 5000 ms.

T009 reported this range as 4143–7149 ms. The logs say **4139–7143 ms**. The
difference is immaterial to every conclusion, and is corrected here only because
this note is where the numbers now live.

### What the log shape additionally shows

6747 ms and 7143 ms were **reported as durations**. The deadline therefore never
truncated the work — `execFileSync` blocks the thread, so the verdict lands after
it returns. 5000 was never functioning as a runaway guard; it was an unstated
claim about how long a Windows spawn takes, and the claim was wrong by up to 43%.

### The number, and why it is that number

`SPAWN_TIMEOUT_MS = 30_000`, applied per-test to the `vp fmt` test in both copies
(the sibling parse-error test runs in 1 ms in-process and keeps the default —
giving it a 30 s budget would only weaken it).

- **4.2×** the worst observed sample (7143 ms);
- above worst-observed × observed-spread (7143 × 1.73 ≈ **12.3 s**), with room
  left for a cold or contended runner;
- **~50×** the macOS sample;
- still a real guard — a genuinely stuck toolchain fails the test — and far
  inside the job's 15-minute budget.

It bounds a **subprocess spawn**, which *is* a wall-clock quantity. This is not
the move finding 4 rejected: there, wall clock was proxying a frame-gated loop
with no rate guarantee, so no number was correct. Here the unit is already right
and only the value was wrong.

### Gate restated

The old gate — "an **observed** green `windows-latest` / node 24 cell" — is
**insufficient**, because the cell is a coin flip. The new gate, in order:

1. the timeout raised on a measured basis — **done**, and justified in-file;
2. **then three consecutive** green cells, with the two `vp fmt` durations **read
   out of each log** and sitting far below the new bound.

Three, because under the observed pre-fix distribution one green had p≈0.5 and
three in a row p≈0.125 — the first discriminates at 1:1, the third at better than
8:1. Reading the durations is what separates "fixed" from "got lucky thrice": the
last green looked perfectly healthy and had 5.9% of headroom.

**The flag value is untouched.** Cause A's fix is functionally correct but
timing-marginal, and it has never been observed with margin.

---

## 3. WebKit — comment corrected, flag STAYS

The old gate — "an observed green webkit cell **after** the T017 quiescence
repair lands" — is **non-discriminating**. T009 traced 30 runs: the cell was
already green for **five consecutive runs before T017** (`cd34186`, `ef59d55`,
`72a09de`, `e04b823`, `dfa9350`) with no adapter change. A gate the *unrepaired*
adapter passes five times running cannot certify the repair.

All eight observed reds cluster in two windows of rapid concurrent runs,
consistent with CPU contention starving frames. That corroborates T017's
mechanism and simultaneously disqualifies quiet-window greens as evidence. All
three post-repair greens are quiet-window greens, so T017's distinguishing
signatures (`within 30 settle ticks` versus `runaway guard`) have never been read.

**New gate:** a green webkit cell observed under the **contention conditions that
produced the reds**. **The flag value is untouched**; it remains the adjudicating
instrument for the engine-divergence reading, which is formally unexcluded.

### The scope claim in finding 4 was too narrow, and it was verified here

`docs/DEFECTS.md` presented this as one failing test (`adapter-input`), inherited
from the first observation. The **last** observed red — run `30229046866`, sha
`3ff85ad`, `2026-07-27T01:09` — failed two *different* tests in two *different*
files, and `adapter-input` was neither:

```
FAIL  react-browser (webkit)  test/action-order.browser.test.ts
  × S3-event-form (order seed 1)                       797ms
FAIL  react-browser (webkit)  test/composition-emitted-smoke.browser.test.ts
  × C2-shared-propagation                              697ms
##[error]Error: Observable DOM did not quiesce within 500ms   (x2)
2 failed | 5 passed (7)
```

Read from the job log directly rather than taken on report. Same error, same
loop, arbitrary victims — which is what a shared instrument fault looks like, and
is stronger corroboration than a single repeatable test would have been.

---

## What generalises

The two flags that stay both had gates that were **met literally while the thing
they stood for was false**. A removal gate is itself an instrument, and an
uncalibrated instrument lies in exactly the way the six findings did. Rule 4 from
T009 — calibrate a verdict-issuing instrument against a known member; establish a
cell's variance before treating a green as a verdict — applies to the gates as
much as to the harnesses they guard.

The `qwik-throttled` outcome is the counter-example that keeps this honest: its
gate *was* discriminating, the rescope met it, the lane passes with a 4 ms spread
across four throttled runs, and the flag came off.
