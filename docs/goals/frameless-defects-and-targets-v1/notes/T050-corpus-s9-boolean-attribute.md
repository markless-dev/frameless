# T050 — S9, the dynamic boolean attribute, in all six lanes

**Result: landed, and `docs/DEFECTS.md` entry 10 is CLOSED.** `pnpm e2e` reports
**6 demos × 8 scenarios, all observations equal**. The corpus goes 7 → 8
scenarios, 42 → 48 observation strings, 42 → 48 registered mutants.

**One blocker remains and it is outside `allowed_files`** (§5). **One new finding
was measured by this card and is not carded yet** (§3).

Everything below was measured on this tree. Nothing is inherited from the T050
card, from the T028 audit or from the predecessor receipt — the two claims I did
reuse (react-dom's and domino's tables) were **re-derived** before use, and one
of the predecessor's fixture assumptions turned out to be wrong (§3).

---

## 1. The measurement that decides entry 10

The decisive question the card posed: *does any lane serve the attribute
initially?* **No lane does.** Read off the `pnpm e2e` run, all six lanes:

| reading | react | solid | qwik | svelte | vue | angular |
| --- | --- | --- | --- | --- | --- | --- |
| **served payload**, gate `disabled` | absent | absent | absent | absent | absent | absent |
| **served payload**, field `f2` `disabled` | absent | absent | absent | absent | absent | absent |
| **served payload**, note `required` | absent | absent | absent | absent | absent | absent |
| live, as served | `null` | `null` | `null` | `null` | `null` | `null` |
| live, after lock | `""` | `""` | `""` | `""` | `""` | `""` |
| live, after unlock | `null` | `null` | `null` | `null` | `null` | `null` |
| live, `f2` after sealing it | `""` | `""` | `""` | `""` | `""` | `""` |
| live, `f1` (never sealed) | `null` | `null` | `null` | `null` | `null` | `null` |

**T049's lowering is CONFIRMED, not refuted.** The ruling does not re-open.

The six `s9` observation strings are byte-identical. Verbatim, once:

```
server-rendered gate carries disabled 0 times, note carries required 0 times and field f2
carries disabled 0 times, with the live gate null, note null, stage "open", fields f1,f2 and
sealed none
after locking gate = "", note = "" and stage = "locked" with the fields still null and null
after unlocking gate = null, note = null and stage = "open" with steps = 2
after sealing f2 the fields read f1 = null and f2 = "" with sealed = f2 and the gate still null
1 document request served this page
no console errors and no failed requests
```

### Why the absence is read at two sites

`forbidServedAttribute` reads the **server's own bytes** and says the lane never
sent it; `measureBooleans` reads the **live DOM** and says the lane does not hold
it after activation. A lane that served `disabled=""` and then removed it during
hydration passes the second and fails the first, and those are different facts
about the lowering.

`forbidServedAttribute` deliberately does **not** use `measureAttribute`, which
matches `name="value"` and is therefore blind to a bare, valueless `disabled` —
the minimized form an SSR serializer may write. Reading an absence with a reader
blind to one of the present spellings would report "absent" for a lane that
served it, which is the single result this scenario exists to be able to report.
It matches the name at an attribute boundary instead, so `disabled`,
`disabled=""` and `disabled="false"` are all caught.

It is calibrated **two-sided on every call**, because a check on an ABSENCE
passes by default on any payload at all, including an empty one. The negative arm
injects `name=""` into that one start tag of the payload the server really sent
and requires the read to reject it.

### Removal is asserted, not just addition

The unlock click is not decoration. A lane that wrote the attribute once and
never reconciled it passes every reading up to that point. Because an attribute
going ABSENT never "becomes true" and so cannot be awaited, the wait is on
`steps`, written by the **same handler in the same render** — the ordering
discipline `assertS3` established for its cancellation arms.

---

## 2. What the scenario binds, and why

`disabled` at **two structurally different sites**:

- **gate button** — bound to a component-level state cell;
- **a button inside the keyed repeat** — bound to a member of the LOOP VARIABLE,
  a different path through every emitter.

Both rows are seeded `off: false`, so nothing is served initially anywhere, and
sealing exactly one of two identically-seeded rows separates "the boolean reached
its own row" from "every button in the repeat reflects the same value".

`data-stage` rides the **same element** as the gate's `disabled` and stays
`kind: 'attribute'`. That contrast is what makes S9 about the KIND rather than
about the element, and Angular prints both in one start tag:

```html
<button type="button" data-gate="true" [disabled]="locked" [attr.data-stage]="stage">gate</button>
```

`[disabled]`, not `[attr.disabled]` — exactly the form T041 §7 specified.

**IR, re-derived:** `disabled` ×2 and `required` → `kind: 'property'`;
`data-stage`, `data-field`, `data-seal`, `data-oracle-attr-key` →
`kind: 'attribute'`. **11 dynamic sites, ZERO zero-read.** Neither the
interior-whitespace v-limit nor Solid's `show-two-arm` policy fired — no guard
was touched or moved.

### Axis, and why it is not S7's

S7's axis is *a dynamic attribute is dynamic*: absent, `"false"` and a value are
three states, on `data-*`/`aria-*` bindings the lanes already agreed on. S7
proves the **reader** keeps `null` and `"false"` apart. S9 proves the
**lowering** makes six lanes agree on a genuine boolean content attribute — a
binding whose IR kind is `property`. Different kind, different site, no
duplication of the ratified stopping rule's clause 6.

---

## 3. FINDING — `hidden` is NOT portable through the Qwik lane

**Measured by this card, and it refutes an assumption the fixture was built on.**

S9 originally bound `hidden` on a `<p>` as a second name in the class. `pnpm e2e`
went red in exactly one lane at exactly one reading:

```
after locking the note reading is "\"true\"", not "\"\"".
```

Complete six-lane measurement, taken by re-running with the reading recorded
rather than asserted so every lane reported its own value:

| reading | react | solid | qwik | svelte | vue | angular |
| --- | --- | --- | --- | --- | --- | --- |
| served, `hidden` | absent | absent | **absent** | absent | absent | absent |
| after lock | `""` | `""` | **`"true"`** | `""` | `""` | `""` |
| after unlock | `null` | `null` | **`null`** | `null` | `null` | `null` |

**The cause, read out of Qwik's own source** rather than inferred —
`demos/qwik/node_modules/@qwik.dev/core/dist/core.mjs:6774`, `isBooleanAttr`
lists 21 names:

> `allowfullscreen, async, autofocus, autoplay, checked, controls, default,
> defer, disabled, formnovalidate, inert, ismap, itemscope, loop, multiple,
> muted, nomodule, novalidate, open, playsinline, readonly, required, reversed,
> selected`

**`disabled` is on it. `hidden` is not.** So Qwik minimizes one and stringifies
the other. Qwik's behaviour is asymmetric but self-consistent: it omits on
`false`, removes on the transition back, and writes `"true"` on `true`.

**This is a SERIALIZATION divergence, not a behavioural one.** `hidden="true"`
still hides the element — the attribute is boolean, so its presence is the
signal. This is precisely the class T041 §2.3 named, where a spelling diverges in
bytes while every lane does the right thing. T041 also ruled why that still
fails: *"this harness deliberately asserts the byte-level distinction… A
serialization divergence is a genuine failure by this project's own oracle."*

**It is NOT an upstream matter and must not be filed as one.** Qwik's attribute
table is Qwik's own and is internally consistent; it is this repo's oracle that
asserts bytes. Per the standing rule, a framework is not to be read as defective
for behaviour inside its own design envelope.

**The repair to the fixture:** `hidden` → `required`, which is in qwik's, vue's
and svelte's boolean tables and is canonical lowercase in React, and which
measured green in all six. `required` was checked against every table I could
reach **before** the run, and re-derived in react-dom 19.2.3
(`false` → `<input type="text"/>`, `true` → `<input type="text" required=""/>`)
and in Angular's bundled domino (`false` → `<input>`, `true` →
`<input required="">`).

**This was not a fixture adjusted to hide a result.** The decisive result — does
any lane serve `disabled` initially — is *no*, in all six, and is reported above.
`hidden` was my own addition to strengthen the scenario, it is excluded on the
same measured grounds and by the same precedent the card already applies to
`readonly`/`autofocus`/`autoplay`, and the measurement is recorded here and in
the ledger rather than dropped.

### The standing gap this makes visible

`DOM_BOOLEAN_CONTENT_ATTRIBUTES` admits fourteen names. **Four are now measured
non-portable through some lane:**

| name | lane | what it does |
| --- | --- | --- |
| `readonly` | react | serves nothing in BOTH states, `console.error: Invalid DOM property` |
| `autofocus` | react | same |
| `autoplay` | react | same |
| `hidden` | **qwik** | serves `hidden="true"` where five lanes serve `""` |

The compiler's admission rule cannot see any of them: **it asks what the DOM
accepts, not what each lane's serializer does.** T051 already names the React
three and its constraint says clause 3 must be amended to say *per-lane
serializer* rather than *DOM*. **The Qwik row is new and belongs on that card** —
it is the same defect shape in a second lane, and it shows the amendment is not
React-specific. T051 is queued and unrouted; I did not edit it, as the board is
PM-owned.

---

## 4. Instruments

**Six mutants, one per lane**, in `scripts/corpus-mutation.mjs`, each replacing
the gate's binding with a static `disabled="false"` — the exact byte sequence the
defect produced, and a string BOTH react-dom and domino read as **true**, so the
mutant ships a really-disabled control where every lane must ship an enabled one.
Spelled in each lane's own idiom, verified against the final generated bytes:

| lane | anchor | occurrences | non-vacuous |
| --- | --- | --- | --- |
| react | `disabled={locked}` | 1 | yes |
| solid | `disabled={locked()}` | 1 | yes |
| qwik | `disabled={locked.value}` | 1 | yes |
| svelte | `disabled={locked}` | 1 | yes |
| vue | `:disabled="locked"` | 1 | yes |
| angular | `[disabled]="locked"` | 1 | yes |

Red at **two** of the four readings — as served, where the attribute must be
absent, and after unlock, where it must have gone absent again. A mutant red at
only one end could be satisfied by a lane that froze the attribute at a
correct-looking value.

**`pnpm mutate:corpus` was NOT run** — per `stop_if`, it restores with
`git checkout --` over `MUTATION_SURFACE` and is dangerous on a shared tree. The
sole writer runs it after commit. **Until it does, entry 10's third conjunct is
registered but not witnessed, and the ledger says so in those words.**

**No exception path was added to `scripts/e2e.mjs`.** The equality check is
untouched; S9 passes it on strict `JSON.stringify` equality against the react
reference lane like every other scenario.

**Size budgets recorded, not derived** (a budget is a measurement):
react `S9 { physicalLoc: 72, structuralNodes: 369 }`,
solid `S9 { physicalLoc: 69, structuralNodes: 369 }`. The two lanes land on the
**same** structural node count, the only scenario in the corpus where they
coincide.

**The derived inventories picked S9 up with ZERO hand edits**, as the constraint
required — and they were watched going red first: with the golden written and no
`generated/S9.*` present, `pnpm test` went from 1004 to 1010 tests with 14
failures across the six lanes' derived corpora, then green as each artifact
landed. The only hardcoded lists that needed edits are the thirteen the card had
already been widened to cover.

**Determinism:** the six `generated/S9.*` are byte-identical across a second
`regenerate` (shasum-compared, since `git diff --exit-code` is vacuous for
untracked files). **No existing golden or generated byte moved** —
`git diff --exit-code` over all six `generated/` directories and the goldens is
clean.

---

## 5. BLOCKER — two Vue gate rows need a file outside `allowed_files`

`pnpm test` is **1013 passed, 2 failed**. Both failures are in
`packages/frameworks/vue/test/gate.test.ts`, and **neither is caused by a defect
in S9**. They are a derived instrument working exactly as designed.

The Vue gate's two refusal MESSAGES state corpus counts as prose, and
`gate.test.ts` **derives** those counts and requires the message to match — its
own comment says the ordering exists so "a corpus change reports as *the instance
count moved*". Growing the corpus moved them:

| message literal, `packages/frameworks/vue/src/gate/index.ts` | says | derivation now says |
| --- | --- | --- |
| line 1013 (worked example 12a) | `seven-scenario corpus` | `eight-scenario corpus` |
| line 1057 (worked example 12b) | `seven-scenario corpus` | `eight-scenario corpus` |
| line 1057 (worked example 12b) | `SEVENTEEN printed entries` | `NINETEEN printed entries` |

S9's `AttrBoard` declares two prop entries (`seed`, `onTrace`), both of names
already in the set — so `entries` 17 → 19 and `distinctNames` stays six. The
two-way host count is **unchanged at EIGHT**: S9 binds no `value`/`checked`.

**The edit is three number-words in one file. That file is not in
`allowed_files`, and neither is the test.** Per `stop_if` — *"Need files outside
`allowed_files`"* — I did not make it. This is the complete set: those are the
only two failing tests and the only file that can fix them.

This is **not** the constraint's "a derived inventory needed a hand edit" case,
and the distinction matters. The derivation needs no edit and is correct; what
went stale is a **recorded measurement embedded in a shipped refusal message**,
which is deliberately pinned by a derived test so it cannot rot silently. The
instrument caught exactly what it was built to catch.

---

## 6. Corrections to the record

- **The T028 audit's §6 process observation is FALSE AT HEAD.** Already corrected
  on the T050 card by the PM; re-confirmed here only in that the thirteen widened
  files were all genuinely required — every one was touched.
- **The predecessor's "portable eleven" is really a portable TEN at best.** Its
  FINDING_1 named three non-portable names, measured against React only. `hidden`
  is a fourth, in a lane nobody had checked. The number in that receipt was not
  wrong given what it measured; it was measured on one lane's serializer, and the
  gap it names is exactly the gap that hid the fourth.
