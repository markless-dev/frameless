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

## THE GAP — the browser lane could not be built

`packages/frameworks/svelte/vitest.config.ts` and
`test/emitted-smoke.browser.test.ts` are **not** in this diff. Vitest browser
mode needs a provider package, and neither `@vitest/browser-playwright` nor
`playwright` resolves from this package:

```
@vitest/browser            -> MISSING
@vitest/browser-playwright -> MISSING
playwright                 -> MISSING
```

Adding them as devDependencies moves `pnpm-lock.yaml`, which T003 lists as a
`stop_if`. Writing the config anyway would also turn `pnpm check` red, because
the root `tsconfig.json` includes `packages/frameworks/*/vitest.config.ts` and
the import would not resolve.

Both versions are already in the pnpm store (`node_modules/.pnpm/playwright@1.58.2`,
`…/@vitest+browser-playwright@4.1.5`), so `pnpm install --offline` needs no
network.

**Consequence for T002 finding 7.** The vitest browser lane was designated the
*sole* enforcement point for Svelte dev warnings, because the witness API cannot
observe console warnings at all. That lane does not exist yet. The dev-warning
evidence recorded here — zero console messages of any level, driving all three
emitted components — is a **measurement, not a standing check**. Until the lane
lands, nothing in CI enforces it, and T999's constraint would still pass
vacuously. This is the single largest gap in T003.
