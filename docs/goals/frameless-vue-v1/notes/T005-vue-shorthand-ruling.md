# T005 — Vue sugar re-run: worked example 2 (`v-bind` / `v-on` / `v-slot` shorthands)

Judge ruling, `frameless-vue-v1` T005, 2026-07-27. Read-only task: nothing in the repo was changed
by this ruling except this file.

**The headline: Gate 1 and Gate 6 BOTH CLEAR, and the lane genuinely discharged the deferral rather
than claiming to.** Gate 1 is `PASS` on measurement against `vue@3.5.40` — the build in this repo's
lockfile — and Gate 6 is `PASS` on a standing five-lane behavioural check that drives the exact
emitted text on the official scaffold. Neither is `DEFERRED`. `DEFERRED — framework absent` is no
longer available at Gate 1 and `DEFERRED — no lane` is no longer available at Gate 6, exactly as
`frameless-svelte-v1` T005's binding text predicted for a landed lane, and no further.

**And the entry does not survive as one entry.** Worked example 2 bundles three directives. Two of
them now clear all six gates; the third has no emitter path at all and cannot clear Gate 4 or Gate 6.
A single ruling covering all three would have to be wrong about one of them. The entry SPLITS.

---

## What was measured, and against what

All measurements below were taken against the resolved packages of this working tree:

- `vue@3.5.40` — `node_modules/.pnpm/vue@3.5.40_typescript@6.0.3/`
- `@vue/compiler-sfc@3.5.40` — `node_modules/.pnpm/@vue+compiler-sfc@3.5.40/`
- `@vue/compiler-core@3.5.40` — `node_modules/.pnpm/@vue+compiler-core@3.5.40/`
- `eslint-plugin-vue@10.10.0`, `vue-eslint-parser@10.4.1`
- `pnpm-lock.yaml` pins `vue@3.5.40` at TWO importers — `packages/frameworks/vue` (`specifier ^3.5.32`)
  and `demos/vue-official` (`specifier ^3.5.40`) — both resolving to `3.5.40(typescript@6.0.3)`. This
  is the M4 version-identity property the lane already asserts at test time.

The corpus under test is the shipped emitted output, `packages/frameworks/vue/generated/{S1,S2,S3}.vue`
(1, 15 and 9 longhand directives respectively), and a SHORTHAND TWIN of each produced by the
mechanical respelling `v-bind:` to `:` and `v-on:` to `@`. Every transform asserts that it changed the
source; a transform that leaves the source byte-identical throws, per this board's standing rule that
a mutation which does not mutate is not a mutation.

### M-A — diagnostics, both forms, four compile modes

`parse` + `compileScript` + `compileTemplate` over `{ssr: false, true} x {isProd: false, true}`,
reading BOTH the `errors` and the `tips` channel, which is the lane's own `compileDiagnostics`
procedure.

Result: **EXACT EMPTY diagnostic set for both forms, all three files, all four modes.**

### M-B — generated code identity, four compile modes, both compile paths

- Dev path (`inlineTemplate: false`, what `@vitejs/plugin-vue` uses in dev, which is the mode
  `pnpm e2e` pins): template codegen **BYTE-IDENTICAL** longhand vs shorthand, all three files, all
  four modes.
- Production path (`inlineTemplate: true` with `templateOptions`): `compileScript` output
  **BYTE-IDENTICAL** longhand vs shorthand, all three files, all four modes.

Negative controls, both calibrated against a planted known member:

- `v-on:input` to `v-on:input.stop` — DIFFERS in the two client modes, IDENTICAL in the two SSR modes.
  That second half is an instrument precondition, not a curiosity: **the SSR channel is BLIND to
  event-routing changes**, so the SSR arm alone could never have carried the event half of Gate 5.
  The client codegen identity is what carries it.
- `v-bind:` to `v-bind.attr:` on S1 — the comparator reports DIFFERS.

### M-C — behaviour, real SSR render with real props

Each golden and each twin compiled to a real component and rendered through
`vue/server-renderer` `renderToString` at 3.5.40, with the scenario props.

- S1 155 bytes, S2 561 bytes, S3 521 bytes — **HTML byte-identical longhand vs shorthand in all
  three.**
- Negative control: `v-bind:` to `v-bind:data-planted-` on S2 — comparator reports NOT byte-equal.

### M-D — the structural reason, read out of the resolved package

`@vue/compiler-core@3.5.40`, `dist/compiler-core.cjs.js:2435`, inside `ondirname`, verbatim:

```js
const name = raw === "." || raw === ":" ? "bind" : raw === "@" ? "on" : raw === "#" ? "slot" : raw.slice(2);
```

The raw spelling is normalised to a directive `name` at parse time. Everything downstream reads
`name`; the spelling survives only as `rawName`, which is precisely the field the frameless gate reads
to tell the two apart (`packages/frameworks/vue/src/gate/index.ts`, `directiveForm`). The only
spelling carrying extra semantics is `.`, which pre-seeds a `prop` modifier — and `.` is a FOURTH
shorthand that worked example 2 does not name and this ruling does not cover.

This is what makes Gate 4 a structural claim rather than a sampling claim. The sample below is its
two-sided calibration, not its evidence base.

### M-E — totality over the emitter's OWN declared name domains

Domains read off `packages/frameworks/vue/src/emitter/index.ts`, not off Vue folklore:

- `ATTRIBUTE_NAME = /^[A-Za-z_][A-Za-z0-9_.-]*$/` and not starting with `v-`, enforced by
  `assertPlainAttributeName` — the `v-bind` argument domain.
- `/^[a-z]+$/`, enforced in `eventDirectiveName` — the `v-on` argument domain.

19 binding names (including `data-edit`, `data-oracle-row-key`, `_x`, `A9`, `a-b-c`, `aria-label`,
`class`, `style`, `innerHTML`, `foo.bar`) and 9 event names, each compiled in both spellings across
all four modes: **zero divergent members**. Planted known member `v-on:click` vs `@click.stop`:
divergent, so the probe can report one.

### M-F — the second arbiter, two-sided

The lane runs `eslint-plugin-vue` as a second arbiter. Measured at 10.10.0 through
`vue-eslint-parser@10.4.1`:

- Applied tier `flat/essential`: **clean on both forms**, all three files.
- Excluded tier `flat/strongly-recommended`: reports `vue/v-on-style` (S1, S2, S3) and
  `vue/v-bind-style` (S2, S3) against the SHIPPED LONGHAND, and reports **NEITHER against the
  shorthand twin.**

So the framework's own toolchain, at the version in this repo's lockfile, ships a rule that flags the
form frameless currently emits and is silent on the candidate. That is a real Gate 1 datum.

**It is NOT a forced-lowering trigger, and the distinction has to be stated before someone reaches for
it.** The preamble's second trigger needs the current output to sit OUTSIDE the sanctioned set, shown
by a framework diagnostic, a lint rule shipped against that shape, a dedicated construct, or a
witnessed runtime failure. `vue/v-on-style` is a rule in the plugin's own "Priority B: strongly
recommended for improving READABILITY" tier, and the longhand compiles with an exact empty diagnostic
set and renders byte-identical HTML. A form that is inside the sanctioned set and merely less
idiomatic is candidate sugar and goes through all six gates. It did.

### M-G — a hypothesis I held, and MEASURED FALSE

I predicted that flipping to the shorthand would INTRODUCE a version hazard: that a value-less `:x` is
Vue 3.4's same-name shorthand while a value-less `v-bind:x` would be an error, so the flip would turn
a compile error into a silently valid 3.4-gated form.

Measured at 3.5.40:

| form | errors |
| --- | --- |
| `<span v-bind:count>` | **none — compiles, same-name shorthand** |
| `<span :count>` | none — compiles, same-name shorthand |
| `<span v-on:click>` | `SyntaxError: v-on is missing expression.` |
| `<span @click>` | `SyntaxError: v-on is missing expression.` |

**The hazard is SYMMETRIC and it already exists in the longhand.** The flip neither creates nor
enlarges it. What it does do is make a latent inventory hole worth closing: `BASELINE_FORM_INVENTORY`
records `v-bind` at floor `3.0`, but a VALUE-LESS `v-bind:x` is a 3.4-gated form that the inventory
would accept today, because the inventory reads the directive form and not whether it carries a value.
The emitter cannot produce one — all three emission sites interpolate `="..."` unconditionally — but
nothing asserts that. Recorded as a finding, carried into the worker package as a cheap standing
assertion, and NOT a blocker for this ruling.

---

## The ruling, in the policy's own format

Fold both entries below into `docs/emitter-idiom-policy.md` in place of the current worked example 2.
Per the re-opening section, re-running means REWRITING the entry, not amending its outcomes.

### 2a. Vue — `v-bind` and `v-on` shorthands with a value (`:id="x"`, `@click="h"`) — **sugar**

**Rewritten, not amended.** This entry previously read `DEFERRED` at Gates 1, 4 and 6 on the ground
that Vue was absent from the lockfile and no Vue emitter existed. Every one of those conditions has
been met — `vue@3.5.40` is in the lockfile at two importers, `packages/frameworks/vue` exists, and
`pnpm e2e` drives `demos/vue-official` on the `create-vite-extra@5.0.2 template-ssr-vue-ts` scaffold —
so the procedure was re-run in full by `frameless-vue-v1` T005. **It ripened into `PASS`.** The
`v-slot` limb did not travel with it and is now entry 2b.

Baseline: `v-bind:id="x"`, `v-on:click="h"`. Candidate: `:id="x"`, `@click="h"`, always with a value.

Domain, in emitter terms — THREE deciding sites, and there are no others in
`packages/frameworks/vue/src/emitter/index.ts`:

1. every string returned by `eventDirectiveName()` (the sole `v-on` spelling, reached only through
   `eventAttribute()`);
2. every dynamic binding printed by `attributesOf()`;
3. the literal key attribute printed by `renderKeyedRepeat()`.

- **G1 PASS.** Measured, not read, against `vue@3.5.40` / `@vue/compiler-sfc@3.5.40`, the build this
  repo ships and the same build the browser lane runs (asserted at test time, four ways, by the lane's
  own M4 test). Both forms produce an EXACT EMPTY diagnostic set — `errors` and `tips` — across
  `ssr x isProd`; template codegen and production `compileScript` output are byte-identical in all
  four modes; and rendered SSR HTML is byte-identical for all three scenario components with real
  props. The second arbiter was measured two-sided: `flat/essential` is clean on both forms, while the
  plugin's own `strongly-recommended` tier flags `vue/v-on-style` and `vue/v-bind-style` on the
  BASELINE and neither on the candidate. `DEFERRED — framework absent` is no longer available.
- **G2 PASS.** A spelling inside the emitted template. No import, no plugin, no dependency, no
  declaration by a parent or child, no build-graph edit. Nothing is asked of any other module.
- **G3 PASS.** The trigger is the emission site itself — the directive kind the emitter is already
  printing — never the contents of a handler body or an expression. The Gate 3 rider does not engage,
  because no content is inspected at all: the sugar applies at three sites unconditionally.
- **G4 PASS, and structurally rather than by sample.** `@vue/compiler-core@3.5.40`
  `dist/compiler-core.cjs.js:2435` normalises `:` to `bind` and `@` to `on` inside `ondirname`, at
  parse time, before any argument or modifier is read; the raw spelling survives only as `rawName`.
  Equivalence is therefore total over every argument and modifier by construction. The sample
  confirms it two-sidedly: 19 binding names spanning the emitter's own `ATTRIBUTE_NAME` language and
  9 event names spanning its own event-name language, each in four modes, zero divergence, with a
  planted divergent member proving the probe can report one. What lies outside the domain is refused
  by name rather than emitted silently: `assertPlainAttributeName` already rejects every attribute
  name beginning `:`, `@`, `#` or `v-`, so no directive can arrive through the static-attribute path,
  and modifiers are refused at the decision site.
- **G5 PASS.** Byte-identical generated code in all four modes on both compile paths means there is no
  consumer-detectable difference to have: not event routing, not initial or default values, not
  reactivity depth, not throw behaviour, not lifecycle, not the module's exports. The rendered SSR
  HTML agrees. **Stated so the green is not over-read:** the SSR-HTML arm is BLIND to event routing —
  the `.stop` control is IDENTICAL in both SSR modes and DIFFERS only in the client modes — so this
  gate rests on the client codegen identity, and the HTML arm is corroboration, not the proof.
- **G6 PASS.** `pnpm e2e` drives `demos/vue-official` on its official scaffold at the lockfile version
  and asserts S1/S2/S3 observations byte-equal to the react, solid, qwik and svelte lanes.
  `demos/vue-official/package.json` `copy-emitted` copies
  `packages/frameworks/vue/generated/{S1,S2,S3}.vue` into `src/emitted/` on every `dev` and every
  `build`, and the three checked-in demo files are byte-identical to the goldens today — so the lane
  drives THE EXACT EMITTED TEXT, not a hand-maintained facsimile. A shorthand that failed to bind
  would take out the S1 increment, S2 add/toggle/remove and S3 submit observations immediately. The
  emitted spelling is independently pinned in text by the gate's `no-directive-shorthand` and
  `baseline-form-inventory` policies, which this ruling requires to be INVERTED rather than deleted.

  **What G6 does NOT cover, stated so it is not mistaken for covered:** no behavioural check can
  distinguish the shorthand from the longhand, because they are behaviourally identical — which is
  what G1 and G5 measured. A silent revert to longhand would be caught by the gate's text policy
  alone, and would have zero user-visible consequence. Gate 6 is satisfied here in the sense worked
  example 8 satisfies it: the MECHANISM the sugar depends on is asserted behaviourally on the lane,
  and a wrong directive name fails immediately.

All six `PASS` — **sugar**. Adopt `:` and `@`, always with a value.

### 2b. Vue — `v-slot` shorthand (`#header`) — **no-sugar**

Split out of worked example 2 by `frameless-vue-v1` T005. It was carried along by the old entry's
three deferrals; measured separately, it does not share their fate.

Baseline: `v-slot:header`. Candidate: `#header`.

- **G1 PASS.** Measured at 3.5.40 alongside 2a, and it is the one gate this limb clears:
  `<Child><template v-slot:header>…</template></Child>` and the `#header` twin produce byte-identical
  codegen in all four modes with empty `errors` and `tips`. Planted member `#header` vs `#footer`:
  divergent, so the comparator can report one. Same `ondirname` normalisation, `#` to `slot`.
- **G2 PASS.** A spelling inside the emitted template.
- **G3 PASS.** Structural, not content-based.
- **G4 UNKNOWN — which is a no.** The Vue emitter EXISTS, so `DEFERRED — emitter absent` is
  discharged and unavailable. There is no deciding function to state a domain against: the emitter
  has no `v-slot` emission path anywhere, and the IR's slot vocabulary is a single
  `default-slot-projection` kind (`packages/compiler/src/schema.ts:173`) — IR-3, default slot only.
  The tempting move is "the domain is empty, so totality is vacuous, so PASS". It is refused on the
  policy's own precedent: worked example 7 refused exactly that move, and a vacuous totality is the
  folklore domain arriving by the back door.
- **G5 PASS.** No behavioural difference; same normalisation as 2a.
- **G6 FAIL.** No check can exist for a path the emitter refuses to emit — the same clause worked
  example 6's `on()` arm and worked example 7 record. The sugar's only justification is an artifact
  property nothing checks, because there is no artifact.

`FAIL` at Gate 6, `UNKNOWN` at Gate 4: **denied, not deferred.** Say which one decides it: Gate 6
does, and Gate 4 would deny it independently. **Re-open when IR-3 gains named-slot vocabulary AND the
Vue emitter emits a `v-slot`**, at which point all six gates are re-run and 2a's `PASS` does not
transfer — a measurement is valid for the construct it was taken on.

---

## Does `docs/emitter-idiom-policy.md` need updating

**Yes, and in three places.** None of them is optional, and none of them is this task's to make.

1. Worked example 2 is REPLACED by entries 2a and 2b above. The old entry's text — three `DEFERRED`s
   on framework-absent and emitter-absent grounds — is now false in this repo and would mislead the
   Angular board, which inherits its phrasing.
2. Gate 1's **Absent framework** paragraph names Vue in "Vue and Angular are absent today". That
   sentence is now wrong. It needs the same discharge sentence Svelte already carries: *Vue is not
   absent, and has not been since `frameless-vue-v1` T004 put `vue@3.5.40` in the lockfile; a Vue
   deferral recorded at this gate before that date is discharged, and re-running the entry may not
   record `DEFERRED — framework absent` again.*
3. Worked example 3 (`defineEmits`) opens `G1 DEFERRED — framework absent`, which is no longer
   available. **Its ruling does not change** — G5 `FAIL` decides it and `FAIL` outranks `DEFERRED` —
   but the entry now carries a stale label at G1 and G4. Re-running it is cheap and is queued behind
   the fold-back, not folded into it. Its dissent-of-record from T002 — that `defineModel` is DENIED
   at G2 rather than deferred, meaning IR-4 was never its blocker — is untouched by this ruling and
   remains a prediction for a later board to TEST.

Recording a ruling also requires a comment at the decision site in the emitter naming the ruling.
`packages/frameworks/vue/src/emitter/index.ts` currently carries the opposite comment — "DECISION
SITE - LONGHAND `v-on:`, never `@`" — with a paragraph saying the ruling is T005's to make. Leaving
that in place while the policy says `sugar` is exactly the "a ruling that exists only in a document
will be re-litigated by the next person to open the emitter" failure the policy names.

## Consequences the adopting package must handle — MEASURED, not predicted

- **The tier-exclusion test WILL go red.** `VUE_ESLINT_TIERS_EXCLUDED` records `firesOnCorpus` lists
  containing `vue/v-on-style` and `vue/v-bind-style` for both excluded tiers, and T003 shipped a
  standing test that re-measures them so the exclusion cannot rot. After the flip those two rules stop
  firing (measured above). Both lists and the recorded reason text need updating. **The exclusion
  itself STANDS** — it rests on six other measured rules, two of which would break the five-lane text
  observation, and `vue/v-on-style` passing is not a reason to adopt a formatter tier.
- **`no-directive-shorthand` must be INVERTED, not deleted.** Verified against the shipped gate today:
  `checkSources` reports 0 violations on the longhand corpus and 30 on the shorthand twin, split
  across `no-directive-shorthand` (25) and `baseline-form-inventory` (5). After the flip the polarity
  reverses, and both directions need a mutation row: a gate that only fires one way is half a gate.
- **`BASELINE_FORM_INVENTORY` needs `:` and `@` entries with floors.** `directiveForm` already reads
  `rawName` and returns the first character for a shorthand, which is why the twin trips the inventory
  today. The floor is `3.0` on the same evidence footing as the existing `v-bind`/`v-on` entries —
  which is `unverified`, and must be recorded as `unverified` rather than upgraded, because
  `ondirname` dates nothing. **Never record a floor you did not verify.**
- **The `fits` layout rule can move.** `renderHost` decides a single-line versus multi-line start tag
  by `width(indent, singleLine) <= PRINT_WIDTH`. The shorthand is 6 characters shorter per `v-bind`
  and 4 per `v-on`, so start tags that do not fit today may fit after the flip and the goldens will
  change layout. Start-tag layout is not rendered text, and the change can only ever REMOVE the
  `cannot inline` throw, never add it — but M1's condense rule makes text layout the one silent
  hazard on this lane, so `condense-stable-text` and the 18 e2e observation strings are the guard, and
  any movement in them is a stop.

## Standing lessons this ruling adds

- **A landed lane discharges exactly two deferrals and it really does discharge them.** This is the
  first entry on any board where `DEFERRED` at Gate 1 and Gate 6 ripened into `PASS` rather than
  curdling into `FAIL`. Worked example 6 curdled; worked example 7 curdled. The difference is not
  optimism — it is that the shorthand's whole claim was an equivalence, and an equivalence is the one
  kind of claim a lane can settle outright.
- **A bundled entry is a ruling waiting to be wrong about one of its members.** Worked example 2
  named three directives and two of them were only ever travelling on the third's deferral. The moment
  the deferral lifted they parted company. Prefer one construct per entry.
- **My own hypothesis about the value-less shorthand was measured FALSE** (M-G), and the correction
  matters: the hazard I thought the flip would introduce is symmetric and already present in the
  longhand. Recorded because a Judge inventing an asymmetry and then legislating against it is the
  same proxy-for-measurement fault this board has now caught four times.
