# T004 — `demos/vue-official`, the fifth e2e row, and what the measurements refuted

Worker receipt detail for `docs/goals/frameless-vue-v1` T004. The board carries the
summary; this file carries the provenance record `goal.md:16` requires, the three
measurements T002 listed as `missing_evidence_for_T004`, the negative arms, and the
one finding that **contradicts what T002 anticipated**.

`pnpm e2e` is green with **five** rows and all observations equal.

---

## 1. Provenance — the chain, and the diff against the packed tarball

`goal.md:16` requires T004 to "record the provenance chain and a diff against the
packed tarball, so *as it ships* stays checkable rather than asserted".

### The chain

```
npm create vite@latest  ->  Others  ->  create-vite-extra  ->  ssr-vue  ->  TypeScript
                                                              = template-ssr-vue-ts
```

Reached mechanically rather than through the interactive prompt, so it is
reproducible:

```
npm view create-vite-extra version          -> 5.0.2
npm pack create-vite-extra@5.0.2
shasum -a 256 create-vite-extra-5.0.2.tgz
  5dcadd5aab5bc2c8667f2dd2d50a60a89d98652aafed1f0c4f006fe2e534b0d1
tar xzf create-vite-extra-5.0.2.tgz         -> package/template-ssr-vue-ts/**
```

**T002's incumbency claim was re-verified at HEAD, not inherited.** Diffing
`package/template-ssr-react/server.js` from the same tarball against
`demos/react-official/server.js` reproduces exactly T002's result: the same file, bar
the inline `app.use('*all', …)` body being lifted into `createSsrHandler`, and
`index.html` differing in `<title>` alone. So `demos/vue-official` joins a template
family two landed lanes already run.

### The diff, file by file

Computed mechanically against `package/template-ssr-vue-ts/**`.

**Byte-identical, zero delta (5):**

```
public/favicon.svg   src/style.css   tsconfig.json   tsconfig.node.json   vite.config.ts
```

**Dropped (7)** — every one is the template's own *demo content*, unreachable once
`App.vue` renders the emitted corpus instead of `HelloWorld`. `demos/react-official`
dropped the identical set from `template-ssr-react`.

```
README.md   .vscode/extensions.json   src/components/HelloWorld.vue
src/assets/hero.png   src/assets/vite.svg   src/assets/vue.svg   public/icons.svg
```

`public/favicon.svg` is deliberately **kept** even though react-official dropped its
`public/`: `index.html` still links it, so keeping it is a smaller delta than dropping
it, and it removes a 404 from the lane's `failedRequests: 0` budget by construction.

**Added (7)** — frameless instrument and emitted output, nothing structural:

```
scenarios.box.ts        the witness lane
ssr-handler.js          the template's own inline handler, extracted (see below)
src/dev-sink.ts         the console sink T002 ruling 4 requires
src/scenario-props.ts   the props the other four lanes pass, verbatim
src/emitted/*.vue       3 files, written by `pnpm copy-emitted`
```

**Modified (9), and each delta is sanctioned:**

| file | delta | why |
| --- | --- | --- |
| `server.js` + `ssr-handler.js` | the inline `app.use('*all', …)` body lifted into a factory | **the incumbent delta**, identical to what `demos/react-official` did to `template-ssr-react/server.js`. `node server` and the witness lane then drive the same render path, so no second harness exists to drift. One behavioural consequence, recorded: the production template is read per request instead of cached in a module-level `templateHtml`, which is what lets the body live outside `server.js`. |
| `index.html` | `<title>` only | same delta react-official made |
| `package.json` | name, `copy-emitted`, `vite`/`@types/node` on `catalog:`, `@types/express` dropped | see §5 |
| `src/main.ts` | `createApp(url)` instead of `createApp()` | routes `/`, `/s2`, `/s3` without adding a router |
| `src/entry-server.ts` | passes the `_url` the template already receives and discards | 2 lines |
| `src/entry-client.ts` | `import './dev-sink'`; `createApp(window.location.pathname)` | the sink, and the client half of the same URL thread |
| `src/App.vue` | renders the emitted corpus; sets the activation marker in `onMounted` | the whole point |
| `tsconfig.app.json` | `allowJs: true`, `checkJs: false` — **the only compiler option changed** | see §4 |
| `.gitignore` | `+ .witness/` | as all four incumbents do |

Nothing else in the scaffold was touched. No hand-rolled SSR build exists anywhere in
this demo.

---

## 2. The three measurements T002 named as missing evidence

### M-A — `servedClientEntry` = `/src/entry-client.ts`, READ OUT OF THE PAYLOAD

Not guessed from `index.html`. Read out of what the demo's own handler actually served
for `/`, `/s2` and `/s3` — **one occurrence each**, and the literal survives
`vite.transformIndexHtml` verbatim in dev (which also injects `/@vite/client`, and
does not rewrite the entry). `calibrateServedClientEntry` runs on **every scenario**,
so its two vacuity guards and its delete-the-evidence negative arm execute three times
per run, and the evidence is in the receipt:

```
servedClientEntry: "/src/entry-client.ts"
servedClientEntryOccurrences: 1
negativeControl: "payload with /src/entry-client.ts deleted is rejected"
```

The literal is per lane and is **not** inherited from react/solid despite the shared
template family: this is the TypeScript variant, so the entry is `.ts`, not `.jsx`.

### M-B — `expectedNavigations` = 0, MEASURED and calibrated two-sided

`expect.page.outcome(page, { navigations: 0 })` is an exact-equality assertion, so
green already means the count is exactly 0. That is one-sided, so the other arm was
run: setting `expectedNavigations.vue = 1` turns the lane **RED** with

```
- navigations: expected 1, observed 0
```

So 0 is a measurement, and the check discriminates. Never relaxed to "any".

### M-C — the dev sink catching a REAL mismatch. This is the load-bearing one

T002 ruling 4: a Vue lane can pass green while hydration is genuinely mismatching,
because Vue warns, errors, **and then patches the DOM to match the client**. T003
discharged T002's dissent by proving both messages are ordinary `console` calls. What
neither established is that a real mismatch reaches *this demo's* sink through *this
demo's* wiring — which is instrument rule 4, and is a different claim from the sink's
own install-time self-calibration.

`scenarios.box.ts` therefore plants a **known member**, once per run, before any
scenario: `MISMATCH_PATH` serves the real S1 payload with `kit:2` rewritten to
`kit:999`, and requires the sink to report a `[Vue warn]`-level hydration warning.
Measured:

```
served >kit:999<, sink captured 2 diagnostic(s), first names Hydration,
DOM patched back to kit:2
```

Two diagnostics — the warn and the companion error — exactly as T003 measured. The
third arm (`DOM patched back to kit:2`) is not decoration: it *demonstrates* that the
page looks correct after a real mismatch, which is the whole reason the console
channel and not the page has to be watched.

**Four negative arms, all RED**, so this is a check that has been seen to fail:

| arm | result |
| --- | --- |
| nothing actually planted (serve the honest page) | RED — "captured 0 diagnostics on a page … deliberately corrupted" |
| sink installed after mount (`await import('./dev-sink')` after `app.mount()`) | RED — same message |
| `app.config.warnHandler = () => {}` — **T002's named trap** | RED — "captured 1 diagnostic(s) … which is not Vue's own hydration WARNING" |
| `expectedNavigations.vue = 1` | RED — see M-B |

The `warnHandler` arm is why the assertion requires the first captured diagnostic to be
`warn:`-level **and** contain `[Vue warn]`. A check that merely looked for the word
"Hydration" would have passed with the warn channel swallowed, because the companion
`console.error("Hydration completed but contains mismatches.")` contains it too. That
was found by running the arm, not by reasoning about it — the looser check was written
first and the arm caught it.

**A fifth arm was run and was INVALID, which is itself worth recording.** Moving
`import './dev-sink'` to below `app.mount()` left the lane GREEN. That is not a hole:
ESM hoists and evaluates every static import before any statement in the module, so the
mutation was semantically a no-op. Instrument rule 2 — a mutation harness asserts the
source actually changed — applies to *semantics*, not bytes. The valid arm is the
dynamic import above. The comment in `src/entry-client.ts` now states this, because the
natural reading of "FIRST, before mount()" is that placement is what enforces the
ordering, and it is not.

---

## 3. M2 revisited — Vue's ancestor-handler skip does NOT bite this lane, and the premise needs a refinement

T003 measured `createInvoker` in `@vue/runtime-dom@3.5.40`: the first Vue handler an
event reaches stamps it with `Date.now()`, and every **ancestor** handler is skipped
unless that stamp is strictly newer than its own attach time. A click in the same
millisecond as `mount()` runs the button's handler and silently drops the form's.

**Measured here, end to end, rather than assumed to be harmless.** With `noTrace`
temporarily replaced by an SSR-safe recorder, clicking `[data-action="submit"]` in the
real e2e lane produces:

```
M2-PROBE data-trace-submit,data-trace-bubble
```

Both. Native bubbling, and the `_vts` skip does not fire — the lane clicks seconds
after hydration, which is exactly the fairness argument T003 made when it ruled the
first failing run an unfair *test* rather than a wrong emitter.

**A refinement to the dispatch premise, offered as a finding rather than a
disagreement.** The task brief said S3 "depends on a click bubbling from
`[data-action="submit"]` to the form, so this is directly load-bearing". The bubbling
does happen and is now measured. But it is **not** load-bearing for any *e2e
observation*: the form's `v-on:click` body is exactly
`if (event.target.dataset.action === 'submit') { onTrace('bubble', …) }`, and every
one of the five official demos passes `onTrace = () => {}`. Had the ancestor skip
fired, no observation in the matrix would have changed. Where bubbling IS load-bearing
is `packages/frameworks/vue/test/emitted-smoke.browser.test.ts`, which asserts the
ordered trace — which is where T003 hit it. Recorded so a later reader does not treat
the green e2e row as evidence about bubbling; the probe above is that evidence.

The probe also validated an instrument: the first attempt used a bare
`document.documentElement.setAttribute`, which threw during SSR, and
`calibrateDevSink`'s own precondition assertion caught it with "could not find `>kit:2<`
in the payload the real handler produced … would make the sink calibration vacuous".
Instrument rule 2 working as intended, on a mutation it was not written for.

---

## 4. FINDING — `vue-tsc` does NOT reach the prop contract, refuting T002 ruling 2's re-open trigger

T002 ruling 2 narrowed `vue-tsc` out of T003 and set a re-open trigger: *"Re-open
trigger fires at T004, where App.vue passes props to emitted components — and the
template's own build script is already `vue-tsc -b`, so it arrives FROM THE SCAFFOLD as
svelte-check did."*

The trigger fired. `vue-tsc` arrived from the scaffold, is wired, and passes. **But it
does not check the thing the trigger named.** Measured four ways, at **both** `checkJs`
settings:

| case | `checkJs: false` | `checkJs: true` |
| --- | --- | --- |
| unknown prop on an emitted component | **GREEN** | **GREEN** |
| wrong-typed prop on an emitted component | **GREEN** | **GREEN** |
| undefined identifier in `App.vue` | RED | RED |
| wrong-typed use of a typed local (`props.url`) | RED | RED |

The Svelte lane's table was *unknown prop RED, missing prop RED, wrong-typed prop
GREEN*. **Vue's is weaker on both of the first two rows.** The reason is not a setting:

- `defineProps(['label', 'multiplier', 'visible', 'onTrace'])` — the array form T002
  ruling 3 *requires*, because the IR carries no prop type field — types every prop
  `any`, so no wrong type is wrong.
- Vue lets an undeclared prop fall through to `$attrs` rather than erroring, so no
  unknown prop is unknown.

So **the wrong-typed-prop hole is IR-8, exactly as T002 ruling 3 said, and the
unknown-prop hole is IR-8 plus a Vue language semantic.** Neither is closable by a
tsconfig option, and neither may be closed by inventing types — T002 ruling 3's
precedent stands and this lane does not touch it.

`checkJs: true` was measured rather than dismissed, and buys **zero** additional
coverage while costing exactly the noise class
`packages/frameworks/solid/test/emitted-typecheck.test.ts` predicts in its header — six
errors on `src/emitted/EventForm.vue` alone, all `'event.target' is possibly 'null'`
and `Property 'dataset' does not exist on type 'EventTarget'`. So `checkJs: false` is
now a measurement, not an inheritance from the Svelte lane's comment.

`allowJs: true` is **required**, not optional: without it `vue-tsc` cannot read a
`<script setup>` with no `lang="ts"` at all, and reports TS7016 "implicitly has an
'any' type" three times. That is a fact about the compiler's reach, not about the
emitted output.

**What `vue-tsc` is therefore worth in this lane, stated honestly:** the bottom two
rows, over `App.vue`, `main.ts`, `entry-client.ts`, `entry-server.ts`,
`scenario-props.ts` and `dev-sink.ts`, all fully strict. That is real and it is the
scaffold's own build gate. It is *not* the prop-contract check the re-open trigger
expected, and this note says so rather than letting the green read as coverage it does
not have — which is this board's recorded recurring fault, one layer up in the
documentation.

**Not typechecked, consistent with all four incumbents:** `scenarios.box.ts`. No demo's
box file is covered by `pnpm check` (the root `tsconfig.json` `include` list is packages
only), and covering this one would require `@async/witness` as a dependency the demo
deliberately does not have — the e2e runner aliases it. Flagged, not fixed.

---

## 5. The lockfile moved, and exactly how

`pnpm-lock.yaml` is **+122 lines, additive only**. No existing resolution changed.

- the new `demos/vue-official` importer — unavoidable for any new workspace package;
- `vue-tsc@3.3.8` (from the template's `^3.2.6`) and its closure: `@volar/typescript`,
  `@volar/language-core`, `@volar/source-map`, `@vue/language-core`, `alien-signals`,
  `muggle-string`, `path-browserify`, `vscode-uri`;
- `@vue/tsconfig@0.9.1`.

Everything else the template asks for was already in the tree.
**`vue` resolves to `3.5.40` — the same version `packages/frameworks/vue` measured
against**, so the demo runs the build T003's compile oracle and browser lane both
measured, and M4's version-identity claim is not quietly broken by this lane.

Three template pins were changed and each is recorded:

- `vite: "^8.0.3"` -> `"catalog:"` (8.0.16). This is what `demos/react-official` and
  `demos/solid-official` do, for the same reason: one vite instance in the workspace.
  Same major, inside the template's own range.
- `@types/node: "^25.5.2"` -> `"catalog:"` (24.12.2). Taking `^25` would add a second
  `@types/node` to the tree for a demo that only needs it for
  `tsconfig.node.json`'s `types: ["node"]`.
- `@types/express: "^5.0.6"` **dropped**. Nothing typechecks `server.js`
  (`tsconfig.node.json` includes `vite.config.ts` only), so it is unused.
  `demos/react-official` dropped `@types/react`/`@types/react-dom` on the same
  reasoning.

---

## 6. What the shared contract gained, and that nothing was weakened

`demos/react-official/three-way-contract.ts`:

- `Activation`'s hydrate arm gains `'vue'`;
- `servedClientEntry` gains `vue: '/src/entry-client.ts'` — the total `Record` is what
  forced it;
- `expectedNavigations` gains `vue: 0` — likewise;
- prose updated from "four lanes" to "five" in seven places, plus a paragraph on why
  the sink matters more for Vue than for Svelte.

**No existing assertion was relaxed, reordered or deleted.** React's, Solid's, Qwik's
and Svelte's asserted strings and numbers are byte-unchanged. The prose edits are
comment-only, which the Svelte T999 audit explicitly ruled is not a weakening — its
byte-unchanged test is about the *set* of assertions and the exact strings asserted.

One design point worth naming: `demos/vue-official/src/dev-sink.ts` stops re-emitting
to the real console **on a page that declares itself a calibration page**, and only
there. Without it the deliberate mismatch's `console.error` lands in witness's client
ledger and marks the box a *contested pass* — a deliberate control leaving a permanent
mark against the run, which `three-way-contract.ts` already ruled out in those words
for `calibrateServedClientEntry`. The three scenario pages never carry the meta, so
their pass-through and the shared `consoleErrors: 0` are untouched. Verified: the box
now passes **uncontested** while still recording that the sink captured 2 diagnostics
on the calibration page.
