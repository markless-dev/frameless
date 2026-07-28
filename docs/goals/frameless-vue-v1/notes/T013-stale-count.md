# T013 — the last stale corpus literal, replaced by a pointer rather than a newer number

`packages/frameworks/vue/src/emitter/index.ts` `propsDeclaration`'s doc comment stated *"fifteen
printed `PropDestructuringEntry` values across the six goldens, six distinct names"*. **Both figures
were false at HEAD** and the suite was green — the same defect class T012 removed from
`gate.test.ts`, one file outside its `allowed_files`, in the very comment block whose insertion
caused the `+13` citation drift.

---

## 1. The count, re-derived rather than inherited

**Measured independently before reading T012's table**, straight off
`packages/compiler/test/goldens/s<n>-*.json`, summing `components[].props.entries` — which is
exactly what `propsDeclaration()` prints, one string literal per entry from `entry.path[0]`:

| golden | entries |
|---|---|
| `s1-render-once` | 4 |
| `s2-keyed-todo` | 2 |
| `s3-event-form` | 2 |
| `s4-nested-list` | 2 |
| `s5-branch-teardown` | 2 |
| `s6-whitespace-text` | 3 |
| `s7-form-controls` | 2 |
| **7 goldens** | **17** |

Distinct printed names: **6** — `initial`, `label`, `multiplier`, `onTrace`, `seed`, `visible`.

**My derivation agrees with T012 and with the dispatch on all three figures** (17 / 7 / 6), so there
is no disagreement to report. The independent pass was still worth taking: the whole point of this
card is that a number nobody re-measures is a number that quietly goes false, and "T012 said so" is
inheritance, not measurement.

---

## 2. The fix is a POINTER, not a fresher literal

Restating "seventeen across seven" on its own would have rebuilt the exact defect being removed — a
literal that the eighth scenario falsifies while every test stays green. What landed instead:

- the comment now says **the size of this domain is not a literal this comment owns**, and names
  `derivePrintedPropEntries()` in `test/gate.test.ts` as the thing that counts it off the goldens
  and **THROWS on empty**;
- the number is still stated, because a claim a reader can audit is worth more than a vague one —
  but it is stated as **"corpus-derived and CHECKED THERE, not restated here"**, so the next
  scenario moves the derivation and the reader already knows this sentence is downstream of it;
- the `ZERO` is explicitly marked **BY CONSTRUCTION**, keeping T012 §6's distinction intact: 12b's
  zero cannot be derived from a corpus (per-prop write-back has no IR channel at all, so a walk
  could only ever return zero and never fail), whereas 12a's "applies to ONE" genuinely is derived.
- provenance kept as `(T009/T010, re-derived T012)`.

---

## 3. LINE-NEUTRALITY WAS A HARD CONSTRAINT, and it shaped the prose

This is the finding worth carrying forward. T012 §4 had just repaired six citations that drifted by
`+13` **because a comment grew in this exact block**. Those citations are not all in this file:

| citer | cites |
|---|---|
| `docs/emitter-idiom-policy.md:478` | `packages/frameworks/vue/src/emitter/index.ts:413` (worked ex. 3) |
| `docs/emitter-idiom-policy.md:1317` | `packages/frameworks/vue/src/emitter/index.ts:413` (12b) |
| `docs/emitter-idiom-policy.md:1230` | `:828` (`renderHost`) |
| `docs/emitter-idiom-policy.md:1303` | `:934` / `:947` (`renderNode` and its throw) |

**`docs/emitter-idiom-policy.md` is outside this card's `allowed_files`.** A comment that grew by
even one line would have falsified four citations in a file this task cannot touch — committing the
same defect class the task exists to remove, one level up, with no way to repair it in scope.

So the replacement was written to **exactly ten lines for ten**, wrapped at the file's house width
(≤84 columns, matching the existing block). Verified mechanically rather than asserted:

- `git diff --stat` → `10 insertions(+), 10 deletions(-)`
- `propsDeclaration` still at **413**; `eventAttribute` **743**, `attributesOf` **766**,
  `renderHost` **828**, `renderNode` **934** — all unmoved.

The cost is real and is recorded as a deviation: fitting the pointer, the derived figures, the
by-construction zero and the IR-1/IR-8 distinction into the same ten lines meant dropping the
clause *"rather than an inherited sentence"* and compressing the T009/T010/T012 provenance. **This
is the second consecutive task to pay a prose tax to a bare line ordinal**, which strengthens T012's
standing recommendation: these citations already name their symbol, so the ordinal buys nothing and
costs an edit-time constraint every time the comment is touched.

---

## 4. Verification

All four gates passed on the **first** attempt, no fix attempts used:

- `pnpm test` — **989 passed**, 51 files (exactly the dispatch figure; no test moved).
- `pnpm lint` — 0 warnings, 0 errors.
- `node packages/frameworks/vue/scripts/regenerate.ts && git diff --exit-code -- packages/frameworks/vue/generated` — **clean; no emitted byte moves**.
- the mechanical comment-only filter (`git diff | grep '^+' | ...`) — **empty output**, so every
  added line is a comment line. Asserting "documentation only" was not accepted as evidence for it.

---

## 5. TWO MORE CORPUS COUNTS IN THIS FILE — reported, deliberately NOT fixed

Found while scanning the file for the same defect class. The card says report rather than widen, so
neither was touched. Both are in the same doc comment above the event/attribute rules.

### 5.1 `index.ts:686-687` — "all twelve existing goldens"

> *"`stopPropagation` FAILS CLOSED. The corpus contains zero instances across all **twelve existing
> goldens**…"*

**The substantive claim HOLDS — I re-measured it.** `stopPropagation` occurs in **0 of 7** compiler
goldens; the only IR action present anywhere is `preventDefault` (8 occurrences, all in
`s3-event-form.json`). The fail-closed throw and its `no-stop-propagation` gate row are correct.

**The number is the problem, and it never matched this corpus.** The line was written at `5ca20c7`,
when `packages/compiler/test/goldens/` held **three** files (S4 landed at `a2abfea`, S5 `abb5e44`,
S6 `8af8ed1`, S7 `5c79782` — all later that day). So "twelve" was never a count of the scenario
corpus; it most plausibly counted emitted goldens across the then-existing framework lanes. Today it
reads, to anyone who checks, as a false claim about a seven-file corpus attached to a true finding —
the most corrosive shape, because the true finding is what lends it credibility.

### 5.2 `index.ts:658` — "all three scenario components"

> *"…and byte-identical SSR HTML for all **three scenario components**."*

Lower confidence and arguably not a defect: this is a record of what T005 **measured**, and at
`5ca20c7` three was the whole corpus. But it is phrased as coverage rather than as a dated
measurement, so today a reader takes it as "the corpus" and it is off by four. If it is left, it
wants "the three scenarios that existed when this was measured".

**Recommendation for both:** they belong in one follow-up card with the ordinal-dropping change,
since all three are the same class and all three live in `index.ts` doc comments.

---

## 6. What was deliberately NOT changed

- **No behaviour, no assertion, no golden.** Mechanically shown above, not asserted.
- **No shipped gate message.** `gate/index.ts:1057` already spells the derived `SEVENTEEN … six
  distinct prop names` and is pinned by T012's derivation; this card had no reason to touch it and
  it is outside `allowed_files` anyway.
- **12b's `ZERO` is still not derived**, for T012 §6's reason — deriving it would add exactly the
  instrument-that-cannot-fail this fold has been removing.
- **Nothing committed.** Working tree carries the single modified file plus this note.
