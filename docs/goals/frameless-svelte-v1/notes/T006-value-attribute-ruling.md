# T006 — the S3 `value` attribute: ruled, and repaired at the site

Recorded by T007, the Worker package that carried the ruling out. T006 is the
Judge task; this note is the durable record of what it decided, what it rejected
and why, and what the repair costs.

## The conflict

`demos/svelte-official` was the first instrument in this repo that **hydrates
Svelte**. It failed `pnpm e2e` on exactly one observation out of thirty-six:
S3's `server-rendered text`.

Root cause, verified against the installed source at svelte 5.56.8
(`src/internal/client/dom/elements/attributes.js`): `remove_input_defaults()`
deletes the `value` and `checked` **attributes** on hydration **by design**,
preserving the **property**. It is guarded by `if (!hydrating) return` and
deferred to an idle callback for performance. SSR emits `value="hello"`
correctly; the client removes it.

The `if (!hydrating) return` guard is why `packages/frameworks/svelte`'s browser
lane never saw this: that lane mounts directly.

## The ruling: option D

> Read the `value` attribute out of the **served payload** rather than the
> post-activation live DOM.

Not the emitter, not a per-lane declaration.

The argument that carries is narrower than the one T004 offered, and is provable
from the contract source alone **without any reference to Svelte**:
`three-way-contract.ts` reported the observation as `server-rendered text = …`
while reading `await page.content()` — the *post-activation* DOM. **The name and
the measurement site disagreed**, and that was true of this file before a fourth
lane existed.

T004's own reasoning — "not user-visible, reproduces on a stock scaffold,
therefore unfair" — was explicitly **refused** as the ground. It is weak standing
alone: "not user-visible" would excuse many real defects, and "reproduces on a
stock scaffold" is satisfied by any framework behaviour including genuinely bad
ones. Instrument rule 1 is a rule about evidence, not a licence.

## The three rejected options

### A — emit `defaultValue={text}` alongside `value={text}` (emitter). REJECTED.

Rejected on three independent grounds, any one of which is sufficient:

1. **It violates this board's own T002 ruling 3.** IR-4 is deferred and the
   emitter is bound to emit only baseline-version-safe forms. `defaultValue`
   attribute support is a Svelte 5.x feature, not 5.0 baseline — and the exact
   floor is *unverified*, which is itself the point: A would ship a
   version-gated form with no way to know the consumer's version.
2. **It reintroduces the bug `remove_input_defaults` exists to prevent.**
   `RegularElement.js` routes `defaultValue` to the safe `set_default_value`
   helper **only beside a static text `value` attribute**. S3's `value={text}` is
   an *expression*, so `defaultValue={text}` falls through to a bare property
   assignment. Svelte's own comment says why that is wrong: updating the default
   value while the input is pristine also updates the current value. A would make
   every emitted Svelte form reset to *current* state rather than the original
   default.
3. **It is invisible to the server.** `server/visitors/shared/element.js` omits
   `defaultValue`/`defaultChecked` from SSR output entirely. A changes nothing
   the server sends; it is a purely client-side attribute-restoration hack
   performed for the benefit of one test read.

A **works** — T004 probed it and the whole lane went green with the contract
unmodified. It is rejected precisely because a green obtained by shipping a
form-reset bug into every consumer's Svelte output is the instrument-fault
pattern *moved into the product*.

**Does DEFECTS.md finding 5 (Solid's `attr:value`) bind?** It binds **against**
A, not toward it. Finding 5's decisive evidence was that *handwritten* Solid
references use `attr:value` too — the emitter was reproducing a house idiom, not
inventing one. No handwritten Svelte reference emits `defaultValue={text}`.
Finding 5's holding was "the emitter is right, do not change emitted output"; A
is the opposite move, so citing it for A inverts it.

### B — read the `value` **property**. REJECTED: not costly, **impossible**.

The PM brief said "two proven repairs". Only A was ever probed. `PageHandle`
(`@async/witness` 0.7.0, `index.d.mts`:163-189) exposes `route`, `url`, `reload`,
`content`, `networkRequests`, `emulateNetwork`, `click`, `trackEvents` — **no
`evaluate`**. `evaluate` exists only on the internal `WitnessBrowserPage`, never
handed to a box. `PageExpectApi` has no property accessor, and `page.content()`
is documented as serialized HTML, so properties are invisible to it by
construction. **No box can read a DOM property.**

### C — assert both attribute and property, declared per lane. REJECTED as a dodge.

`servedClientEntry` and `expectedNavigations` are per-lane **preconditions** —
they sit *outside* the `observed` array that `scripts/e2e.mjs` compares across
lanes. A per-lane declared `value` expectation would sit **inside** the equality
claim. That is categorically different, and precisely the mechanism by which any
future lane declares its way out of a real failure.

**The boundary to police is not "is it declared per lane" but "is it inside the
cross-lane equality set".**

## What landed

All inside `demos/react-official/three-way-contract.ts` and the four
`scenarios.box.ts` files. No emitter, no IR, no demo app source, no lockfile.

- `runScenario` takes a **required** `served: EnvironmentResponse`. Required, not
  optional, for the reason `servedClientEntry` is a total `Record`: an optional
  field is a silent opt-out, and a scenario that reads the served payload must
  not be able to receive `undefined` and fall back to the live DOM. `served` was
  already in scope at all four call sites — it is the same response
  `assertServedActivation` already asserts, so no lane pays for a second request.
- The scenario assertion signature widened to `(page, expect, served)`. S1 and S2
  declare two parameters and observe only live state.
- `assertS3` **deletes** `expect.page.attribute(page, '[data-action="text"]',
  'value', 'hello')` and reads the value through the new
  `measureServedAttribute`, which is scoped, exact and calibrated.
- `measureText(initial, 'data-writes="true"')` **stays on the live DOM**. `writes`
  *is* live state — it starts at 0, the submit handler drives it to 2, and it
  reading 2 after the cancelled submit is the independent signal that no reload
  happened. Moving it would be the same mistake in the other direction.
- `locate()`'s error message no longer says "the live DOM carries no …". These
  readers take a string and are site-agnostic on purpose; the caller knows the
  site, so the caller names it. Leaving a reader that misnames its own
  measurement site inside the repair for a misnamed measurement site would have
  been ironic.

### The calibration

`measureServedAttribute` runs three checks in order, on **every call**, in
**every lane** — not once from a box, so no lane can hold the check and skip its
calibration.

1. The marker is in the payload at all, with a message that distinguishes "the
   server never rendered the element" from "activation removed it".
2. The attribute reads exactly `hello`. This has to be here: cross-lane equality
   alone cannot pin the string, because four lanes that all served the wrong
   value would still agree with each other.
3. Two negative arms, both mutating the **evidence** rather than the literal:
   - **payload-wide** — every `value="hello"` deleted, the same read must stop
     returning `hello`. This is `calibrateServedClientEntry`'s arm and carries
     the same two vacuity guards.
   - **scoped** — `value="hello"` deleted from the marked element's start tag
     *only*, every other occurrence in the payload left intact; the read must
     still reject. This one is **not** tautological given check 2: it separates
     "the marked element carries the attribute" from "the string appears
     somewhere in the bytes", which is exactly the discrimination an unscoped
     `contains` check would silently lose.

It deliberately does **not** route through `expect.response.matches`. That would
add a receipt statement that can never fail independently of check 2, and a check
that cannot go red is not a check. `forbidInServedPayload` is hand-rolled on the
served payload for the same reason.

### Recorded red runs

Driven against the payload SvelteKit dev really served for `/s3` at
@sveltejs/kit 2.70.1 (`<input data-action="text" value="hello"/>`):

| arm | outcome |
| --- | --- |
| positive, real payload | returns `"hello"` |
| `value="hello"` deleted payload-wide | `carries value=null on data-action="text", not "hello"` |
| attribute moved off the marked element, string left elsewhere in the payload | rejected |
| marker absent | `the payload served for /s3 carries no data-action="text"` |
| `value="bye"` | `carries value="bye" … not "hello"` |
| `locate` on HTML without the marker | site-agnostic message, names no site |

## Why this is a widening, not a weakening

Against T999's three-part test:

**(1) Uniform.** Same site, same predicate, same exact string, all four lanes. No
lane receives a value, tolerance or exemption the others do not, and nothing was
added to the `observed` array.

**(2) A uniform trade, with the lost class enumerated per lane and a re-open
trigger naming it.** (Criterion 2 as originally written demanded a strictly
*smaller* set of accepted behaviours **and** a written statement of what the old
check caught that the new cannot — two clauses that cannot both hold, since the
second describes behaviours the new check accepts and the old rejected. T999
restated it; see "Carried forward" below and the restated criterion on the board.)
Demonstrated on the real served bytes:

| counterfactual | old read (live DOM) | new read (served bytes) |
| --- | --- | --- |
| a lane that sent **no** `value` and produced the input client-side from scratch | **PASS** (`hello`) | **FAIL** |
| the real Svelte lane: server sent it, hydration deleted it | **FAIL** (`null`) | **PASS** |

The first row is the widening: the old read could be satisfied by markup the
server never sent. Under the new read the string must be in the server's own
bytes — and this repo's entire thesis is inert-markup-plus-activation, so the
served payload is the thesis's own measurement site. `assertServedActivation`
already fetches it.

**(3) Still inside the equality set and still exact.** The observed string is
unchanged and identical across all four lanes, and `scripts/e2e.mjs` still
compares it. Verified by hash over the four witness receipts:

```
react   "server-rendered text = hello with writes = 0" sha256=f9cab7779ec00ed2
solid   "server-rendered text = hello with writes = 0" sha256=f9cab7779ec00ed2
qwik    "server-rendered text = hello with writes = 0" sha256=f9cab7779ec00ed2
svelte  "server-rendered text = hello with writes = 0" sha256=f9cab7779ec00ed2
```

`[e2e] PASS — Three-way: 4 demos x 3 scenarios, all observations equal`.

### Pre-existing heterogeneity, found on the way

The `value` attribute had been measuring **four different things** across the
incumbents — one per lane, no two alike. Nobody noticed because all four agree at
`hello` and the read happened before any interaction. This predates the Svelte
lane entirely. The four behaviours are in the measured table below.

**Corrected 2026-07-27 by T011.** This paragraph used to say "frozen SSR markup
for React". That is where the false `react` cell entered the record — *before*
T010, which then carried it forward. React is the one lane that **does** rewrite
the attribute at hydration. The rule this keeps re-teaching: a lane's behaviour
at hydration is not readable off an emitted golden, and prose that was never
measured does not become measured by being copied into a table.

## Carried forward — the loss, and when to re-open

**What the old check could catch that the new one cannot:** that the `value`
attribute on the marked element *survived activation unchanged*. Under the new
read a lane could delete, alter or never install that attribute after hydration
and the observation would not move. For Svelte that is by design.

**Corrected twice. Read the history, because the history is the finding.**

*First correction, 2026-07-27 by T999.* An earlier revision claimed the lost
coverage "maps to no product claim, because the attribute survives the SSR parse
independently of framework state in every lane, so it never witnessed client
state in **any** lane." Refuted, and self-contradicting.

*Second correction, 2026-07-27 by T011, and it is the one that matters.* T010's
replacement table was labelled `measured_truth_per_lane`. Only one of its four
cells had been measured, and the only thing measured was an **emitted golden** —
which cannot decide what a framework does to the DOM at hydration. The `react`
and `qwik` cells were carried over as prose from T006 and never measured at all;
the `solid` cell was *inferred* from `attr:value={text()}` in the golden. Two of
the four were wrong.

**All four cells below were measured in Chromium**, against the four official
demos on their own dev servers, with **two independent instruments** that agree:

- **Instrument 1 — client mis-seed.** The server renders `initial="hello"`; the
  client's own module is rewritten *in flight* (Playwright route interception, no
  repo file touched) to seed `"bye12"`. This is literally "S3's `text` seeded
  wrong at hydration". Not applicable to qwik, which does not re-execute the
  component at resume — see instrument 3.
- **Instrument 2 — served-markup divergence.** The reverse: the served markup's
  `value="hello"` is rewritten to a sentinel while client/transported state stays
  `"hello"`. Applies uniformly to all four lanes.
- **Instrument 3 — transported-state divergence (qwik only).** The `qwik/state`
  script is patched to `"bye12"` while the markup keeps `value="hello"` — the
  qwik analogue of a mis-seed, since qwik's state arrives serialized rather than
  re-computed.

Every run carried a **control input outside the framework's root** with the same
markup, which stayed frozen throughout — so a null result means "the lane did not
write", not "the probe could not see a write".

| lane | the `value` **attribute** in the live DOM after activation | would the old read have caught a mis-seed? |
| --- | --- | --- |
| **react** | **REWRITTEN from client state** | **YES — this is the only lane that goes red** |
| solid | not written at hydration; tracked only *afterwards* | no |
| svelte | removed by `remove_input_defaults` | no (it cannot even run) |
| qwik | never written, at resume or on re-render | no |

**react** (react-dom 19.2.3). Instrument 1: served `value="hello"`, client seeded
`bye` → attribute **`bye`**, control frozen at `hello`. Instrument 2: served
sentinel, state `hello` → attribute **`hello`**. Cause, in the shipped source at
`demos/react-official/node_modules/react-dom/cjs/react-dom-client.development.js`:

```js
1720:  isHydrating || value === element.value || (element.value = value);  // SKIPPED while hydrating
1721:  element.defaultValue = value;                                       // UNCONDITIONAL
```

`.defaultValue` on an `<input>` *is* the `value` content attribute, so line 1721
rewrites the attribute on every hydration. The hydration call site is `:5287`,
which passes `isHydrating = true`.

**solid** (solid-js 1.8.22) — **this is the cell T010 got backwards.** Instrument
1: client seeded `bye12` → attribute **and** property both stay `hello`.
Instrument 2: state `hello`, markup sentinel → both stay at the sentinel. Cause,
in `demos/solid-official/node_modules/solid-js/web/dist/web.js`:

```js
148:  function setProperty(node, name, value)  { if (isHydrating(node)) return; ... }
152:  function setAttribute(node, name, value) { if (isHydrating(node)) return; ... }
```

Solid **suppresses the hydration-time write outright**, for the property and the
attribute alike. `attr:value={text()}` is still signal-tracked — the two-sided
control proves it: a real post-activation edit through the emitted `onInput`
moved the attribute to `typed99` in both instruments. So `docs/DEFECTS.md`
finding 5 **stands**; what is refuted is the *inference* from it. "Signal-tracked"
and "written at hydration" are different facts, and only the first was ever
measured. In Solid a mis-seeded `text` is invisible in the attribute *and* the
property until the next update.

**svelte** (svelte 5). Instrument 1: attribute **absent**, property `bye12` — the
client seed reaches the property, `remove_input_defaults` having deleted the
attribute. Instrument 2 agrees.

**qwik** (@qwik.dev/core 2.0.0-beta.38) — **measured, no longer inherited.**
Instrument 2: the attribute holds the sentinel at load, after `q:container`
reaches `resumed`, and after a post-activation edit that moved the *property* to
`typed99` while the attribute did not move at all. Instrument 3: with the
transported state patched to `bye12`, the container resumed, the handlers ran
(`data-writes` reached `2`) and a re-render was forced through a different signal
in the same component — attribute and property both stayed `hello`. Qwik binds
the property and never the content attribute. The inherited prose happened to be
right; it is now right *and* measured.

**Option D is therefore a uniform *trade*, not a superset.** It gains the
counterfactual-A class in all four lanes and loses one class in one lane. The
lost class, stated exactly: ***"S3's `text` seeded wrong at hydration, REACT lane
only."*** Not Solid — Solid cannot see it either. For solid, svelte and qwik the
old live-DOM read observed nothing about client state at activation, so for those
three the gap was **revealed** by the site correction; for react alone it was
**caused** by it.

The ruling **stands** on grounds untouched by this correction. The name/site
mismatch (`server-rendered text` reported from `await page.content()`) is
provable from the contract source alone, without reference to Svelte, and
predates the Svelte lane. And the lost class was never a *declared* claim: it was
the incidental byproduct of one framework's `attr:` idiom, observed through an
assertion whose stated name promised the served payload instead. Losing coverage
you never claimed, uniformly, with the loss written down, is a legitimate site
correction. Losing it *silently* would not be.

**The re-open trigger already names it.** "A state-seeding hydration bug is
suspected in any lane" — third bullet below — is precisely the lost class. No new
trigger is required; this correction records what that bullet is protecting.

**The larger gap the ruling revealed:** after this change, **no lane observes
S3's `text` in the live DOM at all.** Emitted S3 surfaces `text` only through
`value={text}` — an input *property* after activation — and no sanctioned witness
API can read a DOM property (see the rejection of B). S3's live coverage of
`text` narrows to the submit handler's `onTrace` payload, which the analyzer lane
checks. For solid, qwik and svelte this gap was **revealed** by the site
correction, not caused by it — measurement shows none of the three ever wrote
client state into that attribute at activation. For **React** the correction did
**cause** it: that lane had live coverage of a mis-seeded `text`, through
react-dom's unconditional `element.defaultValue = value` at hydration, and no
longer has it. (Corrected 2026-07-27 by T011; this sentence previously named
Solid, on the strength of an emitted golden rather than a measurement.)

**Re-open trigger.** Re-open when **any** of:

- `@async/witness` exposes a property or `evaluate` accessor on `PageHandle`;
- the corpus grows a scenario rendering state as **text** rather than only as an
  input value;
- a state-seeding hydration bug is suspected in any lane.

The Judge's own preferred repair — give S3 a text-rendered projection of `text`
so `expect.page.text` can observe it live in all four lanes — would **close** this
gap rather than record it. It is a corpus change touching the compiler goldens
and all four emitters, so it belongs to a future package, not this one.

**Latent twin, corrected 2026-07-28 by T042 — no longer latent.** This
paragraph used to say the `checked` deletion "is not asserted today, so there
is no impact." That is false at HEAD. Svelte's `remove_input_defaults` strips
`checked` exactly as it strips `value`, and S7
(`docs/goals/frameless-defects-and-targets-v1/notes/T030-corpus-s7-form-controls.md`
§4.1) now measures the deletion end to end, in a real browser, on the served
payload and the live DOM: svelte serves `checked` and hydration deletes it,
where react/angular serve it and never move it again, solid/qwik add it at
activation and freeze it, and vue adds it at activation and tracks state — a
four-way split from one shared IR.

`checked` still never enters the cross-lane **observation string** — the same
trade `assertS3` records for `value` above: each control's effect is witnessed
through `picked` and `chosen` instead of by reading the attribute back. So "not
asserted" remains literally true; "no impact" does not. The deletion now has a
measured, recorded behavioural consequence, even though it is witnessed
indirectly rather than by reading the attribute.

Re-derived, not inherited, before writing this correction:
`packages/frameworks/svelte/generated/S7.svelte` carries exactly three
`checked=` bindings at HEAD (two radios sharing a group, one checkbox inside a
keyed repeat), matching T030's count. S9 (`AttrBoard`) also binds boolean
attributes — `disabled` and `required` — but adds no `checked` binding in any
of the six generated lanes, so "three" is not yet stale in either direction.
This count names one scenario's own bindings, not a corpus-wide total, and
should be re-derived again rather than copied forward if the corpus grows
another form scenario.

## The T999 correction

T002's instruction — "the SET of assertions and the exact strings asserted must
be byte-unchanged for react, solid and qwik" — is **superseded**. It was a proxy
masquerading as a measurement, written before this conflict was known, and it
would have **failed a correct repair**, which is its own instrument fault. The
three-part widening test above replaces it, along with the
precondition-versus-observed boundary from the rejection of C. This is recorded
on T999 in `state.yaml`.

## Standing uncertainties

- The exact Svelte minor that introduced `defaultValue` attribute support is
  **unverified** — the installed package ships no CHANGELOG. Load-bearing for
  ground 1 against A; grounds 2 and 3 are independent, so the rejection stands.
- Not verified: whether SvelteKit's SSR of an input with an *expression* `value`
  emits the attribute under every render path (streamed, error boundary,
  deferred). If the Svelte row ever flakes on this observation, look here before
  touching the contract again. T004's curl verification is now a **standing
  check** rather than a one-off: `measureServedAttribute` runs on every lane on
  every run, and its first check fails loudly if the bytes stop carrying it.
- This board has now ruled "instrument" repeatedly. The guard against that habit
  was refusing T004's offered reasoning and grounding the ruling on a name/site
  mismatch provable from the contract source alone. If a reviewer thinks that
  distinction is too fine, the honest fallback is **not** repair A — it is
  accepting that S3's `text` channel cannot be observed live under the current
  witness API, and saying so.
