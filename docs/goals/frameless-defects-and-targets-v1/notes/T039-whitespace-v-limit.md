# T039 — The interior-whitespace v-limit, as landed

Worker, 2026-07-27. Board: `docs/goals/frameless-defects-and-targets-v1/state.yaml`.
Tree read and edited at `6190058`, clean at dispatch and verified clean before any edit.
Spec: `notes/T038-whitespace-ruling.md` — authoritative. Ledger: `docs/DEFECTS.md` entry 7.

Everything numeric below was **re-derived at this tree**. Nothing is carried from the
T038 note or the T039 card. Where a re-derivation disagreed with an inherited claim,
§5 says so.

---

## 1. What shipped

Four things, one rule.

1. **The refusal.** `assertPortableInteriorWhitespace` in
   `packages/compiler/src/build.ts`, called from the `JSXText` branch of
   `buildTemplateNode` immediately after `normalizeJsxText`, so the throw carries
   `environment.filename` and the value the compiler actually produced. It rejects
   `/\s\s/` or `/[^\S ]/`. Fail-closed. Edges untouched.
2. **The calibration**, `describe('the interior-whitespace v-limit')` in
   `packages/compiler/test/enriched-ir.test.ts` — planted violations shown RED, their
   legal neighbours shown GREEN.
3. **The lift trigger**, `describe('the six-lane whitespace matrix')` in the same file
   — all six lanes' own compilers, both rows, asserted.
4. **The recorded reason** in `packages/frameworks/solid/src/gate/index.ts`, above
   `SOLID_GATE_POLICIES`. **No predicate**, per the ruling.

---

## 2. The measurements, re-derived

### 2.1 The corpus scan: 0 of 108, confirmed exactly

Every live `.tsrx` under `demos/`, `packages/` and `poc/` compiled through
`buildEnrichedIr`, every `{ kind: 'text' }` value collected, both predicates applied
separately:

```
files = 60      compile-errors = 3 (pre-existing, unrelated)
static text nodes   = 108
interior violations =   0
edge violations     =   4
```

The three compile errors are `composition-attach-input-ambiguous.tsrx` (a deliberate
ambiguity fixture), `poc/03-markless-graph/fixtures/c6d-mutation.tsrx` and
`poc/03-markless-graph/fixtures/todo-list.tsrx`. All three fail before reaching any
text node and all three failed identically before this change.

The four edge violations are the ones the ruling names: `" open"` in
`demos/ssr/src/TaskList.tsrx` and `demos/ui-kit/src/TaskList.tsrx`, `" seats"` in the
two `PricingCard.tsrx`. **This is why edges are out of scope**, and there is now a
test asserting they are not refused, so the tempting widening fails loudly rather than
breaking four demos.

T038's figures reproduce to the digit.

### 2.2 The six-lane matrix, re-derived per lane

Each lane probed through **its own** pinned compiler, resolved with `createRequire`
against that lane's `package.json`. Every input built with `String.fromCharCode`;
every output compared as code points, never as a rendered string.

| construct                 | react | qwik | svelte | solid    | vue      | angular  |
| ------------------------- | ----- | ---- | ------ | -------- | -------- | -------- |
| `one` U+0020 U+0020 `two` | keep  | keep | keep   | CONDENSE | CONDENSE | CONDENSE |
| `one` U+00A0 `two`        | keep  | keep | keep   | →U+0020  | keep     | keep     |

Versions measured: react-dom 19.2.3 · `@qwik.dev/optimizer` 2.1.0-beta.5 (loaded by
`@qwik.dev/core` 2.0.0-beta.38) · svelte 5.56.8 · `babel-preset-solid` 1.9.12 ·
`@vue/compiler-sfc` 3.5.40 · `@angular/compiler` 22.0.8.

Instruments: react `renderToStaticMarkup`; svelte `compile(generate:'server')`; solid
`@babel/core` + `babel-preset-solid` at `generate:'ssr'`; vue `parse` →
`descriptor.template.ast`; angular `parseTemplate`; qwik
`createOptimizer().transformModules`.

**3–3 on a space run, 5–1 on U+00A0 with Solid alone.** Confirmed.

### 2.3 THE FILLED CELL: Qwik on non-ASCII whitespace is PRESERVE

T038 §7.1 recorded this as unmeasured and required the Worker to fill it. It is filled.

The obstacle was real and T038 described it correctly: `@qwik.dev/core`
2.0.0-beta.38's `./optimizer` subpath exports exactly two names, `qwikVite` and
`qwikRollup` — no callable transform. **The route around it** is that
`dist/optimizer.mjs:1354` loads its own binding with
`await import('@qwik.dev/optimizer')`, and that package is linked into
`@qwik.dev/core`'s own `node_modules`. Resolving *through core* reaches
`createOptimizer()`, whose `transformModules` is callable and is the transform the
Qwik lane's build actually runs. No store path is hard-coded and no dependency was
added.

Measured, all seven inputs, mode `lib`, `transpileJsx: true`:

```
space run x2   one U+0020 U+0020 two   ->  unchanged   PRESERVE
nbsp   x1      one U+00A0 two          ->  unchanged   PRESERVE   <- THE FILLED CELL
nbsp   x2      one U+00A0 U+00A0 two   ->  unchanged   PRESERVE
thin   x1      one U+2009 two          ->  unchanged   PRESERVE
ideo   x1      one U+3000 two          ->  unchanged   PRESERVE
figure x1      one U+2007 two          ->  unchanged   PRESERVE
zwsp   x1      one U+200B two          ->  unchanged   PRESERVE
```

**Qwik is on the preserving side of the 5–1 split.** This is the direction that
*strengthens* the ruling: it does not merely fill a hole, it removes the one cell
that could have made the split 4–2 and weakened the case that Solid is alone. Had it
come back CONDENSE the ruling's §1.1 argument would have needed re-examination. It did
not.

### 2.4 Solid's rewrite, re-derived — with one correction to how it is reported

`babel-preset-solid` 1.9.12 at `generate:'ssr'`:

```
one U+0020 U+0020 two  ->  one U+0020 two    condensed
one U+00A0 two         ->  one U+0020 two    CHARACTER REWRITTEN
one U+2009 two         ->  one U+0020 two    thin space, same
one U+3000 two         ->  one U+0020 two    ideographic space, same
one U+2007 two         ->  one U+0020 two    figure space, same
one U+200B two         ->  emitted as a backslash-u escape; DECODES BACK to U+200B
```

The first five rows reproduce T038 §1.1 exactly. **The sixth needs care and T038's
one-word summary of it would mislead a re-runner.** T038 records ZWSP as "survives",
which is true of the *character*; but Solid emits it into the generated template
literal as a six-character backslash-u escape rather than as a raw character, so
a byte comparison of the generated **source** reports a difference. It is a spelling
of the same character, not a substitution. The Solid gate comment states this
explicitly so the next person to run the probe does not read the escape as a rewrite,
or "fix" the comment to match a misreading.

### 2.5 The compiler manufactures the construct — confirmed at the stated line

`packages/compiler/src/build.ts:2894` (pre-edit numbering) is
`line.replace(/\t/g, ' ')` — one space **per tab**, a 1:1 character map. Confirmed by
reading, and confirmed behaviourally through the refusal's own message: `tab\t\there`
now throws naming the value `"tab  here"`, and `one\t\t\ttwo` throws naming
`"one   two"`. The compiler produces a space run the author never typed. That is the
second authoring path, and the reason the rule belongs at this layer.

---

## 3. Calibration: the guard shown RED, four mutants killed

The rule fires on nothing that exists. Green is therefore worth nothing on its own, so
each of these was **run**, not reasoned about.

| mutant                                                          | result                                        |
| --------------------------------------------------------------- | --------------------------------------------- |
| guard body replaced with an unconditional `return`               | **4 failed** / 44 passed                      |
| predicate reduced to `/\s\s/` only (drop the non-ASCII half)     | **1 failed** — the single-U+00A0 test          |
| predicate reduced to `/[^\S ]/` only (drop the run half)         | **3 failed** — run, tab run, message          |
| **the forbidden `\s+ → ' '` condense added to `normalizeJsxText`** | **4 failed**                                  |
| one matrix cell moved (pretend solid preserves the run)          | **1 failed**, printing the six pinned versions |

Two things worth stating about that table.

**The two halves of the predicate are independently load-bearing.** Neither is
redundant, and neither can be dropped without a test noticing. That matters because
the `[^\S ]` half is the one whose necessity is non-obvious — it refuses a *single*
character with no run at all, which looks like over-reach until the 5–1 row explains it.

**The forbidden move is caught at its most destructive site.** T038 rejects
`\s+ → ' '` in `normalizeJsxText` by name as the version a reader will reach for.
Adding it makes the guard silently unreachable — the construct is erased before the
predicate sees it, and everything looks fine. Four tests go red instead. The one
mutation the ruling most feared is the one the suite catches loudest.

The GREEN-side tests — the interpolated spelling, the untouched edges, ZWSP — stayed
green under every mutant of the guard, which is what makes this two-sided rather than
merely red-capable.

---

## 4. What is deliberately NOT here

Recorded so a later Worker does not churn, per the ruling's §6:

- **No gate predicate**, in any of the six. The Solid gate change is a comment.
- **No change to edge handling**, at the compiler or in the two existing gate policies.
- **No change to `normalizeJsxText`'s tab/newline mapping.** It is now *covered* — a
  tab run produces a space run, which the new rule rejects — rather than special-cased.
- **No change to emitted output.** Verified: `git diff --exit-code` clean over all six
  `generated/` directories and over `packages/compiler/test/goldens`.
- **No new dependency.** The Qwik optimizer was reached through resolution, not
  installation.

---

## 5. Where a re-derivation changed how something is stated

Two, both small, both recorded rather than smoothed over.

1. **Solid and ZWSP** (§2.4). T038's "survives" is right about the character and
   misleading about the generated source. Stated precisely in the gate comment.
2. **The matrix asserts behaviour and records versions, rather than asserting
   versions.** The card asks for a matrix "per lane and pinned version" that goes red
   when "a version bump moves any lane". Asserting exact versions would have gone red
   on every unrelated patch bump, and three of the six lanes are pinned with a caret
   (`svelte ^5.56.1`, `@vue/compiler-sfc ^3.5.40`, `@angular/compiler ^22.0.8`) — an
   expected red is a red nobody reads, which is this ledger's own standing complaint
   about `continue-on-error`. The behaviour is asserted strictly; the versions are
   captured and printed in the failure message, so any red names the exact versions
   that produced it. That is what the trigger asks for — *a bump that moves a lane* —
   without manufacturing reds that do not.

---

## 6. Reproducing this document

```sh
# the guard, and both halves of it
sed -n '/INTERIOR WHITESPACE IN STATIC TEMPLATE TEXT IS REFUSED/,/^}/p' packages/compiler/src/build.ts

# the calibration and the matrix
npx vitest run --project node packages/compiler/test/enriched-ir.test.ts --reporter=verbose

# the guard-only claim
git diff --exit-code -- packages/frameworks/*/generated packages/compiler/test/goldens
```

Per-lane probes: resolve each lane's compiler with `createRequire` against
`packages/frameworks/<lane>/package.json`, build every input with
`String.fromCharCode`, and print code points rather than strings — a heredoc will
silently normalise U+00A0, and that alone would invert the finding.

For Qwik specifically, do **not** reach for `@qwik.dev/core/optimizer`; it exports
only bundler plugins. Resolve `@qwik.dev/optimizer` *through* `@qwik.dev/core`'s
`package.json` and call `createOptimizer()`.
