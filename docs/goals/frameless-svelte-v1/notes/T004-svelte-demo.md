# T004 — demos/svelte-official and the Svelte e2e row

Status: **BLOCKED on one assertion.** Everything the task asked for is built and
green except S3's `value`-attribute observation, which cannot be made equal from
inside `allowed_files`. Root-caused, and the repair is proven — see
[The blocker](#the-blocker).

---

## 1. Demo shape (T002 ruling 1)

`demos/svelte-official` is the stock `sv@0.16.6` SvelteKit app. No `server.js`,
no `ssr-handler.js`, no express, no `frameless-demo-ssr` vite plugin —
`sveltekit()` renders on the server in dev and `pipeline.dev()` starts exactly
that server, following the `demos/qwik` precedent.

The contract protocol matches the other three: `scenarios.box.ts` imports
`../react-official/three-way-contract.ts`, runs `assertServedActivation` +
`runScenario` over `scenarioIds`, emits the `three-way-results` JSON note under
the `three-way` tag, has a `copy-emitted` script, and has a row in
`officialDemos` in `scripts/e2e.mjs`.

Routes: `src/routes/+page.svelte` (S1), `s2/+page.svelte`, `s3/+page.svelte`.
Props live in `src/lib/scenario-props.ts` and are byte-identical to the values
`demos/react-official/src/App.jsx` and `demos/qwik/src/routes/**` pass.

**T002's three named costs are real and are carried, not rediscovered.** Emitted
components are wired through SvelteKit's route conventions, so a convention
change breaks this lane where react/solid are immune. There is no shared
`createSsrHandler`, so react-official's "no second harness exists to drift"
property is unobtainable — reached differently here, by there being only one
handler at all, SvelteKit's own. And `modes: ['dev']` means the vite build +
adapter path is never exercised, identically to qwik.

## 2. The served-payload literal (T002 ruling 2)

Measured, not guessed. `vite dev` serving `/` at `@sveltejs/kit` 2.70.1 (the
resolution of the scaffold's `^2.63.0`) emits an inline bootstrap that does:

```js
Promise.all([
  import("/@fs/.../node_modules/@sveltejs/kit/src/runtime/client/entry.js"),
  import("/@fs/.../demos/svelte-official/.svelte-kit/generated/client/app.js")
]).then(([kit, app]) => { kit.start(app, element, { ... }) });
```

The chosen literal is `@sveltejs/kit/src/runtime/client/entry.js` — SvelteKit's
own client entry, the direct analogue of react's and solid's
`/src/entry-client.jsx`, and machine-independent (the `/@fs/` prefix is not part
of the literal).

**All four of T002's conditions are met:**

1. **Required, not optional.** `servedClientEntry` is a *total*
   `Readonly<Record<HydrateFramework, string>>`. Adding a framework to the
   hydrate arm without adding its literal is a compile error. No `?`, no `??`,
   no default. *Deviation from the letter of condition 1 — see §6.*
2. **Measured**, above.
3. **Shown able to go red.** `calibrateServedClientEntry` runs on every
   scenario of every run and is two-sided: the positive arm runs the same
   predicate the assertion runs, and the negative arm mutates the *evidence* —
   it deletes every occurrence of the entry from the payload the server really
   sent and requires the predicate to reject it. If SvelteKit ever stops serving
   that module, or serves a bundled chunk instead, the lane goes red.
   It does not route the deliberate failure through `expect.response.matches`,
   because a caught expectation failure still records a permanent
   `assertion failed` statement and flags the box *contested*.
4. **Marker set imperatively in `onMount` in the root `+layout.svelte`.** Not
   `hooks.client.ts` init, not a template binding.

**T002's dissent on `onMount` ordering is now evidenced.** Svelte flushes mount
effects child-first and the page renders *into* the layout via
`{@render children()}`, so the root layout is the last mount in the tree. Across
three routes, every server-rendered assertion between the marker appearing and
the first click passed, with no settle delay anywhere in the lane. No flake was
observed in any run.

## 3. Navigations — measured, declared, still exact

**SvelteKit records 1 navigation on initial load, like Qwik.** Measured from the
witness receipt:

```
url http://127.0.0.1:5173/   navigations [{"url":"http://127.0.0.1:5173/"}]   Document requests = 1
```

Same URL, one Document request: this is `kit.start` adopting the initial history
entry, not a reload. The permitted repair was applied — a per-demo **declared**
count in a total `expectedNavigations` record, still asserted exactly. It was
**not** relaxed to "any number", which matters most here: a Svelte reload would
also present as a navigation, and only an exact count separates "the router
adopted the page" from "the page reloaded under us". React 0, Solid 0, Qwik 1
are byte-unchanged from the old `resume ? 1 : 0`.

## 4. Dev warnings — a sink was landed, with its limits stated

T002 finding 7 offered two options. **The sink was landed**, in
`src/hooks.client.ts` — the only scaffold addition beyond wiring.

The witness API cannot observe `console.warn` at all (`PageOutcomeExpectation`
exposes `consoleErrors` only; `PageHandle` has no console accessor), and Svelte
reports `ownership_invalid_mutation` and `state_unsafe_mutation` as warnings. So
the sink patches `console.warn`/`console.error` in the page at module scope of
the client hooks — before `kit.start` mounts, so hydration-time warnings are
caught — and reflects its state onto `<html>`:

| attribute | meaning |
| --- | --- |
| `data-frameless-dev-sink` | `calibrated` or `uncalibrated:<counts>` |
| `data-frameless-dev-diagnostics` | count, decimal string |
| `data-frameless-dev-diagnostic-1st` | first message, sanitized |

`assertNoDevDiagnostics` in the box reads all three back through the contract's
own `measureAttribute` and asserts **sink first, count second** — a count of
zero from an uninstalled sink means nothing. A missing attribute throws out of
`measureAttribute` rather than reading as clean.

**Instrument rule 2 and 3, both.** At install the sink plants one `warn` and one
`error` through the patched console and requires each captured *exactly once* —
non-installation fails the capture, double-installation fails the count, which
is the precise fault T003 caught in its own setup file — then drains. Only then
does it write `calibrated`. The two probes deliberately do not reach the real
console: the error one would otherwise land in witness's `consoleErrors` ledger
and fail the `consoleErrors: 0` expectation the shared contract already asserts.

Observed on every scenario: `sink calibrated with 0 dev console diagnostics`.

**What the sink still cannot see, stated so it is not read as total coverage:**
compile-time Svelte warnings (`state_referenced_locally` and friends) go to the
dev server's terminal, never to `window.console`. Those remain enforced by the
`compile()` empty-warning oracle in `packages/frameworks/svelte`, where T003 put
them. T003's browser lane remains the enforcement point for emitted components
mounted directly; this lane adds the hydrated-in-SvelteKit half.

## 5. svelte-check (T002 ruling 6) — run, and it found something

Ruling 6 required the scaffold's own `check` script at T004. Run as-is against
the wired demo it produced **8 errors, all in `src/lib/emitted/`**: 6 ×
implicit-`any` callback parameters and 2 × `event.target` possibly-null /
`.dataset` missing.

Every one of those is already a *ruled non-defect* in this repo.
`packages/frameworks/solid/test/emitted-typecheck.test.ts` runs the same oracle
over the same corpus with `strict: false` **on purpose**, and its header names
this exact class — "`event.target` is `EventTarget` without `dataset` … those
are properties of type-checking untyped JS, not emitter defects, and a lane that
reports 23 of them is as useless as one that cannot fail." Its ACCEPTED list
contains the `dataset` diagnostic verbatim.

**Resolution:** `"checkJs": false` in the demo's `tsconfig.json`, with the reason
written at the edit site. That is a scaffold change and is disclosed as a
deviation (§6). It is the surgical one: every route and hook here is `lang="ts"`
and stays fully `strict`; only untyped JS stops being checked, which is exactly
the position the repo already holds.

**Two-sided calibration, because ruling 6's re-open trigger is precisely "a route
passes props to an emitted component" and that must still be checked:**

| mutation | svelte-check |
| --- | --- |
| unknown prop `bogusProp={1}` on `<RenderOnce>` | **RED** — `'"bogusProp"' does not exist in type '$$ComponentProps'` |
| required prop `onTrace` removed | **RED** — `Property 'onTrace' is missing … but required in type '$$ComponentProps'` |
| wrong-*typed* prop (`initial={noTrace}`) | **GREEN** — honest limitation |
| unmutated | GREEN, 0 errors, 281 files |

So the check still catches unknown and missing props at the route. It does
**not** catch prop *types*, because emitted output carries none — a real gap,
recorded rather than papered over, and one that only an emitter that emits types
could close.

## 6. Deviations

1. **`servedClientEntry` is a total `Record`, not a field on the hydrate arm.**
   T002 condition 1 says "a REQUIRED field on the hydrate arm (e.g. `readonly
   servedClientEntry: string`) **so the type forbids a lane omitting it**". A
   field would require editing `demos/react-official/scenarios.box.ts` and
   `demos/solid-official/scenarios.box.ts` to supply it — both **outside
   `allowed_files`**, which is a stop_if, not a deviation. The total `Record`
   satisfies the stated purpose exactly: omission is a compile error, there is
   no optionality and no fallback. If a future task gets those two box files in
   scope, moving the literal onto the arm is the better spelling and T002
   already blesses it as not-a-weakening. `expectedNavigations` is the same
   pattern for the same reason.
2. **`"checkJs": false` in the demo tsconfig** — §5.
3. **`src/lib/scenario-props.ts`** holds the shared prop values rather than
   repeating them in three routes. Pure wiring.
4. **`build` also runs `copy-emitted`**, matching react-official and qwik.

## 7. The blocker

**S3's `value` attribute disappears after Svelte hydration, so
`assertS3` cannot pass and cross-lane equality cannot be asserted.**

```
expected '[data-action="text"]' attribute 'value' to be "hello", but it was null
```

This is **not** a hydration mismatch, an emitter bug, or a demo-wiring fault.
SSR emits it correctly — `<input data-action="text" value="hello"/>` is in the
served payload, verified by curl. Svelte then removes it *deliberately* on the
client. From `svelte@5.56.8`
`src/internal/client/dom/elements/attributes.js`:

```js
/**
 * The value/checked attribute in the template actually corresponds to the defaultValue property, so we need
 * to remove it upon hydration to avoid a bug when someone resets the form value.
 */
export function remove_input_defaults(input) {
	if (!hydrating) return;
	...
	if (input.hasAttribute('value')) {
		var value = input.value;
		set_attribute(input, 'value', null);
		input.value = value;
	}
```

Note `if (!hydrating) return;`. This is **hydration-only**, which is why T003's
browser lane — which mounts components directly — never saw it, and why this
lane is the first instrument in the repo capable of seeing it at all.

### Scope: exactly one observation

Probed by temporarily neutralizing only that one attribute read (reverted; the
contract is byte-identical to its committed state). Everything else passes:

```
s1  server-rendered derived = kit:2 | after one increment click derived = kit:4 | 1 document request | no console errors
s2  rows a,b complete 1/2 | reorder b,a still 1/2 | remove b -> a, 0/1 | clear -> empty, 0/0 | 1 document request | no console errors
s3  server-rendered text = <THIS> with writes = 0 | after submit writes = 2 | after cancel-submit 1 document request and writes = 2
```

S3's cancel-submit check passes — `preventDefault()` from a delegated handler on
a `<button type="submit">` does avert the real GET navigation under hydration,
confirming T003's measurement holds in SvelteKit too.

### The repair is proven, and it is an emitter change

Svelte's `set_attributes` skips `remove_input_defaults` when `defaultValue` is
present:

```js
var attribute = input.type === 'checkbox' ? 'defaultChecked' : 'defaultValue';
if (!(attribute in next)) { remove_input_defaults(input); }
```

Adding `defaultValue={text}` alongside `value={text}` was probed by hand-editing
the *copied* component (then restored via `copy-emitted`; the tree is pristine).
Result: **the whole lane passes with the contract completely unmodified**, and
S3 reports `server-rendered text = hello with writes = 0` — byte-identical to
react, solid and qwik.

This is the structural twin of Solid's `attr:value`, which the Solid emitter
already emits for exactly this reason (open finding 002).

### Why this Worker stopped

Both repair paths are outside `allowed_files`:

- **Emitter** (`packages/frameworks/svelte/src/emitter/**`) — outside
  `allowed_files` *and* frozen by this task's own
  `git diff --exit-code -- packages/frameworks` verify step. It also needs
  rulings this Worker may not make: whether `defaultValue` is sanctioned under
  the six gates, and its version floor against the deferred IR-4.
- **Contract** — reading the value *property* instead of the attribute would
  change react's, solid's and qwik's asserted strings, which is an explicit
  stop_if and the thing T999 tests mechanically.

There is also a live question for the Judge, not for a Worker: **instrument rule
1 cuts both ways here.** This reproduces on a stock SvelteKit app with none of
our code, which by the board's own rule is evidence the *test* is unfair to
Svelte rather than that Svelte is broken — the serialized `value` attribute is
not user-visible behavior, and all four frameworks show "hello" in the input.
So the repair might belong in the contract after all, as a ruled widening rather
than a weakening. Either way it is a ruling, not a Worker edit.

## 8. Verification

| command | result |
| --- | --- |
| `pnpm check` | pass (four tsc passes) |
| `pnpm test` | pass, 620/620, 42 files |
| `pnpm test:browser` | pass, react 60/60, solid 49/49, svelte 13/13 |
| `pnpm e2e` | **FAIL at the svelte row only.** react, solid and qwik boxes all pass, unchanged |
| `pnpm --dir demos/svelte-official check` | pass, 0 errors, 281 files (after §5) |
| `git diff --exit-code -- packages/frameworks demos/{react-official,solid-official,qwik}/src` | clean |
| `git status --short` | every path inside `allowed_files`; `pnpm-lock.yaml` did not move |

**Byte-unchanged evidence for the other three lanes.** Two independent signals.
(a) All four box files plus the contract typecheck against the widened
`Activation` union with react's and solid's `{ kind: 'hydrate', framework:
'react' } as const` **untouched** — the widening needed no edit to any other
lane. (b) `pnpm e2e` ran the react, solid and qwik boxes to a pass after the
widening; `servedClientEntry` resolves to the identical `/src/entry-client.jsx`
for both hydrating incumbents and `expectedNavigations` to the identical 0/0/1.
No assertion was added to, removed from, or softened in any lane but Svelte's;
the Svelte-only additions (`calibrateServedClientEntry`,
`assertNoDevDiagnostics`) are called from `demos/svelte-official/scenarios.box.ts`
and nowhere else, deliberately, so the other three lanes' assertion *sets* are
unchanged as well as their strings.
