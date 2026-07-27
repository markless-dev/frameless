# T006 — Phase B diagnoses: defects 4, 6 and 3-B

Three bounded experiments. Each produces a **decision with evidence**. None
produces a fix. The repo was read-only throughout: every experiment ran on a
scratchpad script or an in-memory Vite `transform`, never on a repo file.

Before each interpretation, one question was asked first, because T004 was
overturned for not asking it:

> **Is this test operating the thing inside its intended contract? If not, the
> finding is about the instrument, not the product.**

The answers are recorded per experiment under **Fairness check**, and they are
not all the same.

---

## Summary

| Defect | Reading | Confidence | Fairness of the instrument |
| --- | --- | --- | --- |
| **4** WebKit quiescence | **Reading 1, and stronger than reading 1 as written** — not "WebKit is slower to settle" but "the bound measures the wrong quantity" | High on the mechanism, medium on the CI incident (not reproduced on Linux WebKit) | **UNFAIR.** `boundedQuiescence` is not measuring anything WebKit owes in 500ms |
| **6** rename invariant | **Reading 1** — only the order of name-keyed collections differs; legitimate | Very high | **UNFAIR.** The invariant contradicts an explicit canonicalisation in the IR |
| **3-B** Windows `S-SH7` | **CRLF CONFIRMED as the trigger, but the stated cause is REFUTED** | Very high on the mechanism, high on the CI attribution | Mixed — the gate is fine; the *test fixture* is not portable |

---

## Defect 4 — WebKit exceeds the analyzer's quiescence bound

### What the instrument actually is

`packages/frameworks/react/src/adapter.ts:65-78`:

```ts
async function boundedQuiescence(host: HTMLElement, flush: () => Promise<void>): Promise<void> {
	const deadline = performance.now() + 500;
	let previous = '';
	let stable = 0;
	while (performance.now() < deadline) {
		await flush();
		await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
		const current = host.innerHTML;
		stable = current === previous ? stable + 1 : 0;
		previous = current;
		if (stable >= 2) return;
	}
	throw new Error('Observable DOM did not quiesce within 500ms');
}
```

The deadline is **wall-clock**. The loop's progress is **entirely gated on
`requestAnimationFrame` delivery**. `stable >= 2` needs three snapshots, so three
rAF callbacks, minimum — always, even when nothing is pending.

`packages/frameworks/solid/src/adapter.ts:52` and
`packages/frameworks/qwik/src/adapter.ts:55` carry the identical loop (with
`await Promise.resolve()` in place of React's `act` flush). Whatever is ruled
here applies to all three adapters.

### Measurement

Instrumented copy of `boundedQuiescence` injected by a Vite `transform` hook
(scratchpad config; `packages/frameworks/react/src/adapter.ts` untouched),
raising only the deadline so the loop can be watched to completion, and adding a
post-settle pure-rAF watch. Run on all three engines, macOS, headless.

| engine | settle time (3 settles) | rAF interval in-loop | rAF interval post-settle (baseline) | ticks to settle | distinct DOM values seen | first snapshot == final DOM | DOM changed after settle |
| --- | --- | --- | --- | --- | --- | --- | --- |
| chromium | 20.7 / 18.0 / 19.6 ms | 8.2-8.3 ms | 7.4-9.4 ms | 3 | **1** | **yes** | no |
| firefox | 19 / 15 / 15 ms | 6-8 ms | 5-9 ms | 3 | **1** | **yes** | no |
| webkit (macOS) | **44 / 28 / 29 ms** | 14 ms | 13-15 ms | 3 | **1** | **yes** | no |

**The DOM never changes.** In every engine, on every one of the three tests, the
observed `host.innerHTML` is already at its final value on the very first
snapshot, is the only value ever seen during the loop, and does not change during
600 ms of further watching. `distinctDomDuringLoop: 1` in all nine runs.

Therefore **none** of the loop's elapsed time is DOM settling. 100 % of it is
waiting for three animation frames. WebKit's 44 ms is 3 x 14 ms; Chromium's
20.7 ms is 3 x ~8.3 ms. The only cross-engine difference measured is frame
cadence, and it is 1.7x, not 25x.

The DOM at settle is byte-identical across engines
(`<input data-action="type" value="typed">`), so there is no engine divergence in
the thing the test asserts.

### The bound's real tolerance, measured

Because the deadline is only checked at the top of the loop, the loop can
legitimately return *after* 500 ms. Measured with rAF wrapped to a fixed cadence
(nothing else changed — React, the adapter and the DOM are untouched):

| forced rAF cadence | outcome with the repo's own unmodified adapter |
| --- | --- |
| 200 ms/frame | **passes** — settles at 607 ms, i.e. past the "500 ms" bound |
| 240 ms/frame | **passes** |
| 260 ms/frame | **fails** |
| 300 ms/frame | **fails**, verbatim `Error: Observable DOM did not quiesce within 500ms` |

So the true predicate is *"two rAF intervals complete within 500 ms"* — an
average frame time under ~250 ms, i.e. a sustained frame rate above ~4 fps. The
"500 ms" in the message is not the number the code enforces.

### What the DOM looks like when the bound expires

From the instrumented run at a 200 ms cadence (the bound is exceeded, the loop is
allowed to continue so the state can be read):

```
"wouldPassAt500ms": false,
"domAtBoundExpiry":     "<input data-action=\"type\" value=\"typed\">",
"domAtBoundEqualsFinal": true,
"firstSnapshotEqualsFinal": true,
"postSettleChanged": false
```

**At the moment the bound expires, the DOM is byte-identical to the fully settled
DOM.** Nothing was pending. The error message is false on its face in this
failure mode: the DOM had quiesced before the first snapshot was taken. What did
not arrive in time was the third animation frame.

### The failure is not WebKit-specific

The verbatim CI error was reproduced **on Chromium**, with the repo's own
unmodified `boundedQuiescence`, by changing nothing but frame cadence:

```
× dispatches analyzer input actions through React controlled inputs 735ms
Error: Observable DOM did not quiesce within 500ms
     77|  throw new Error('Observable DOM did not quiesce within 500ms');
```

This is the T004 signature. "It reproduces on WebKit" was read as a WebKit
property; it reproduces on **any** engine once frames are slow, so the
observation is about the instrument's assumption, not the engine.

### Reading 2 is not supported

Three independent arguments, all from evidence:

1. **The DOM is identical.** macOS WebKit produces the same `innerHTML`, on the
   same tick, with no post-settle change. If WebKit handled React controlled
   inputs differently, that is where it would show, and it does not.
2. **Only 1 of 55 react-browser tests failed in CI.** Under a *sustained* frame
   starvation (300 ms/frame, Chromium) **42 of 55 fail** — because 42 of them go
   through a `settle()`. A systematic engine divergence in the settle loop has a
   blast radius of 42; the observed blast radius was 1.
3. **The two sibling tests in the same file passed.** `...controlled textareas`
   and `...controlled checkboxes` use the identical adapter, the identical
   `settle()` and the identical controlled-input mechanism. A semantic WebKit
   divergence in React controlled inputs cannot fail the first and pass the other
   two.

### Decision

**Reading 1 — and it should not be closed by raising the bound to 700 ms.**

The measured facts do not say "WebKit needs ~700 ms to settle". They say the
quantity being bounded is wrong: the loop counts frames and the bound counts
milliseconds, and `requestAnimationFrame` carries **no rate guarantee at all** —
least of all in a headless browser that may never composite a frame. Raising 500
to 2000 would buy margin against the symptom while leaving a rAF-gated loop with
a wall-clock deadline, which is the actual defect in the instrument.

Recorded for T007 to rule on, not implemented here. What the evidence supports:
gate the loop on something with a delivery contract (a microtask/`setTimeout`
turn, or a `MutationObserver` with a quiet period) and keep the wall-clock
deadline as a true upper bound; alternatively keep rAF but bound the loop on
*ticks* rather than time. Either way the change belongs in all three adapters,
and it must be calibrated — a settle loop that cannot fail is not a settle loop.

**Confidence:** high on the mechanism (measured in three engines, threshold
pinned to ±10 ms, verbatim error reproduced on a second engine); medium on the
specific CI incident, see missing evidence.

### Missing evidence

- **The CI failure was not reproduced.** macOS WebKit passes this test with
  11x headroom (44 ms against a ~500 ms budget). The CI cell is
  `ubuntu-latest` + `playwright install --with-deps webkit`, i.e. headless
  **WebKitGTK**, a different port with a different frame scheduler and no GPU.
  That build is not available on this machine.
- Consequently the *magnitude* of the Linux stall is unknown. Sustained
  starvation over-predicts (it would have failed 42 tests, not 1), so the CI
  event looks like a **single isolated scheduling stall** on one `settle()` call
  against a bound with no margin for one. That inference is not directly
  observed.
- It remains formally unexcluded that Linux WebKit produced a *different* DOM.
  Nothing supports it: the value asserted is the same string macOS WebKit
  produces on the first frame, and the sibling tests passed.

### Fairness check — defect 4

**The instrument is not fair, and the answer to the card's question is no.**
`boundedQuiescence` is not measuring something WebKit is contractually obliged to
deliver in 500 ms. The HTML spec obliges rAF callbacks to run *before the next
repaint*; a browser that is not painting owes no repaint and therefore no
callback, on any schedule. 500 ms is a number that happened to work on one engine
because that engine happened to paint at ~120 fps. The bound silently encodes a
minimum frame rate that no specification provides.

---

## Defect 6 — whole-IR rename invariant fails generatively

### The counterexample, reproduced

Program from `findings-006` (fast-check seed 20260726): three `state` locals
`epsilon9`, `beta6`, `gamma1`; body a single text node; rename
`epsilon9 -> zpsilon9`. Built with `buildEnrichedIr` directly and compared with
`metamorphic.test.ts`'s own `structural()` helper (whole-word occurrences of both
names blanked to `_id_`), then deep-diffed field by field.

**8 differing leaves, all inside `records.bindings`, all a swap of indices 2 and 3:**

```
records.bindings.2.id                  "state:_id_"    ->  "state:gamma1"
records.bindings.2.name                "_id_"          ->  "gamma1"
records.bindings.2.initializer.start   118             ->  165
records.bindings.2.initializer.end     119             ->  166
records.bindings.3.id                  "state:gamma1"  ->  "state:_id_"
records.bindings.3.name                "gamma1"        ->  "_id_"
records.bindings.3.initializer.start   165             ->  118
records.bindings.3.initializer.end     166             ->  119
```

The offsets travel *with* their entries — they are swapped, not changed. Nothing
else in the IR differs. The single-local version of the same program compares
**identical** (0 diffs), matching the note.

### The cause, read out of the source

`packages/compiler/src/build.ts:427-430`:

```ts
const records = {
	bindings: [...bindings].sort((left, right) => compareText(left.id, right.id)),
	aliases:  [...aliases].sort((left, right) => compareText(left.id, right.id)),
	events:   [...events].sort((left, right) => compareText(left.id, right.id)),
	stateReads: collectCanonicalReads(enrichedComponents, bindings, events),
	stateWrites: writes,
	...
```

`records.bindings` is **explicitly sorted by `binding.id`**, and a state
binding's id is `state:<name>`. `collectCanonicalReads` (`build.ts:2722-2725`)
ends in `.sort(compareReads)`, which orders by `componentId`, then
`graphNodeId` — also name-derived. These are deliberate canonicalisation steps;
they have been there since the compiler package was scaffolded (`93420a3`).

So a rename that moves a name alphabetically **must** permute those arrays. That
is the canonical form doing its job.

### The stated hypothesis: confirmed in substance, corrected in wording

`docs/DEFECTS.md` and `findings-006` say *"something orders **locals** by name"*.

- **Confirmed:** a name-keyed collection is ordered by name, and the alphabetical
  move is the trigger. Control runs: `epsilon9 -> dpsilon9` (alphabetical
  position unchanged among `beta6/…/gamma1`) compares **identical, 0 diffs**;
  `beta6 -> zeta6` (first to last) produces the same kind of permutation.
- **Corrected:** it is **not** the locals. `components[].locals` keeps
  declaration order and is byte-identical before and after in every run. The
  sorted collections are `records.bindings` and `records.stateReads`. A fixer
  told to look at "locals" would look in the wrong place.

### Generalised beyond the one counterexample

The one counterexample has no reads, no events and no writes, so it could not
show whether anything *else* moves. Replayed `generative.test.ts`'s `programArb`
at seed 20260726 for **200 runs**, comparing the **whole IR** with `structural()`
and classifying every mismatch:

```
runs                                                 : 200
whole-IR mismatches                                  : 10
  of those, PERMUTATION-ONLY of a records.* collection: 10
  of those, NOT a pure permutation                    :  0
components[].locals declaration-order changes         :  0

diff paths (array indices generalised) -> count
   20  records.bindings.#.id
   20  records.bindings.#.name
   14  records.bindings.#.initializer.start
   14  records.bindings.#.initializer.end
    8  records.bindings.#.writes.#
    6  records.bindings.#.computed.expression.start
    6  records.bindings.#.computed.expression.end
    6  records.bindings.#.computed.expression.body.start
    6  records.bindings.#.computed.expression.body.end
    6  records.stateReads.#.graphNodeId
```

"Permutation-only" was checked structurally, not by eyeballing paths: for every
`records.<collection>` touched, the **multiset** of its entries (each entry
JSON-canonicalised) is identical before and after. It was identical in all 10.
Every differing path lies inside a collection the compiler explicitly sorts by a
name-derived key. Nothing outside `records.*` differed in any of the 200 runs.

### Decision

**Reading 1 — legitimate. This is not a compiler finding.** Declaration order is
stable under renaming (`components[].locals` never moved, 200/200), and no cell
wiring differs. The comparison needs an order-insensitive view of the
name-canonicalised record collections.

**Guardrail for whoever implements that**, because the tempting fix is too broad:
the order-insensitive view must be applied **only** to the collections
`build.ts:427-430` actually sorts — `records.bindings`, `records.aliases`,
`records.events`, `records.stateReads`. It must **not** be applied to
`records.stateWrites`, which is `writes` unsorted and whose order is *authored
write order* — a load-bearing semantic the Solid gate polices as `S-SH7`
("Shared writes or calls differ from the artifact-recorded authored sequence"),
nor to `components[].locals`, nor to any template array. A blanket "sort
everything before comparing" would silence exactly the instability the invariant
exists to catch. The existing calibration in `metamorphic.test.ts`
("changing a literal is caught", "dropping a cell is caught") must still fail.

**Confidence:** very high. Mechanism read directly out of `build.ts`; behaviour
confirmed by three controls and a 200-run sweep with zero counterexamples to the
ruling.

### Fairness check — defect 6

**The instrument is not fair, and here that is provable rather than argued.** The
IR's `records.*` arrays are a canonical form keyed on identifier ids. The
invariant "a rename changes identifier strings and nothing else" demands
*positional* stability of a collection whose position **is defined by the
identifier that was just changed**. The invariant contradicts a declared property
of the artifact, so it was asking for something outside the contract. Unlike
defect 4, the scope of that unfairness is bounded and was measured: 200 programs,
zero differences of any other kind.

---

## Defect 3 cause B — Windows `expected [] to include 'S-SH7'`

### The assertion

`packages/frameworks/solid/test/gate.test.ts` (line 610 on the source branch) is
the `rejects the %s composition bypass mutation` table, whose `S-SH7` row is:

```ts
[
	'shared method order drift',
	shared.replace(
		'setHistory(`${history()}:${count()}`);\n\t\tsetCount(count() + 1);',
		'setCount(count() + 1);\n\t\tsetHistory(`${history()}:${count()}`);',
	),
	'S-SH7',
	compositionArtifacts.get('C2-shared'),
],
```

`shared` is `compositionSources.get('C2-shared')`, read **from disk** at
`gate.test.ts:41-43` from `generated-composition/C2-shared.jsx`. The search
literal embeds `\n\t\t`. On a Windows checkout that file is CRLF, so the literal
cannot match `\r\n\t\t`, and `String.prototype.replace` **returns the string
unchanged with no error** — a silent no-op.

### Simulation

Scratchpad script, run against the real gate (`checkSources` from
`packages/frameworks/solid/src/gate/index.ts`) with the sources converted to CRLF
in memory. Nothing written.

| # | fixture + generated source | mutation search string | mutation applied? | gate output |
| --- | --- | --- | --- | --- |
| A | LF (as on disk) | LF (as in the test) | yes | `["S-SH7"]` |
| **B** | **CRLF (Windows checkout)** | **LF (as in the test)** | **no** | **`[]`** |
| C | CRLF | CRLF-aware | yes | `["S-SH7"]` |
| D | CRLF, unmutated | — | — | `[]` |
| D' | LF, unmutated | — | — | `[]` |

Row **B** reproduces the CI failure exactly: the assertion is
`expect(await policies(source, artifact)).toContain('S-SH7')` and it receives
`[]`, producing `expected [] to include 'S-SH7'`, verbatim.

### The CRLF hypothesis is confirmed as the trigger and REFUTED as the cause

`docs/DEFECTS.md` and `findings-004` guess: *"any hashing or line-splitting over
emitted source will differ from LF"* — i.e. they blame the **gate**. That is
wrong, and rows C and D prove it:

- **Row C:** given a genuinely reordered CRLF source, the gate reports `S-SH7`.
  The gate detects the mutation perfectly well on CRLF.
- **Row D:** given a clean CRLF source, the gate reports no violation. It does
  not false-positive on CRLF either.
- **Why:** `S-SH7` is `actual !== expected` where both sides go through
  `formatEmitted` (`packages/frameworks/solid/src/format-emitted.ts`), which
  calls `oxfmt` with `endOfLine: 'lf'`. Line endings are normalised away before
  any comparison. There is no hashing and no line-splitting.

**The defect is in the test fixture, not in the gate.** The gate was handed a
non-mutant and correctly reported that it was clean.

### Why this one row and no other

Scanned every `.replace(<literal>, ...)` search argument in
`packages/frameworks/solid/test/gate.test.ts`:

```
solid gate.test.ts .replace() search args containing a newline : 1
  "setHistory(`${history()}:${count()}`);\n\t\tsetCount(count() + 1);"
```

Exactly one, and it is the `S-SH7` row. Every other mutation searches for a
single-line fragment, which matches identically under CRLF; several *insert*
`\n`, which is harmless. This is strong corroboration: the CI signature was one
assertion in this table, and exactly one row in this table is CRLF-fragile.

### Adjacent finding — a THIRD Windows cause, not named in `findings-004`

Not asked for; found while checking whether line endings reach the compiler, and
recorded because T008 owns the Windows fixes and will otherwise be surprised.

Building the same fixture from LF and from CRLF yields IRs that differ **only in
AST byte offsets** (`start`/`end` shift by one per preceding line — correct
behaviour, the offsets track the real bytes; no semantic field differs). But
`packages/compiler/test/goldens/*.json` **bake those offsets in**, and
`enriched-ir.test.ts:655-666` asserts `readFileSync(golden) === dumpEnrichedIr(ir)`
byte-for-byte:

```
s1-render-once | LF dump === golden: true | CRLF dump === golden: false | CRLF dump === CRLF-ised golden: false
s2-keyed-todo  | LF dump === golden: true | CRLF dump === golden: false | CRLF dump === CRLF-ised golden: false
s3-event-form  | LF dump === golden: true | CRLF dump === golden: false | CRLF dump === CRLF-ised golden: false
```

All three golden tests break on a CRLF checkout, and normalising the golden file
does **not** fix it — the baked offsets are wrong for CRLF input. That is three
more of the 35 Windows failures, from a cause `findings-004` does not list.

Note also: the repo has **no `.gitattributes`**. That is what lets a Windows
checkout be CRLF in the first place, and it is the single change that would
address 3-B and this adjacent finding together. Whether that is the right fix is
T007's ruling and T008's work; it is recorded here as evidence, not as a
prescription.

### Decision

**CRLF confirmed as the trigger; the documented cause refuted.** Defect 3-B is a
**test-suite portability bug** — a mutation fixture whose search literal assumes
LF and no-ops silently when it does not match — not a gate, hashing or
line-splitting bug. It is nonetheless a real fix target: defect 3 is "the test
suite does not run on Windows", and this genuinely stops it running.

**Confidence:** very high on the mechanism (row B reproduces the exact assertion
failure; rows C and D exonerate the gate; only one CRLF-fragile row exists). High
on the CI attribution — Windows was not available here, so the CRLF checkout is
simulated, and the claim rests on `core.autocrlf` defaulting to CRLF conversion
on Windows in the absence of a `.gitattributes`.

### Fairness check — defect 3-B

**Mixed, and worth stating precisely.** The *product* under test — the Solid
gate — was operated well inside its contract and behaved correctly on both LF and
CRLF input. The *instrument* was not: the mutation harness silently produced a
non-mutant and the assertion then reported the gate's correct answer as a
failure. The distinguishing feature versus defect 4 is that here the unfairness
does not exonerate anything the goal cares about — a mutation fixture that can
silently fail to mutate is itself a defect, and `.replace()` returning the input
unchanged is the same class of silent no-op the board's own green-vacuum
discipline exists to catch. Recommend to T007 that the fix be paired with an
assertion that the mutation actually changed the source, in the pattern already
used at `metamorphic.test.ts:78` (`expect(renamedSource).not.toBe(original)`).

---

## Verification

| command | result |
| --- | --- |
| `git status --short` | only this note |
| `pnpm test` | **561 passed (561)**, 39 files |

Browser artifacts created by the defect-4 runs
(`packages/frameworks/react/.vitest-attachments/`, new entries under
`test/__screenshots__/`) were removed with a path-scoped `git clean -fd` before
the final status check. `test-results/` is gitignored and was not touched.

## Instrumentation used (all outside the repo)

Scratchpad
`/private/tmp/claude-501/-Users-jacksm5pro-dev-open-source-frameless/2b78a698-3bad-4e2e-a0e0-6404787da9e7/scratchpad`:

- `d3b-crlf.mjs`, `d3b-artifact-diff.mjs` — defect 3-B, executed via
  `node --input-type=module -e "$(cat …)"` with cwd inside the package so bare
  specifiers resolve; imports the real gate and compiler, mutates only in memory.
- `d6-rename.mjs`, `d6-sweep.mjs` — defect 6, same technique.
- `d4-quiescence.config.ts` — defect 4, a vitest config whose `root` is the react
  package and whose Vite `transform` hook replaces `boundedQuiescence` **in
  memory**; results POSTed to a `configureServer` middleware because vitest
  browser-mode console output is not forwarded here.
- `d4-realbound.config.ts` — defect 4, the repo's **unmodified**
  `boundedQuiescence`, with only `requestAnimationFrame` wrapped to a fixed
  cadence via an in-memory transform of the setup file.

No repo file was modified by any experiment.
