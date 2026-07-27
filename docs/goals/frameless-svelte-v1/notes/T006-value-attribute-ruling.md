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

The `value` attribute had been measuring **three different things** across the
incumbents: frozen SSR markup for React, a signal-tracking attribute for Solid
(DEFECTS.md finding 5 measured exactly that), and deliberate removal for Svelte.
Nobody noticed because all three agree at `hello` and the read happened before
any interaction. This predates the Svelte lane entirely.

## Carried forward — the loss, and when to re-open

**What the old check could catch that the new one cannot:** that the `value`
attribute on the marked element *survived activation unchanged*. Under the new
read a lane could delete, alter or never install that attribute after hydration
and the observation would not move. For Svelte that is by design.

**Corrected 2026-07-27 by T999.** An earlier revision of this section claimed the
lost coverage "maps to no product claim, because the attribute survives the SSR
parse independently of framework state in every lane, so it never witnessed
client state in **any** lane." That sentence is **refuted by this repo's own
emitted output**, and it contradicted the heterogeneity finding ten lines above
it, which already said the attribute was "a signal-tracking attribute for Solid".
The measured truth, per lane:

| lane | what the old live-DOM read observed after activation |
| --- | --- |
| react | frozen SSR markup; the attribute is never rewritten |
| qwik | frozen SSR markup; the attribute is never rewritten |
| svelte | deliberately removed by `remove_input_defaults` |
| **solid** | **`attr:value={text()}` — a signal-tracked content attribute** |

`packages/frameworks/solid/generated/S3.jsx:20` emits **both** `value={text()}`
and `attr:value={text()}`. The second is exactly what `docs/DEFECTS.md` finding 5
measured: `attr:` means "write the content attribute", and it is signal-tracked.
So in the **Solid lane the old read did witness post-hydration state** — a
mis-seeded `text` at hydration would have rewritten the attribute and the old
assertion would have gone red.

**Option D is therefore a uniform *trade*, not a superset.** It gains the
counterfactual-A class in all four lanes and loses one class in one lane. The
lost class, stated exactly: ***"S3's `text` seeded wrong at hydration, Solid lane
only."*** Nothing else moves; react and qwik serve frozen markup and svelte
deletes the attribute, so for those three the old read genuinely observed nothing
about client state.

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
checks. For react, qwik and svelte this gap was **revealed** by the site
correction, not caused by it. For **Solid** the correction did **cause** it: that
lane had live coverage of `text` through `attr:value` and no longer has it.

**Re-open trigger.** Re-open when **any** of:

- `@async/witness` exposes a property or `evaluate` accessor on `PageHandle`;
- the corpus grows a scenario rendering state as **text** rather than only as an
  input value;
- a state-seeding hydration bug is suspected in any lane.

The Judge's own preferred repair — give S3 a text-rendered projection of `text`
so `expect.page.text` can observe it live in all four lanes — would **close** this
gap rather than record it. It is a corpus change touching the compiler goldens
and all four emitters, so it belongs to a future package, not this one.

**Latent twin, recorded so it is not rediscovered as a new finding:** Svelte's
`remove_input_defaults` strips `checked` identically. S3's checkbox carries
`checked={checked}` and is not asserted today, so there is no impact.

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
