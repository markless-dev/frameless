# T049 — Landing the boolean-attribute lowering

Worker, 2026-07-27. Board: `docs/goals/frameless-defects-and-targets-v1/state.yaml`.
Tree read and edited at `70650c7`, which **is** `origin/main` (checked, not accepted —
the T041 note records the previous dispatch asserting a "pushed" that was one commit
stale, so this one was re-verified: `git rev-parse HEAD origin/main` returns the same
sha twice, `git status --porcelain` was empty, and nothing else was running).

Spec: `notes/T041-boolean-attribute.md`, the Judge's ruling. **Everything below was
re-derived at this tree.** Where re-derivation agreed with the ruling it says so;
where it went further than the ruling, §2 says exactly where and why.

---

## 0. What shipped

The lowering, as specified: a dynamic binding whose name is an HTML boolean content
attribute reaches the IR as `kind: 'property'` instead of `kind: 'attribute'`, at
`packages/compiler/src/build.ts` — the site that already post-processes the vendored
classifier's answer — and **not** in the Angular emitter.

Measured consequence, from the emitter running on a probe source:

```
before:  <span [attr.disabled]="a"></span>
after:   <span [disabled]="a"></span>
         <span [attr.inert]="a"></span>     <- a refused name, unmoved
```

`docs/DEFECTS.md` entry **10**, filed **OPEN**.

---

## 1. The four inherited claims, re-measured

Every one of these was checked from the tree rather than read from the ruling.

**1.1 The three-name allowlist — CONFIRMED, verbatim.**
`@markless/compiler` 0.1.1, `dist/index.js:8570`:

```js
function isDomPropertyBindingName(attributeName) {
	return attributeName === "value" || attributeName === "checked" || attributeName === "selected";
}
```

**1.2 The 29-name sibling list — CONFIRMED, and counted.** `@tsrx/core` 0.1.32,
`src/utils/dom.js:92`, `DOM_BOOLEAN_ATTRIBUTES`, 29 entries, including `disabled`,
`hidden`, `readonly`, `required`. An internal path; not imported.

**1.3 Only Angular's emitted form moves — CONFIRMED.** Grepping `'property'` across
all six emitters returns four sites: `angular/src/emitter/index.ts:900`
(`property` → `[name]`, else `[attr.name]`), `solid/.../index.ts:2158` (guarded by
`name === 'value'`), and kind *validators* in react and solid that accept both. Qwik,
svelte and vue never read the field.

**1.4 Blast radius zero — CONFIRMED by independent scan.** Every `dynamicBindings`
entry across all seven goldens, by `name:kind`: `checked:property` ×5,
`value:property` ×3, and 21 `data-*`/`aria-*` attributes. The only boolean content
attribute bound in the corpus is `checked`, already `property`.

And then **run as a gate rather than trusted**: all six lanes regenerated, then
`git diff --exit-code` over the seven goldens and all six `generated/` directories.
**Exit 0.** The zero-blast-radius measurement the ruling rests on held; had it not,
the instruction was to stop and re-open, not to adjust.

---

## 2. Where re-derivation went past the ruling

The ruling said to write the set explicitly and cross-check it against `@tsrx/core`'s
29 names. Doing that literally would have shipped **wrong names**, so the set is
defined by a four-clause admission rule and is 14 names, not 29.

### 2.1 The admission rule

A name ships only if all four hold:

1. It is an HTML boolean **content** attribute — so it has a serialized form for the
   lowering to get right.
2. It appears in `@tsrx/core`'s `DOM_BOOLEAN_ATTRIBUTES` (the ruling's cross-check).
3. Its **lowercase attribute spelling reaches the browser DOM property**, either
   because they are identical or because Angular's `mapPropName` maps it. Verified
   against `lib.dom.d.ts` at this repo's `typescript@5.9.3`.
4. Angular's **own server DOM** — the domino bundled in `@angular/platform-server`
   22.0.8 — reflects the property back to the content attribute, so SSR and the
   browser agree.

### 2.2 The pair that proves clauses 3 and 4 are both needed

Measured in domino across nine values per name, and cross-read against `lib.dom.d.ts`:

| name | domino reflects? | browser property? | verdict |
| --- | --- | --- | --- |
| `nomodule` | **yes** | **no** — it is `noModule` | REFUSED |
| `seamless` | **yes** | **no** — removed from HTML | REFUSED |
| `inert` | **no** | yes — `HTMLElement.inert` | REFUSED |
| `webkitdirectory` | **no** | yes — `HTMLInputElement.webkitdirectory` | REFUSED |
| `muted` | **no** | yes, but the attribute reflects `defaultMuted` | REFUSED |

**`nomodule` and `seamless` are the sharp ones.** Angular's server DOM accepts both.
A measurement taken only against domino — which is the DOM the ruling's own §2.5 table
was read from — would have **admitted** them. Neither is a browser property, and
`isPropertyValid` returns `true` when `Node` is undefined, so both would have passed
SSR and thrown in the browser. That is not a hypothetical restatement of the ruling's
cost (1); it is that cost with two names attached, caught before shipping.

`inert`, `webkitdirectory` and `muted` fail the other way: real browser properties
domino does not implement, so SSR would omit an attribute the client then sets.

### 2.3 Refused for spelling, and for having no attribute at all

`allowfullscreen`, `formnovalidate`, `ismap`, `novalidate`, `playsinline`,
`disablepictureinpicture`, `disableremoteplayback` — the property is camelCase and
`mapPropName` maps exactly six names (`class`, `for`, `formaction`, `innerHtml`,
`readonly`, `tabindex`), of which `readonly` is the only member of this set.
`indeterminate` is a property with **no content attribute** (clause 1). `itemscope`'s
property is `itemScope`.

### 2.4 The set that shipped

```
async  autofocus  autoplay  controls  default  defer  disabled
hidden  loop  multiple  open  readonly  required  reversed
```

Fourteen names. `value`, `checked` and `selected` are **absent by instruction and by
design** — they already arrive as `property` from the vendored classifier, and
listing them here would fork one fact across two owners.

### 2.5 The value axis, re-measured on both DOMs

Domino 22.0.8, property path, and react-dom 19.2.3, boolean prop — **identical on
every value**, including the four the corpus never reaches:

```
true 'false' 'x' 1     -> disabled=""
false null undefined '' 0 -> attribute absent
```

versus the path this replaces: `setAttribute('disabled','false')` serializes
`disabled="false"` **and `.disabled === true`** — the inversion, read off the object
Angular hands its serializer.

---

## 3. The instruments, and their calibration

No fixture, golden, demo route or observation string was registered. The inventories
are derived, so one fixture enlists every lane's gates at once; the T039 precedent is
a probe source, and that is what this uses.

**`packages/compiler/test/enriched-ir.test.ts` — the registered matrix.** 33 names,
each with its expected kind and the admission clause it passed or failed. It is
two-sided **as a design property**: admitted names must lower to `property`, refused
names must lower to `attribute`, and a second test asserts the property rows are
exactly what `build.ts` admits. So narrowing the set and widening it both go red.
It also executes react-dom's boolean-prop serialization, which is the one lane's
serializer callable from this package without a browser.

**`packages/frameworks/angular/test/emitter.test.ts` — the emitted form, and an
arbiter.** The first test asserts `[disabled]="a"` present and `[attr.disabled]`
**absent** (the defect's own byte sequence, named rather than merely unmentioned),
with `[attr.inert]` as the refused control. The second does not read our own bytes:
it hands the emitted template to `@angular/compiler`'s `parseTemplate` and reads the
`BindingType` **Angular** assigns — `Property` for `disabled`, `Attribute` for
`inert`. That is the version-bump tripwire the ruling asked for.

### 3.1 Watched red, both directions, both files

Removing `disabled` from the set in `build.ts`:

```
- "disabled": "property",
+ "disabled": "attribute",

AssertionError: expected '\t\t<div data-probe>\n\t\t\t<span [at…' to contain '[disabled]="a"'
+ 			<span [attr.disabled]="a"></span>

AssertionError: expected { disabled: 'Attribute', …(1) } to deeply equal { disabled: 'Property', …(1) }
```

Adding `inert` to it:

```
- "inert": "attribute",
+ "inert": "property",
```

Four tests, red for the right reason in both directions, then restored and green.
An instrument that cannot fail is not an instrument, so this is reported as the
evidence rather than as a footnote.

---

## 4. What is NOT proven, stated plainly

**No served payload observes this.** The repair is proven at the compiler (kind) and
at the emitter (emitted form, arbitrated by Angular's own parser). It is proven in
**zero** e2e observations, because no scenario binds a boolean content attribute and
registering one was out of scope by instruction. That is exactly why entry 10 is
filed **OPEN** and not CLOSED: entry 9 earned CLOSED on a runtime oracle over emitted
Angular, and this has no equivalent yet.

**The six-lane serialization table is measured, not executed.** Two of the six —
Angular's domino and react-dom — were run. The other four are recorded from the
ruling's measurements and from each framework's documented boolean handling. The
existing six-lane whitespace matrix in `enriched-ir.test.ts` runs each lane's own
*template compiler*, which answers a text question; it cannot answer a serialization
question without running each lane's runtime, which is the e2e half. `platform-server`
is a demo dependency and is not resolvable from `packages/compiler`, so the domino
table is registered as data in the `build.ts` comment rather than asserted in a test.

**`hidden="until-found"` is now inexpressible** through this path in all six lanes.
Named as a cost, not repaired.

**S7's `aria-disabled` was not touched.** Ratified correct for S7; moving it would
change six demos, the observation string and the mutation budget. The ledger entry
says in one sentence why it is right there and wrong as advice.

**Nothing was filed upstream** against Angular, `@markless/compiler` or `@tsrx/core`.
The allowlist observation is a note for `frameless-emitter-capability-v1`; the package
is the owner's own, and the autonomy grant excludes outward-facing filings.

---

## 5. Verification, as run

```sh
pnpm test    # 51 files, 994 tests, all pass
pnpm check   # tsc --noEmit across root + five per-package configs
pnpm lint    # 0 warnings, 0 errors, 381 files

# all six lanes regenerated
pnpm --filter ./packages/frameworks/{react,solid,qwik,svelte,vue,angular} regenerate

# THE ZERO-BLAST-RADIUS CLAIM, falsifiable in one command
git diff --exit-code -- packages/compiler/test/goldens \
  packages/frameworks/{react,solid,qwik,svelte,vue,angular}/generated
# exit 0
```

`pnpm e2e`, `pnpm test:browser` and `pnpm mutate:corpus` were **not** run; the card
forbids all three. The working tree after this task contains exactly five modified
files: `build.ts`, the two test files, `docs/DEFECTS.md`, and this note.
