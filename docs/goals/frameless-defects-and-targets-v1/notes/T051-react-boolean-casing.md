# T051 — The four non-portable names, and the rule that could not see them

Worker, 2026-07-28. Board: `docs/goals/frameless-defects-and-targets-v1/state.yaml`.
Tree read and edited at `12760d3`, verified myself before touching anything:
`git rev-parse HEAD` and `origin/main` return the same sha, `git status --porcelain`
was empty, and `pnpm test` reported **1015 passed**, matching the dispatch.

**Everything below was re-derived at this tree.** Nothing is inherited from the
card, from T049's note or from T050's. Three inherited claims turned out to be
**wrong**, and they are called out where they appear (§1.3, §2.2, §5.2).

---

## 0. What shipped

- **react's `jsxName` gains three entries** — `autofocus`/`autoplay`/`readonly` →
  `autoFocus`/`autoPlay`/`readOnly`. Registered two-sided against react-dom's own
  rejections, executed, not listed.
- **Clause 3 amended**, clause 5 added, in `packages/compiler/src/build.ts`.
- **`LANE_PORTABLE_BOOLEAN_ATTRIBUTES`** — twelve names — because one set was
  answering two different questions.
- **A six-lane serializer matrix** in `packages/compiler/test/enriched-ir.test.ts`,
  four lanes executed.
- `docs/DEFECTS.md` entry **13**, filed **OPEN**.

**The fourteen names stay admitted.** Removal was measured and refused (§3.1).

---

## 1. The RED, witnessed before anything changed

### 1.1 react — served nothing in BOTH states, plus the console error

Measured at react-dom 19.2.3, each name on the element that defines it:

```
true  autofocus  <input/>                    console.error: Invalid DOM property `autofocus`. Did you mean `autoFocus`?
false autofocus  <input/>
true  autoplay   <video></video>             console.error: ... `autoplay` ... `autoPlay`?
false autoplay   <video></video>
true  readonly   <input/>                    console.error: ... `readonly` ... `readOnly`?
false readonly   <input/>
true  disabled   <button disabled=""></button>     <- the unmoved control
```

### 1.2 qwik — `hidden="true"` where five lanes read `""`

Qwik's standalone SSR renderer **refuses to run without a real client build
manifest** (`Client manifest is not available`), and hand-rolling one is the exact
trap this repo has already lost a goal to. So qwik was measured at its **deciding
function**, read out of `@qwik.dev/core` 2.0.0-beta.38's own `dist/core.mjs`, and
the code path traced rather than guessed:

```js
// core.mjs, SetAttributeOperation
if (isBooleanAttr(element, attrName)) element[attrName] = parseBoolean(attrValue);
else if (shouldRemove)                 element.removeAttribute(attrName);
else                                   directSetAttribute(element, attrName, attrValue, ...);

const isBooleanAttr = (element, key) => { const isBoolean = key == 'allowfullscreen' || ... ;
                                          return isBoolean && key in element; };
```

`serializeAttribute(key, true)` returns `true` unchanged for a plain boolean, so
`directSetAttribute` calls `setAttribute(key, true)` and the DOM coerces it to the
string `"true"`. Replayed against domino, that reproduces T050's measurement
exactly.

### 1.3 CORRECTION — T050's count, and a SECOND lane for `readonly`

T050's note says qwik's `isBooleanAttr` "lists 21 names" and then quotes them.
**The quoted list is right and the count is wrong: it is 24.** Counted from the
extracted body.

More importantly, T050 read only the first conjunct. **The list is ANDed with
`key in element`,** and that changes the answer:

| name | on qwik's list? | `key in element`? | qwik's reading |
| --- | --- | --- | --- |
| `hidden` | **no** | yes | `"true"` |
| `readonly` | **yes** | **no** | `"true"` |

`readonly` is on qwik's list and still fails, because the DOM property is
`readOnly`. So **`readonly` is non-portable through TWO lanes**, react and qwik,
by two unrelated mechanisms. Four names, **five cells**.

`'readonly' in element` being false is confirmed four independent ways —
`lib.dom.d.ts` at typescript 5.9.3, jsdom 28.1.0, the domino bundled in
`@angular/platform-server` 22.0.8, and Angular's own `DomElementSchemaRegistry`.
It is the **only** one of the fourteen whose lowercase spelling is not itself a
DOM property.

### 1.4 A cell that looked like a fifth name and was NOT

`'async' in document.createElement('script')` is **false in jsdom 28.1.0**, which
made `async` look non-portable through qwik. It is a **jsdom gap**: `lib.dom.d.ts`
declares `HTMLScriptElement.async` and domino implements it. The qwik gate was
re-run against domino and `async` is portable. Reported because a matrix taken
only against jsdom would have shipped a fifth name that does not exist.

**No fifth non-portable name was found.** The stop_if did not fire.

---

## 2. The full 14 × 6 matrix

Every cell is `getAttribute(name)` in the **true** state / the **false** state.
react/solid/vue/svelte were **executed**; qwik is its own decider replayed against
domino; angular is domino plus `DomElementSchemaRegistry`, and is additionally
covered behaviourally by S9 in `pnpm e2e`.

| name | react | solid | vue | svelte | qwik | angular |
| --- | --- | --- | --- | --- | --- | --- |
| `async` | `""` / `null` | `""` / `null` | `""` / `null` | `""` / `null` | `""` / `null` | `""` / `null` |
| `autofocus` | **`null` / `null`** | `""` / `null` | `""` / `null` | `""` / `null` | `""` / `null` | `""` / `null` |
| `autoplay` | **`null` / `null`** | `""` / `null` | `""` / `null` | `""` / `null` | `""` / `null` | `""` / `null` |
| `controls` | `""` / `null` | `""` / `null` | `""` / `null` | `""` / `null` | `""` / `null` | `""` / `null` |
| `default` | `""` / `null` | `""` / `null` | `""` / `null` | `""` / `null` | `""` / `null` | `""` / `null` |
| `defer` | `""` / `null` | `""` / `null` | `""` / `null` | `""` / `null` | `""` / `null` | `""` / `null` |
| `disabled` | `""` / `null` | `""` / `null` | `""` / `null` | `""` / `null` | `""` / `null` | `""` / `null` |
| `hidden` | `""` / `null` | `""` / `null` | `""` / `null` | `""` / `null` | **`"true"` / `null`** | `""` / `null` |
| `loop` | `""` / `null` | `""` / `null` | `""` / `null` | `""` / `null` | `""` / `null` | `""` / `null` |
| `multiple` | `""` / `null` | `""` / `null` | `""` / `null` | `""` / `null` | `""` / `null` | `""` / `null` |
| `open` | `""` / `null` | `""` / `null` | `""` / `null` | `""` / `null` | `""` / `null` | `""` / `null` |
| `readonly` | **`null` / `null`** | `""` / `null` | `""` / `null` | `""` / `null` | **`"true"` / `null`** | `""` / `null` |
| `required` | `""` / `null` | `""` / `null` | `""` / `null` | `""` / `null` | `""` / `null` | `""` / `null` |
| `reversed` | `""` / `null` | `""` / `null` | `""` / `null` | `""` / `null` | `""` / `null` | `""` / `null` |

### 2.1 The reading compared is the ORACLE's reading, and that choice is load-bearing

The raw bytes split 2-2 on **ten** of the fourteen: react and svelte serve
`disabled=""`, solid and vue serve a **bare** `disabled`. That is **not** a
divergence. `measureBooleans` in the three-way contract states the standard in as
many words — the claim is *"about the state the six lanes end up in, not about
which API each one used to get there"*. A byte-level matrix would have reported
**ten false divergences and buried the four real ones**.

### 2.2 CORRECTION — the host is load-bearing, and a uniform `<span>` measures the wrong thing

The lowering matrix in `enriched-ir.test.ts` puts every row on a `<span>`, on the
correct grounds that the *lowering rule* is keyed on the name. **Two lanes'
SERIALIZERS are element-sensitive**, so that host is wrong for this question:
qwik gates on `key in element`, and Angular's schema rejects `[disabled]` on a
`<span>` outright. Measured on `<span>`, angular reports `(absent)` for thirteen
of fourteen. This matrix uses the element that defines each property, and says why.

---

## 3. The decision, and the two options refused on measurement

### 3.1 REFUSED — removal from the admitted set

Only the **Angular** emitter branches on `kind` (`angular/src/emitter/index.ts:900`);
solid's branch at `2175` is guarded by `name === 'value'`. Re-grepped at this tree.
So removal **cannot alter what react or qwik serve** and repairs nothing. What it
would do, measured in domino:

```
[attr.hidden]="true"   -> <div hidden="true">   (.hidden === true)
[attr.hidden]="false"  -> <div hidden="false">  (.hidden === true)   <- entry 10's inversion
```

Removal reintroduces entry 10's own defect into the one lane that is currently
correct. **Strictly worse.**

### 3.2 REFUSED — a casing map as the whole answer

It repairs react and **cannot touch qwik**, which has no alternative spelling to
map. The qwik rows are the proof this was never a React special case — exactly as
the card said to weigh.

### 3.3 SHIPPED

The casing map **plus** the rule amendment, because they answer different halves.
Clause 3's old wording admitted a name on an **Angular runtime** fact
(`mapPropName`) and the set was then read as lane-neutral; `readonly` is the only
name that clause ever admitted, and `readonly` is the name that fails twice. The
escape hatch is gone as a portability argument, clause 5 asks each lane's
serializer, and `LANE_PORTABLE_BOOLEAN_ATTRIBUTES` records the answer.

### 3.4 CORRECTION — "no emitter in this repo carries a casing map" is FALSE at HEAD

`packages/frameworks/react/src/emitter/index.ts` already had one: `jsxName`,
mapping `class` → `className` and `for` → `htmlFor`, applied to **both** static
attributes and dynamic bindings at a single site. The three names went there.

---

## 4. Instruments, and their calibration

**An instrument that cannot fail is not an instrument**, so each was watched red
before being reported green.

**react's map is not a hand list.** The test executes react-dom over all fourteen
admitted names and asserts the map is **equal** to the set react-dom actually
rejects — where "rejects" means *both* arms, warned **and** served nothing in
either state.

- narrowing (drop `readonly`) → **3 red**, including `expected [autofocus, autoplay] to deeply equal [autofocus, autoplay, readonly]`
- widening (add `disabled`) → **3 red**, including `disabled warned: expected true to be false`

**the portable set**, asserted equal to what the six measurements leave standing:

- widening (admit `hidden`) → red, `- "hidden"`
- narrowing (drop `disabled`) → red, `+ "disabled"`

**the qwik extraction cannot rot silently.** Renaming the anchor produced the
named diagnostic — *"`isBooleanAttr` is no longer at this shape in
@qwik.dev/core"* — rather than an empty list quietly passing.

### 4.1 The measurement that was WRONG the first time, and how

I first reported that react's `console.error` fires **on the true state only**,
which would have meant `consoleErrors: 0` catches this only in a scenario that
sets the boolean. **That was an artifact of react's own dedup.** react-dom warns
**once per prop name per process**; my probe rendered `true` first, so the `false`
render was silently suppressed. Re-measured in **fresh processes** rendering each
state first:

```
first render state=false -> warnings=1 ; then state=true -> warnings=0
first render state=true  -> warnings=1 ; then state=false -> warnings=0
```

React warns on whichever render comes first, in **either** state. The suite is
memoised into a single pass with the **false** state rendered first, precisely so
this cannot be re-measured wrongly, and the comment says why.

**`consoleErrors: 0` was not weakened.** The console error is the instrument
working, and it is now what the react map is calibrated against.

---

## 5. What is NOT proven, stated plainly

**No served payload observes any of this.** S9 binds `disabled` and `required`,
both portable; registering a fixture for a non-portable name is exactly what the
portable set forbids. Entry 13 is filed **OPEN** for that reason and because
containment is not removal.

**The react repair is not clean in bytes.** React lowercases `autoFocus` on the
way out but writes `autoPlay` and `readOnly` to the payload **camelCase**:

```
autoFocus={true} -> <input autofocus=""/>       readOnly={true} -> <input readOnly=""/>
```

The live-DOM oracle cannot see this — HTML attribute names are case-insensitive to
a parser — but `startTagCarriesAttribute` reads served bytes with a
**case-sensitive** regex. Today S9 reads served bytes only in the FALSE state,
where every lane is absent, so nothing observes it. Registered as a test named
`COST:`, not as a promise.

**Two of six lanes are not executed.** Qwik's SSR renderer needs a real client
manifest; angular's domino lives in `@angular/platform-server`, a **demo**
dependency not resolvable from `packages/compiler`. Both are measured at their own
deciding tables instead, and angular is covered behaviourally by S9.

### 5.2 CORRECTION — "react-dom is the one lane callable from this package"

T049's note records that. **It was inherited rather than measured, and it is
false.** solid's `ssrAttribute`, vue's `@vue/server-renderer` and svelte's `attr()`
are all reachable through the lane packages by the same `laneRequire` route the
whitespace matrix already uses. Four lanes are executed here, not one — total cost
**~264 ms**.

**Nothing was filed upstream.** React supports all three under different prop
names, so the react half is ours. Qwik's attribute table is Qwik's own and is
internally consistent, and per the standing rule a framework is not read as
defective for behaviour inside its own design envelope.

---

## 6. Verification, as run

```sh
pnpm test    # 51 files, 1024 tests (1015 + 9), all pass
pnpm check   # tsc --noEmit, root + five per-package configs
pnpm lint    # 0 warnings, 0 errors, 394 files

# all six lanes regenerated, then the zero-movement claim run as a GATE
git diff --exit-code -- packages/compiler/test/goldens \
  packages/frameworks/{react,solid,qwik,svelte,vue,angular}/generated
# exit 0 - no golden and no generated byte moved

pnpm e2e     # 6 demos x 8 scenarios, all observations equal
```

`pnpm mutate:corpus` was **not** run; the card forbids it. Nothing was committed.

**One thing in the tree is not mine.** `docs/goals/frameless-vue-v1/state.yaml` is
modified and `notes/T999-vue-final-audit.md` is new — the concurrent Judge closing
the Vue board (`status: active` → `done`, `active_task: T999` → `null`). Outside
`allowed_files`; not touched, and reported rather than absorbed.
