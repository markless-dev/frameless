# T018 — the mutation-no-op audit across all three gate corpora

Package: T018 (Worker). Spec: `notes/T007-phase-b-audit.md` §6.3.
Scope: `packages/frameworks/{react,solid,qwik}/test/gate.test.ts` plus this note.

## 1. Verdict

**Zero mutations were already vacuous on this checkout.** All 126 table rows and
every ad-hoc mutation in the three corpora were converted to a throwing
constructor, and every one of them changed its source on the first run. Nothing
had to be adjudicated as an unguarded policy, and no previously-green test went
red.

That is the honest headline, and it is weaker than it sounds. The corpora were
not sound *by design* — they were sound *by circumstance*, on an LF checkout, at
this commit. The audit's real output is the four latent exposures below, three of
which nothing in the suite could have reported.

The one row that HAD been vacuous — Solid's S-SH7 — was found by T006, ruled by
T007 and fixed by T008 before this package started. This package generalises that
fix and asks whether it was the only one. It was not the only *exposure*; it was
the only one that had actually fired, because it was the only newline-bearing
search over disk-read source that a CRLF checkout was reaching.

## 2. Method

Four passes, because the discriminating shape T007 named (disk-read source + an
escaped-`\n` search literal) finds one instance and the failure mode has more
than one mechanism.

1. **Conversion.** Every `.replace()`/`.replaceAll()` that builds a mutant now
   goes through `mutate`/`mutateAll`, which throw when the result is
   byte-identical to the input. Done as a scripted rewrite plus manual handling
   of the 15 chained calls, then reviewed as a diff. Any future miss — from a
   line ending, a drifted literal, a regex that stopped matching — is now loud
   rather than silent.
2. **CRLF probe.** Every one of the **37 disk-read searches** across the three
   corpora was matched against a CRLF-ised copy of its own source. This is the
   check T007's repo-wide scan approximated by grepping for newline-bearing
   string literals. Result: **one** fragile search, and the scan had missed it
   because it is a regex, not a literal (finding 1).
3. **Duplicate scan.** Every row's mutant construction was compared against every
   other row's in the same table, to catch the "copied and only half-edited"
   mechanism. Result: three duplicates in the React corpus (finding 3).
4. **Base-fixture check.** A `toContain(policy)` on a mutant proves nothing
   unless the *unmutated* fixture is clean. Solid asserts this; React never did
   (finding 2).

## 3. Inventory

| Corpus | Mutants | Mechanism | Status |
| --- | --- | --- | --- |
| React `mutationCases` | 47 rows | 42 `mutate` over the in-file `valid` template; 5 build the mutant by concatenation (`disable directive`, `enable directive`, `inline rule config`, `forwardRef member`, `foreign import`) | sound — the 5 have no search channel and cannot miss |
| React `compositionMutationCases` | 19 rows | 17 `mutate`/`mutateAll` over disk-read `generated-composition/*.jsx`; `container artifact with module store output` emits from a mutated artifact; `dropped authored projection` mutates the *artifact* and feeds unmutated source | sound — the 2 artifact rows are two-sided (the same source is asserted clean elsewhere) |
| React artifact builders | 2 | `pageArtifact` and `projectionArtifact` mutate disk-read `.tsrx` fixture text before compiling | converted — same exposure as the emitted-source rows |
| Solid `mutationCases` | 38 rows | 36 `mutate` over `valid`; 2 by concatenation | sound |
| Solid `compositionMutationCases` | 22 rows | all `mutate`/`mutateAll` over disk-read `generated-composition/*.jsx` | sound; S-SH7 was already repaired by T008 |
| Solid ad-hoc | 5 | `props2` rename, destructured-param, unrecorded import, the `arms()` Show helper, the temp-dir end-to-end write | converted |
| Qwik `useVisibleTask$` mutation | 2 calls | `mutate` over disk-read `generated/S1.jsx` | converted — the most exposed corpus of the three, since its mutants are built from emitted files the emitter is free to reshape |
| Qwik persistence / pre-fix-shape mutations | 2 tests | mutate the IR, not text; `expect(stripped).toHaveLength(2)` already asserts its own precondition | sound — no miss channel |
| Qwik `frameless/no-handler-prevent-default` calibration | 5 shapes + 1 anti-vacuity | hand-written mutant sources | sound — no miss channel; the residual risk is representativeness, not vacuity |
| Qwik lint-policy calibration | 4 cases | hand-written mutant sources | sound |

126 table rows, 159 constructor call sites, 37 disk-read searches probed.

## 4. Findings

### Finding 1 — a fifth CRLF-fragile search, and the only one left in the repo

`packages/frameworks/react/test/gate.test.ts`, the **R-SH1** row
(`incomplete store hook record`). Its search is a regex over `store`, which is
read from `generated-composition/C2-shared.jsx`, and it contained two literal
`,\n` sequences. Probed against a CRLF-ised copy of that file: **no match.**

- **Policy left exposed:** R-SH1, the React shared-store hook-record shape. On a
  CRLF checkout the row would have asserted R-SH1 against the unmutated store —
  which the gate correctly accepts — so it would have failed loudly *after*
  T008's `mutate` conversion, but before it, it would have been the same silent
  vacuum as S-SH7.
- **Since when:** introduced in `5db76a4` (2026-07-21), the React composition
  gate package. It has carried this exposure for its whole life.
- **Why T007's scan missed it:** that scan searched for `.replace()` **string
  literals** containing a newline and found four. This is a **regex literal**.
  The shape T007 named is right; the instrument used to find instances of it was
  narrower than the shape.
- **Fixed:** hoisted to `STORE_HOOK_RECORD` with `\r?\n`, replacement `$1$2\t);`
  so the mutant keeps the checkout's own separator — the same repair T008 applied
  to S-SH7 — plus a CRLF calibration that goes red if the `\r?\n` is reverted.

The three React `\n`-bearing *literals* T007 flagged search the in-file `valid`
template. They are safe on any checkout because ECMAScript normalises CRLF to LF
inside template literals. That safety is real but it belongs to the language, not
to the searches; both corpora now carry a comment saying so, next to the searches
that DO need `\r?\n`, so a copier learns the rule rather than the instance.

### Finding 2 — React never proved its base fixture was clean

Every row in React's `mutationCases` asserts `toContain(policy)` on a mutant.
That is evidence only if the unmutated `valid` violates nothing: a fixture that
had drifted into tripping, say, `react-import-allowlist` would make every row for
that policy pass without the mutation contributing anything.

- **Policy left exposed:** potentially any policy in the React table — this is a
  whole-table precondition, not a single row's.
- **Since when:** since the table existed. Solid has asserted its half
  (`policies(valid)` → `[]`) all along; React's copy of the pattern dropped it.
- **Measured:** `valid` **is** clean. The gap was in the assertion, not the
  fixture — nothing was actually being mis-measured.
- **Fixed:** added `CALIBRATION: the unmutated fixture violates nothing`.

### Finding 3 — three duplicated rows in the React tables

Three rows build a **byte-identical** mutant to another row in the same table:

| Row | Duplicate of | Introduced |
| --- | --- | --- |
| `computed-member setter` (second copy) | `computed-member setter` | `d39a3ba` 2026-07-20 |
| `react import allowlist` | `unused import` | `d39a3ba` 2026-07-20 |
| `direct listener iteration notify-per-write shared tear` | `notify-per-write shared tear` | `f3edb7b` 2026-07-21 |

These are **not vacuous** — each mutates, and each genuinely exercises its
policy. They are the "copied and only half-edited" mechanism, and the third is
the one that matters: its two siblings (`helper-hidden`,
`member-helper-hidden`) *are* distinct shapes, so the table's names claim R-SH3
is guarded against three notify-per-write bypasses when it is guarded against
two. The distinct shape that row's name promises was never written.

- **Not deleted.** Dropping a row is a coverage decision, and the card is
  explicit that a mutation is not to be removed to make anything tidy. Each is
  marked in place with a comment naming its twin, so the next adapter corpus does
  not copy a row that duplicates its neighbour.
- **Recommended follow-up (not done here):** an invariant test that no two rows
  in a table build the same mutant. It would fail today on these three, which is
  why it belongs to whoever adjudicates them rather than to this package.

> **T021 correction, recorded 2026-07-27.** The sentence above — "the distinct
> shape that row's name promises was never written" — is an **over-read, and this
> note is where it originated.** The twin at `gate.test.ts:588-595` injects
> `for (const listener of countListeners) listener();`, which *is* direct listener
> iteration. Four rows covered three distinct shapes; no name promised anything
> unwritten, and writing "the direct shape" would have produced a *third*
> near-duplicate. The genuinely uncovered notify shape was `.forEach(cb)` —
> `custom-policies.ts:1133-1152`, exercised by nothing in either corpus. T023
> rewrote all three rows accordingly, so the table above names rows that no longer
> exist; it is kept as the audit trail, not as a description of the current file.
>
> This note's own scan also had a blind spot of exactly the kind Rule 4 names: it
> compared **mutants** and so could not see that row **names** collide too
> (`dynamic computed-member setter` twice, with distinct mutants). A colliding name
> is a colliding vitest title, and a red under a duplicated title cannot be
> attributed to a row. Hence rule 5 below.

### Finding 4 — the constructors themselves were uncalibrated in two of three corpora

T007's Rule 3 is two-sided calibration for harnesses. T008 shipped one for
Solid's `mutate`; React and Qwik had none, and the failure a mutation constructor
guards against is silent by construction, so nothing else would report a broken
constructor. All three corpora now carry
`CALIBRATION: a mutation that leaves the source unchanged is loud`, each
exercising a miss on its own sources, and each also exercising the
matched-but-unchanged case — because the assertion is on the OUTPUT, not on the
search, and that distinction is the whole reason the check is written the way it
is.

## 5. The idiom to copy

In all three files, at module scope, immediately above the fixtures:

```ts
function assertMutated(source: string, mutated: string, search: string | RegExp): string {
	if (mutated !== source) return mutated;
	throw new Error(
		`gate mutation did not change the source: ${String(search)} left it byte-identical, ` +
			'so this row would assert a policy against a non-mutant',
	);
}

function mutate(source: string, search: string | RegExp, replacement: string): string {
	return assertMutated(source, source.replace(search, replacement), search);
}

function mutateAll(source: string, search: string, replacement: string): string {
	return assertMutated(source, source.replaceAll(search, replacement), search);
}
```

Five properties a new adapter corpus must preserve:

1. **Assert the output, not the search.** `mutated !== source` is the property
   the row depends on. A search that matched but rewrote the text to itself is a
   non-mutant too, and this check rejects it; a check on "did the search match"
   would not.
2. **Every mutant goes through it,** including mutations of fixture text read off
   disk before compiling, and including one-off mutations inside individual
   tests. The React `pageArtifact`/`projectionArtifact` builders are the easy
   ones to miss.
3. **`\r?\n` in any search that spans a line break over disk-read source.**
   Searches over an in-file template literal do not need it — ECMAScript
   normalises CRLF there — and both surviving instances (Solid S-SH7, React
   R-SH1) carry a CRLF calibration that goes red if the tolerance is removed.
4. **Calibrate the constructor and the base fixture.** A helper nobody has
   watched fail is not evidence that it can fail, and a mutant assertion is
   evidence only against a fixture proven clean.
5. **A mutation *table* carries the no-duplicate name/mutant invariant from the
   day it has two rows.** Not from the day someone notices; the React table went
   ~7 months and 47 rows before an audit found three half-finished copies, and the
   scan that found them was itself blind to a fourth class. Two independent keys,
   because each catches what the other cannot:
   - **Name.** `test.each(table)('rejects the %s bypass mutation')` makes the row
     name the vitest title, so two rows sharing a name produce two identically
     titled verdicts and a red cannot be attributed to a row. Mutant-keyed scans
     are structurally blind to this.
   - **Mutant *and its asserted policy*, as one key.** Two rows building the same
     mutant against **different** policies are not a duplicate — they are two
     independent detectors on one bypass shape, and dropping either loses a
     detector assertion. React's `index key AST` / `index key plugin` pair is
     exactly that and is deliberate. Key on the mutant alone and the invariant
     fires on a legitimate row, which forces the suppression list that would
     hollow it out. Key on the pair and it still catches every half-finished copy,
     since a copied row copies its policy too.

   No exemption list, no allowlist, no skip: a table carrying one has an
   unadjudicated duplicate, and the adjudication is the work. Calibrate it
   three-sided against a **synthetic** table — clean, name collision, mutant
   collision — because on a healthy real table it will only ever be green, and an
   invariant nobody has watched fire is not evidence that it can fire (Rule 4,
   same reason as property 4 above). A fourth side is worth adding: same mutant,
   different policy, asserted **not** to fire, so the key's shape is documented by
   a test rather than by a comment.

   Neither Svelte nor Qwik has a mutation table today — both are hand-written
   tests with no `test.each` — so this rule reaches them, and Vue and Angular,
   through this note rather than through a copied test.

The Qwik corpus carries `mutate` only; it has no `replaceAll` mutation. Its
comment says to add the twin rather than leaving a copier to improvise one.

## 6. Verification

- `pnpm check` — clean (three tsc passes).
- `pnpm test` — **571 passed | 1 skipped (572)**, 39 files. Baseline on this
  worktree was 568 passed | 1 skipped; +3 is the three new calibration tests. The
  skip is pre-existing and environmental (`packages/cli/test/node.test.ts` skips
  itself when `dist/node.js` is absent, i.e. before `pnpm build`).
- `pnpm lint` — 0 warnings, 0 errors.
- `git status --short` — the three gate files and this note.
- Formatting was checked without running `pnpm fmt`: the checked-in versions of
  all three files already deviate from `vp fmt` in a handful of places, and the
  edited versions deviate in exactly the same places and no others — React's set
  is one smaller, because restructuring a chain removed one.
