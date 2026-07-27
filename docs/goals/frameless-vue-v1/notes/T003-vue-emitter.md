# T003 — `packages/frameworks/vue`, and the four measurements

Worker receipt detail for `docs/goals/frameless-vue-v1` T003. The board carries
the summary; this file carries the measurements, the two findings that refute
something upstream, and the decisions a later reader would otherwise re-litigate.

Everything below was measured against **`vue@3.5.40` and
`@vue/compiler-sfc@3.5.40`**, which resolve to the same version — asserted at
test time in two places, not trusted from the install (M4).

---

## The four required measurements

### M1 — WHITESPACE. The Judge's hypothesis HOLDS, and it was incomplete in both directions

Vue's SFC template compiler defaults to `whitespace: 'condense'`, a **different
rule** from Svelte's, so `frameless-svelte-v1` T003 measurement 3 and its
newline-inside-the-closing-tag idiom do not carry over and were re-measured from
scratch. Every arm was rendered through `vue/server-renderer` at the resolved
version — real output bytes, not an AST inspection.

| arm | source | rendered |
| --- | --- | --- |
| 1 | `<div><p>a</p>\n<span>b</span></div>` | `<div><p>a</p><span>b</span></div>` — **removed** |
| 2 | `<div><p>a</p> <span>b</span></div>` | `<div><p>a</p> <span>b</span></div>` — **kept** |
| 3 | `<p>{{ a }}\n/{{ b }}</p>` | `<p>1 /2</p>` — **condensed to a space** |
| 3′ | `<p>{{ a }}/{{ b }}</p>` | `<p>1/2</p>` |
| 4 | `<button>\n\tincrement\n</button>` | `<button> increment </button>` — **condensed** |
| 4′ | `<button\n\tdata-x="1"\n>increment</button>` | `<button data-x="1">increment</button>` |
| 5 | `<output>\n\t{{ a }}\n</output>` | `<output>1</output>` — **safe** |

**The Judge's hypothesis is confirmed on both of its named arms** (arm 1 and arm
3), including the consequence it flagged: S2's `1/2` really does become `1 /2`
under the naive layout, which is the observable
`demos/react-official/three-way-contract.ts` asserts equal across lanes.

Two things the hypothesis did not name, and both are load-bearing:

- **The newline is the trigger, not the whitespace** (arm 2). A space between two
  elements on one line is *kept* as a single space. So "put siblings on separate
  lines" is not merely tidy; it is the thing that makes the whitespace vanish.
- **Whitespace that shares a text node with content is condensed, not removed**
  (arm 4). This is a *third* hazard, and it is the one that decides the emitter's
  layout rule: `<button>` with its text on its own line renders `" increment "`.
- Arm 5 refines it in the other direction: a lone interpolation on its own line
  *is* safe, because the flanking whitespace nodes are first and last children.
  The emitter is conservative anyway — it inlines any run containing a
  non-element — and arm 5 records that the conservatism is a choice rather than a
  necessity.

**The emitter's rule, in one line:** a run of children may be broken across lines
only if *every* child renders as an element; otherwise the whole run is inline.

**Two independent checks, not one.** `test/compile-emitted.test.ts` owns the
compiler measurement above plus a pin of the shipped corpus's condensed text
nodes and a calibration that plants the naive layout back into the real S2 and
watches `" /"` come back. The gate owns `condense-stable-text`, which states the
property of the *result* rather than of the layout: **after condense, no emitted
text node may carry leading or trailing whitespace.** All three hazards land in
that one predicate, and it is read straight off Vue's own condensed AST
(`descriptor.template.ast` is already condensed — measured) rather than
reimplementing the rule. Three mutation rows, one anti-vacuity row.

The browser lane asserts the live-DOM half: `1/2`, `kit:2`, `increment`, exact.

### M2 — BUBBLING. Native, as predicted — but the first run said otherwise, and the reason is a real finding

S3's emitted output puts `v-on:click` on the `<form>` itself, reading
`event.target.dataset.action === 'submit'`, so the corpus depends on a click
bubbling from `[data-action="submit"]` to the form.

**First run: the `submit` trace appeared and the `bubble` trace did not**, while a
plain `addEventListener` on the same form saw the click perfectly well.

That is not an emitter defect. It is `createInvoker` in the resolved
`@vue/runtime-dom@3.5.40`, `dist/runtime-dom.esm-bundler.js:739-741` and `:777`:

```js
const invoker = (e) => {
  if (!e._vts) { e._vts = Date.now(); }
  else if (e._vts <= invoker.attached) { return; }
  ...
};
invoker.attached = getNow();          // getNow() === Date.now(), cached per tick
```

The **first** Vue handler an event reaches stamps it with `Date.now()`; every Vue
handler after that — which means every **ancestor** handler — is skipped unless
that stamp is *strictly greater* than its own attach time. A click dispatched in
the same millisecond as `mount()` therefore runs the innermost emitted handler
and silently drops the form's.

Under instrument rule 1 that is evidence the **test** was unfair, not that the
output was wrong: a real user clicks milliseconds after mount and `pnpm e2e`
clicks seconds after hydration. The harness moves the clock
(`advanceAttachClock()`), and a **deterministic** calibration row pins the
mechanism by setting `_vts` explicitly on both sides — stale → no Vue handler
runs at all; fresh → both run, innermost first. Without that row the wait would
be an unexplained sleep, which is how a workaround becomes folklore.

With the harness fair, the ordered trace is
`[['submit', …], ['bubble', {source: 'form'}]]` — native bubbling, button handler
first. Two-variable triangulation on the **target**: clicking `cancel-submit`,
which bubbles to the same form through the same listener, produces **no** bubble
entry, so the ordered trace is measuring "the form saw this target" and not "the
form handler always fires".

**T004 should know this exists.** It will not bite an e2e lane, but it will bite
any future test that mounts and clicks in the same tick.

### M3 — PREVENTDEFAULT. The signal tracks the CALL, not the emission form

A plain in-body `event.preventDefault()` inside `v-on:click` on a real
`<button type="submit">` inside the emitted `<form>`.

| cell | mechanism | call | submissions |
| --- | --- | --- | --- |
| emitted S3 `cancel-submit` | `v-on:click` | present | **0** |
| runtime probe | Vue `onClick` prop | absent | **1** |
| runtime probe | Vue `onClick` prop | present | **0** |
| bare `<button type="submit">` | none | — | **1** (observer calibration) |

The runtime probe uses Vue's own `onClick` prop, which is exactly what
`v-on:click` compiles to (verified in the generated render function). So the
product variable is varied inside the same mechanism, and the observer is proven
able to see a submission it is not shown.

No `.prevent` modifier anywhere. See the ruling section below.

### M4 — VERSION IDENTITY, asserted at test time in two lanes

`vue` and `@vue/compiler-sfc` both resolve to `3.5.40`. Asserted **four ways** in
node (`compile-emitted.test.ts`: both packages' runtime `version` exports and both
`package.json` files) and **three ways** in the browser
(`emitted-smoke.browser.test.ts`: the two versions resolved by `vitest.config.ts`
at config time and injected, compared against the `version` the browser bundle
actually runs). If the compile oracle and the browser lane ever diverge, Gate 1
records FAIL outright — "the measurement was taken against a different build than
the one this repo ships" — so the identity is a standing check rather than an
install-time fact.

---

## Two findings that refute something upstream

### FINDING 1 — `eslint-plugin-vue`'s upper tiers are a FORMATTER, and two of their rules are actively harmful here

The Svelte precedent is "apply `configs.recommended` whole, omit individual rules
with reasons". **That does not transfer.** Measured on the shipped corpus at
eslint-plugin-vue 10.10.0, `flat/strongly-recommended` and `flat/recommended`
report exactly these eight rules:

```
vue/html-indent
vue/html-self-closing
vue/max-attributes-per-line
vue/multiline-html-element-content-newline
vue/require-prop-types
vue/singleline-html-element-content-newline
vue/v-bind-style
vue/v-on-style
```

Two of them are not noise:

- `vue/singleline-html-element-content-newline` and
  `vue/multiline-html-element-content-newline` demand a line break between a tag
  and its text content — **the exact layout M1 arm 4 measured to produce
  `" increment "`**. Applying them would break the observable this board exists to
  keep equal across five frameworks.
- `vue/v-on-style` and `vue/v-bind-style` demand the `@` and `:` shorthands, which
  `docs/emitter-idiom-policy.md` worked example 2 rules **DEFERRED** and this
  board's **T005** re-runs. Applying them would hand T005 a fait accompli.

So this lane applies `flat/essential` — the plugin's own "Priority A: Essential
(Error Prevention)" tier, 85 rules — and records the exclusion in
`VUE_ESLINT_TIERS_EXCLUDED` with the measured rule ids **plus a standing test that
re-measures them**. If a later eslint-plugin-vue moves a correctness rule into an
excluded tier, that test goes red rather than the rule disappearing.

Two rules inside the applied tier are omitted, each with a reason in code:

- **`vue/comment-directive`** — the plugin's own markup implementation of
  `<!-- eslint-disable -->`, which ESLint's `allowInlineConfig: false` does **not**
  reach. Measured on the unkeyed-`v-for` mutant: rule ON + one
  `<!-- eslint-disable vue/require-v-for-key -->` in the template → the arbiter
  reported **nothing**; rule OFF → the same mutant reported the rule. Emitted text
  silencing the arbiter judging it is the one thing a gate over generated output
  must not permit. The Svelte lane omits `svelte/comment-directive` on an
  identical measurement.
- **`vue/multi-word-component-names`** — reads the *file name*. A `.vue` SFC
  declares no name, so the rule falls back to the basename (`S1`/`S2`/`S3`), which
  is the corpus convention shared with the other four lanes and is not a Vue
  naming decision. The names the IR declares (`RenderOnce`, `KeyedTodo`,
  `EventForm`) *are* multi-word and are carried in the generated header.
  Satisfying the rule would mean `defineOptions({ name })`, a Vue **3.3** macro —
  version-gated, and IR-4 is deferred.

### FINDING 2 — T002's dissent on the hydration-mismatch channel is DISCHARGED, with the verbatim messages

T002 recorded as **NOT VERIFIED** "that Vue 3.5.40's hydration-mismatch message
reaches `window.console` rather than an internal `warn()` that `warnHandler` could
swallow", and said to look here first if a T004 lane is ever green on a planted
mismatch.

Measured, on a **real emitted component**, two-sided:

- **matching container → hydrates in silence.** (Without this arm the test would
  pass equally well if `createSSRApp` had quietly fallen back to a client render.)
- **mismatched container → two ordinary console calls:**
  - `console.warn`: `[Vue warn]: Hydration text content mismatch on <output …> - rendered on server: kit:999 - expected on client: kit:2`
  - `console.error`: `Hydration completed but contains mismatches.`
- and Vue then **patches the DOM to match the client**, so the visible result of a
  genuine mismatch is a correct-looking page. That is precisely why the channel
  has to be watched rather than the page inspected.

Both are ordinary console calls, so a console-patching sink sees them. An
`app.config.warnHandler` would swallow the first — which is why this package sets
one nowhere, and why T004's sink must not either.

---

## Rulings implemented, and where the decision comment lives

| ruling | where |
| --- | --- |
| SFC + `<script setup>`, no `lang="ts"`, **longhand** `v-bind:`/`v-on:`, no modifiers | `src/emitter/index.ts` → `syncPolicyGuard` doc comment |
| IR-8: array-form `defineProps`, **no** typed props, **no** prop defaults, **no** destructuring | `src/emitter/index.ts` → `propsDeclaration` doc comment |
| IR-5: `preventDefault` in-body; `stopPropagation` **fails closed** | `syncPolicyGuard`, plus gate `no-stop-propagation` |
| IR-7: conservative syntactic guard over emitted `computed(…)`, never a purity proof | `src/gate/index.ts` → `impureNodes` doc comment |
| IR-4: baseline form inventory (route (b) of the version corollary's second conjunct) | `src/gate/index.ts` → `BASELINE_FORM_INVENTORY` |
| M1 whitespace | `src/emitter/index.ts` → `isBlockLevel` doc comment; gate `condense-stable-text` |

### Why `props.x` in the script and verbatim in the template

The one thing this emitter does that React, Solid and Svelte do not need at all.
In a Vue **template**, the compiler resolves identifiers against
`bindingMetadata` — a `ref` is unwrapped and a prop is reached — so the IR's own
spelling is already correct and expressions are emitted **verbatim**. In
`<script setup>` there is no such resolution, so a prop becomes `props.x` and a
`ref` becomes `x.value`.

The respelling is **scope-aware**, not a name substitution: S2 has a
handler-local `const count` and S1 has a component-level `count` ref, and S2's
`computed` is `todos.value.filter((todo) => todo.done).length` where `todo` must
be left alone. It **refuses** an AST node type it has not been taught, so an
unfamiliar IR expression is a throw at emit time rather than plausible-looking Vue
with an unresolved identifier in it.

`once-per-instance` needs **no lowering at all** in Vue: `<script setup>` *is* the
setup body and runs once per instance, and is not itself a reactive effect. Solid
and Svelte both need `untrack` here. The absence is asserted by a test row so it
does not read as an oversight.

### Why single-element `v-if` / `v-for` arms, and a single root

`<template v-if>` is the general form and is **refused**. A `<template>` compiles
to a Fragment, and a Fragment is server-rendered with `<!--[-->` / `<!--]-->`
anchor comments that the e2e lane reads out of the served payload. Same reason for
requiring exactly one root template node. The corpus has no instance of either, so
the alternative would be untested dead code — worse than absent code in an emitter.

---

## The baseline form inventory: why every Vue floor reads `unverified`

The Svelte lane could at least point at `@since 5.20.0` on `$props.id` to show
what a verified floor looks like. **The resolved `vue` package carries no `@since`
tag anywhere in its shipped `.d.ts` files and ships no CHANGELOG** — asserted as a
test, not as a claim — and its type entry point is a seven-line re-export of
`@vue/runtime-dom`. There is nothing on disk in this repo that dates any of these
forms. Presence at the pin is not a floor; it is equally consistent with "3.0" and
with "nobody wrote one down".

The citation checker is therefore calibrated against the real package in all three
outcomes (pass / fail / throw) even though no entry currently uses it.

The inventory observes the **spelling**, not the resolved directive: `:key` and
`v-bind:key` are the same directive to Vue's parser (`name === 'bind'` for both)
and are *different forms* here, because choosing between them is exactly the
emission-site decision worked example 2 defers.

---

## What T003 did NOT do

No demo, no e2e row, no scaffold — those are T004's. `pnpm e2e` was run and is
green with its existing four lanes, unchanged. Nor a `src/adapter.ts`: nothing
consumes it and a fifth byte-equivalent copy of the quiescence loop is drift with
no consumer.

## A parallel-safety note the PM should have

**The repository moved under this task while it ran, and the PM should know
which parts.** Verify command 7 (`git diff --exit-code` over
`packages/frameworks/{react,solid,qwik,svelte}`, `packages/compiler`, `demos`,
`scripts`) **failed mid-run and passes at the end**, and neither state was caused
by T003:

- `demos/react-official/three-way-contract.ts` was **already** modified in the
  working tree before T003 made its first edit — a diff snapshot was taken at task
  start to prove it — then changed **again** mid-run, then was committed by
  someone else, at which point verify 7 went clean.
- Five commits landed under the task: `bea5e53`, `589afc0`, `851ae3d`, `e296d52`,
  `d43d51b`. One of them, `851ae3d build(angular): add yuku-codegen`, **moved
  `pnpm-lock.yaml`** and added `packages/frameworks/angular/package.json`.

`pnpm-lock.yaml` is not modified in T003's working tree and no install was run by
this task; its bytes differ from the task-start snapshot only because HEAD
advanced. Every file T003 wrote is inside `packages/frameworks/vue/**`, root
`package.json`, or this notes file — all in `allowed_files`. There was no
collision, but a Vue and an Angular workstream were writing to the same tree at
the same time, and the next task on either board should not assume otherwise.

Verify command 6 (`node scripts/regenerate.ts && git diff --exit-code -- …/generated`)
passes but is **vacuous today**, because `generated/` is untracked and `git diff`
therefore has nothing to compare. It was additionally run against a byte-level
snapshot taken immediately before regeneration, which is the check the command
will make on its own once the directory is committed.
