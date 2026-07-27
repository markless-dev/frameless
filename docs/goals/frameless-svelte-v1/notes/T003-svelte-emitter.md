# T003 — `packages/frameworks/svelte`, and the four measurements it rests on

Everything below was **measured** against the version this package resolves —
`svelte@5.56.8`, on the `^5.56.1` line T001 recorded — in a real Chromium via
Playwright, or in-process via `svelte/compiler`. Gate 1 records FAIL for
documentary-only evidence once a build of the framework is in the lockfile, and
this package is what puts Svelte there.

## Measurement 1 — the two delegation questions

Svelte 5 delegates `click` to the root and **simulates** propagation, so both of
T002 ruling 4's questions had to be answered behaviourally before the emission
form could be chosen.

Triangulated on two variables: one **product** variable (`preventDefault()`
present or absent) and one **instrument** variable (the delegated `onclick=`
attribute form versus `on()` from `svelte/events`).

| emission form | `preventDefault()` | Document requests, before → after clicking `[data-action="cancel-submit"]` (`<button type="submit">`) | navigated |
| --- | --- | --- | --- |
| `onclick=` (delegated) | yes | 1 → 1 | **no** |
| `onclick=` (delegated) | no  | 1 → 2 | yes |
| `on()` (direct)        | yes | 1 → 1 | **no** |
| `on()` (direct)        | no  | 1 → 2 | yes |

**Q1 — does `preventDefault()` in a delegated handler avert the real GET
navigation? YES.** The signal tracks the *product* variable and is completely
insensitive to the emission form. The negative-control cell proves the
instrument can see a navigation, so the "no" cells are not a green vacuum.

**Q2 — does a delegated handler on the `<form>` observe the click bubbled from
the button? YES.** The form's handler ran with `event.target.dataset.action ===
'submit'` matching, `event.eventPhase === 3` (`BUBBLING_PHASE`), and ordering
button-handler-then-form-handler — identical to native bubbling, and identical
under `on()`.

Re-run afterwards on the **real emitted `generated/S3.svelte`**, not a
replica: `Q1_documentRequestsAfterCancelSubmit === 1`, trace
`['submit', {writes: 2}]` then `['bubble', {source: 'form'}]`, `[data-writes]`
reading `2`. The negative control was the same artifact with
`event.preventDefault();` removed (the removal asserted to have changed the
source): 1 → 2 document requests.

S1 and S2 were driven the same way: S1's derived went `L:3` → `L:6` on one
increment; S2 survived add / edit / toggle / remove / reorder with keyed rows
intact. **Zero console messages of any level** across all three.

**This CONFIRMS the Judge's dissent** on `preventDefault`: a delegated listener
is in the bundle and runs during dispatch, unlike a lazily fetched QRL, so the
Qwik failure does not transfer. The dissent's other half — that the attribute
form is more likely *wrong* for `stopPropagation` — remains **untested**, and
deliberately so: the corpus has zero instances, so the emitter throws instead
(T002 ruling 4).

**Emission form adopted: the delegated `onclick=` attribute, for every event,
never mixed with `on()`.**

## Measurement 2 — `state_referenced_locally` fires on the IR's own policy

`ComponentEvaluationPolicy.ordinaryLocals` is `once-per-instance`. Emitted
naively, *every* such read raises `state_referenced_locally` — S1's `label`, S1's
`onTrace`, S2's `seed`, S3's `initial` — in both `client` and `server`
generation. Wrapping in `untrack(() => …)` clears it, which is the **same
lowering the Solid emitter already uses for the same policy**. Not a
suppression: a semantic statement of the declared lifetime.

## Measurement 3 — template whitespace, and why the layout looks the way it does

Naively-indented markup does **not** compile away. Server-rendered, sibling
indentation survives as a single space:

```
indented  …<output …>D</output> <button …>increment</button>…
flat      …<output …>D</output><button …>increment</button>…
```

JSX drops whitespace-only lines entirely, so indenting the Svelte template would
make its text content diverge from the React and Solid lanes — an
activation-neutrality problem, discovered before T004 rather than during it.

Whitespace at the **start or end** of a parent's children *is* trimmed. The
printer therefore moves each line break to just before the previous chunk's
final `>`, inside the tag, where it can never become a text node — the
`</output⏎\t><button` idiom. Server-rendering the resulting layout is
**byte-identical** to server-rendering the same template with every line break
removed, and a naively-indented variant differs, so the check is two-sided.

Two consequences, both load-bearing:

- **Void elements are emitted as `<input>`, never `<input />`.** A `/` separated
  from its `>` is not a self-closing start tag; it is a **parse error**, pinned
  by a test.
- Gate policy `no-inter-sibling-whitespace` enforces the invariant on the parse
  tree, with a mutation row.

## Measurement 4 — a redundant `svelte-ignore` is invisible

Svelte reports nothing for an unnecessary `svelte-ignore`. So "the emitted source
has zero warnings" cannot distinguish an exactly-calibrated suppression from an
over-firing one.

`emit()` therefore checks **both sides**: the output must compile warning-free,
**and** compiling it with the annotations stripped must yield exactly the set of
codes the emitter chose to suppress. Under-firing and over-firing both throw at
emit time.

The only sanctioned codes are `a11y_click_events_have_key_events` and
`a11y_no_noninteractive_element_interactions`, at `<form>` elements carrying an
event. Both are observations about the **authored** template — the IR puts a
click handler on a `<form>` — which a faithful emitter cannot remove.

## Divergences from the React / Solid / Qwik lanes, recorded rather than discovered

1. **No formatter.** Those three pipe emitted `.jsx` through `oxfmt`. Nothing in
   this workspace parses `.svelte`, and adding `prettier` +
   `prettier-plugin-svelte` was ruled out. The emitter prints deterministic text
   directly; `src/format-emitted.ts` is an **assertion** over that text (LF, one
   trailing newline, no trailing whitespace, tab indentation) rather than a
   rewrite, each clause calibrated with a red row.
2. **Default export.** A `.svelte` module is one component exported as the module
   default, so the IR's *named* `ComponentExport` cannot be honoured by spelling.
   The component name is carried in the generated header.
3. **No eslint lane.** React, Solid and Qwik each gate emitted output with their
   framework's own eslint plugin. `eslint-plugin-svelte` is not in the lockfile.
   The third-party arbiter here is `svelte/compiler`'s own `compile()`, asserted
   as an exact empty warning set.
4. **No `src/adapter.ts`.** Out of scope per T003: nothing consumes it, and a
   fourth copy of the quiescence loop would be drift with no consumer.

## IR-7 — what shipped, and what it cannot see

No purity proof was attempted; that is compiler-wide with no forcing case. What
shipped is a **conservative syntactic reject-list over the emitter's own
output** — gate policy `derived-expression-purity` — rejecting an emitted
`$derived(…)` whose expression contains an assignment, an update expression, a
`delete`, or a call to a method in a named mutating set.

It **cannot see** mutation inside a function the expression *calls*
(`$derived(f())` is accepted whatever `f` assigns), a mutating method the list
does not name, mutation through a computed member access, or a side-effecting
getter. **Sound only as a reject-list: a violation is real, a pass is not a
proof.** Stated in the source, and pinned by a test that asserts the blind spot
rather than leaving it implied.

Calibrated against planted members (assignment, update, `delete`, `.sort()`) and
two anti-vacuity rows: S2's own `$derived(todos.filter(…).length)` stays
accepted, and a planted assignment in a *handler* stays accepted — proving the
walk is scoped to `$derived` arguments and has not degenerated into "reject any
call".

## IR-4

Deferred, version corollary not amended. Every emitted construct is Svelte 5.0
baseline; `emitter.test.ts` pins the absence of `$props.id()`, `{@attach}`,
`<svelte:boundary>` and `$derived.by` — the four with a floor above it — and the
gate rejects the Svelte 4 `on:click` directive spelling.

## The browser lane — dev warnings are now enforced, not merely measured

Initially blocked: `@vitest/browser-playwright` and `playwright` did not resolve
from this package and adding them moved `pnpm-lock.yaml`, a `stop_if`. The PM
installed both offline from the store and cleared it, and the lane now exists:
`vitest.config.ts`, `test/setup.ts`, `test/emitted-smoke.browser.test.ts`,
**13 tests**, wired into the root `pnpm test:browser` chain behind React (60)
and Solid (49).

**T002 finding 7 is now discharged where it can be.** `test/setup.ts` patches
`console.warn` and `console.error` inside the browser and an `afterEach` fails
the test on **any** captured diagnostic — no allowlist, warnings included, not
only errors. All 42 of Svelte 5.56.8's client dev diagnostics go through
`console.warn` (`svelte/src/internal/client/warnings.js`), which is what makes a
console sink the right instrument rather than a hopeful one.

Calibrated in three independent steps, because "no warnings were observed" is
worth nothing unless the observer observes, the assertion throws, and Svelte's
own diagnostics travel the watched path:

1. **The sink captures.** A planted `console.warn` and `console.error` are
   recorded, exactly once each and in order.
2. **The guard throws.** The calibration calls `assertNoConsoleDiagnostics()` —
   the *same function* the `afterEach` hook calls, not a lookalike — and asserts
   it throws.
3. **A real Svelte dev warning reaches it.** `unmount()` is called twice on the
   real emitted `S1`, provoking a genuine `lifecycle_double_unmount` through the
   public API with no fixture file. The assertion is on the **DEV-only message
   shape** (`[svelte] lifecycle_double_unmount`): Svelte's production branch logs
   only the bare `https://svelte.dev/e/...` URL, so this doubles as the proof
   that these components were compiled with dev diagnostics enabled and that a
   green run of this lane means anything at all.

The two delegation measurements are now **standing checks** rather than a
one-off probe. Q1 uses a capturing `submit` listener as the in-browser stand-in
for `assertS3`'s Document-request count: if the emitted `preventDefault()` ever
fails, the form's `submit` event fires, the listener records it *and* cancels it,
so the lane observes the failure instead of navigating away and destroying its
own test context. That observer is calibrated against a planted member — a bare
`<button type="submit">` appended to the emitted form, which nothing cancels —
so Q1's `toHaveLength(0)` cannot pass by being wired to an event that never
fires. Q2 asserts the full trace `['submit', …]` then `['bubble', {source:
'form'}]`, pinning both the cross-element bubbling the corpus depends on and the
button-before-form ordering that makes mixing `onclick=` with `on()` forbidden.

### An instrument fault, caught by its own calibration

The first version of `setup.ts` kept the sink in module scope. Vitest evaluates
a `setupFiles` module in a **different module instance** from the one a test file
gets when it imports the same path, so there were two independent arrays and two
chained `console` patches: every diagnostic was recorded twice, and a test that
drained the sink drained the copy the `afterEach` guard was not reading.

Three calibrations failed immediately and named the cause. This is the board's
recurring pattern exactly — an instrument resting on a silent assumption
("importing my own setup file gives me my own state") that nothing asserted. The
sink now lives on `globalThis` behind a patch-once flag, and the assumption is
asserted: the first calibration checks the captured array has **exactly** two
entries, which is what a double-installed patch would break, and its final drain
is what proves the guard reads the same sink the test drains.

Worth stating plainly: had the calibrations not been there, this lane would have
passed while double-counting diagnostics and while the drain and the guard
disagreed — a lane that looked like enforcement and was not.

### What the demo lane at T004 still owes

This lane covers emitted components mounted directly in a browser. It does **not**
cover the SvelteKit demo, where the witness API still cannot see console warnings
at all. T004 must either land a `console.warn` capture sink in the scaffold or
record in writing that the demo lane cannot observe warnings and that this lane
is the sole enforcement point. Silence is not an option.
