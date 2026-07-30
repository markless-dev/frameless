# T999 — final audit of `frameless-app-suite-v1`

**Judge receipt detail. Decision: `not_complete`. `full_outcome_complete: false`.**
HEAD `6156352`. Read-only; the only write is this file.

Two of three oracle parts are **fully certified on evidence I re-derived myself**. The
third is certified. What is missing is **one named clause of part 2 for one of the two
shipped apps**, plus **a measurably refuted instruction still standing in `goal.md`** —
the exact failure this card was written to catch.

---

## 0. THE COMPLETION FIELDS, QUOTED VERBATIM, AND THE PART COUNT STATED FIRST

**`goal.oracle.signal` declares its own count in its first three words: "THREE PARTS,
ALL REQUIRED." The count is THREE. I evaluate three.**

> **`oracle.signal`** — "THREE PARTS, ALL REQUIRED. (1) THE DOOR IS MEASURED:
> computed(async ...) probed in ALL SIX LANES with a witnessed per-lane result - emits /
> refuses-with-verbatim-message / emits-but-misbehaves - landing BEFORE any app depends
> on it. A REFUSAL IS A LEGITIMATE RESULT. (2) EVERY APP THAT SHIPS IS AUTHORED ONCE,
> EMITTED SIX WAYS, AND LOOKS LIKE ITS REFERENCE: one .tsrx source, NO hand-written
> per-lane app code, a documented and ACTUALLY-RUN launch command per lane, and a visual
> match to a NAMED reference design recorded on the card. A lane that cannot be generated
> is left UNBUILT with its verbatim refusal. (3) NOTHING REGRESSES: pnpm test at EXACTLY
> ONE failure (the foreign package-inventory ARM B); pnpm check DOES NOT RISE above 267;
> pnpm e2e stays 6 x 9; lint and check:citations clean."

> **`oracle.cadence`** — "after the probe, after each app, and at final audit"

> **`oracle.final_proof`** — "The six-lane door result stated per lane; then, for each
> shipped app, the launch command that was RUN, a visual comparison against its NAMED
> reference, and proof that no per-lane app code was hand-written. For every lane NOT
> shipped, the VERBATIM refusal. A missing lane with a refusal is a legitimate outcome; a
> missing lane with no refusal is not."

> **`intake.completion_proof`** — "The six-lane door result; each shipped app emitted from
> ONE source into six lanes with a launch command that was RUN and a visual match to its
> named reference; every refusal verbatim."

**Three parts. Three clauses in `final_proof` per shipped app: launch command RUN, visual
comparison against NAMED reference, proof no per-lane code was hand-written — plus the
verbatim refusal for every lane not shipped.** `signal` (2) adds one word `final_proof`
compresses and `completion_proof` drops: the launch command must be **documented** as well
as run. That word is load-bearing and it is where this audit lands.

---

## 1. WHAT I RE-DERIVED RATHER THAN READ

Every number below was produced by me at HEAD, not copied from a receipt.

### 1.1 The no-hand-written-lanes proof, by derivation

I re-emitted each app from its compiler golden through each lane's **real `emit()` +
`formatEmitted()`**, in a scratchpad script that writes nothing into the tree, and
compared to the bytes on disk.

| lane | S10 (control) | S11 | S12 |
|---|---|---|---|
| react | IDENTICAL | IDENTICAL | IDENTICAL |
| solid | IDENTICAL | IDENTICAL | IDENTICAL |
| qwik | IDENTICAL | IDENTICAL | IDENTICAL |
| svelte | — | IDENTICAL | IDENTICAL |
| vue | — | IDENTICAL | IDENTICAL |
| angular | **IDENTICAL** (the control emits) | **REFUSED** | **REFUSED** |

Angular's S10 emitting identically is the control that matters: it proves the two
refusals are a *scenario-specific ban*, not "angular is unwired".

Separately, every demo copy's sha256 **equals its lane's `generated/` digest** for both
apps, all five emitting lanes — so the browsable sites are the emitter's bytes, not a
hand-edited fork. **No per-lane app code was hand-written. Certified by derivation.**

Both sources are **one module with one exported component**:
`s11-todomvc-advanced.tsrx` (490 lines) and `s12-codex-clone.tsrx` (408 lines,
`export function CodexClone`), each importing only `@markless/core`.

### 1.2 Both angular refusals, reproduced verbatim off the real modules

Not inherited from the probe, not from the receipts — thrown at me by `emit()`:

```
S11: Angular emitter cannot resolve the identifier "Promise" in a transplanted body: it is
neither a body-local binding, a function parameter, a @for variable, nor a declared
component member (active, allDone, completed, draft, editDraft, editing, filter, next,
onTrace, query, remainingLabel, remoteHits, remoteLabel, remoteStatus, remoteTerm,
searching, serverFails, shown, shownLabel, syncNote, todos).
```
```
S12: Angular emitter cannot resolve the identifier "Promise" in a transplanted body: ...
(blocked, bottomTab, draft, messages, nextMessage, nextThread, onTrace, openThread,
openTitle, rightTab, status, streaming, threads, turns, turnsLabel, visible, visibleLabel).
```

**S12's list is S12's own 17 members — I counted them.** That is what proves the message
was read off this module and not carried over from S11, and it matches
`packages/frameworks/angular/test/unbuilt-scenarios.ts` exactly. That file drives **every
declared unbuilt scenario through the real `emit()`** and asserts it throws with the
recorded substring, **plus an `s10` control that must NOT throw** — so the subtraction is
asserted, not a skip list. This is a *stronger* durability guarantee than a `DEFECTS.md`
entry.

### 1.3 Part 3, all five commands re-run by me at HEAD

| command | my result | verdict |
|---|---|---|
| `pnpm check` | **267** `error TS` lines | **did NOT rise** ✓ |
| `pnpm test` | **1 failed / 1281 passed**, the failure being `packages/compiler/test/package-inventory.test.ts > ARM B`, whose diff is a `@markless/core` peer-suffix split — **caused by the owner's uncommitted lockfile, foreign** | **exactly one** ✓ |
| `pnpm e2e` | `[e2e] PASS` … `Three-way: 6 demos x 9 scenarios, all observations equal` | **stayed 6 × 9** ✓ |
| `pnpm lint` | 0 warnings, 0 errors, 479 files | clean ✓ |
| `pnpm check:citations` | clean over 4 documents, 17 watched sources, 547 swept | clean ✓ |

`git status --short` after all five: **only the owner's three in-flight paths**
(`pnpm-lock.yaml`, `pnpm-workspace.yaml`, `website/`). Nothing I ran moved a tracked byte.

**PART 3 IS FULLY CERTIFIED.**

---

## 2. THE ERROR IN THE BRIEF — AND IT WAS THE LOAD-BEARING ONE

The dispatch instructed: *"Angular ships neither app; Vue ships S11 misbehaving and S12
stream-throwing. **Verify each has a verbatim refusal recorded, read off the real
module.**"*

**Vue has no refusal, needs none, and demanding one misreads this board's own oracle.**
`oracle.signal` (1) names **three** legitimate verdicts — "emits /
refuses-with-verbatim-message / **emits-but-misbehaves**" — and `signal` (2) requires a
verbatim refusal only for "a lane that **cannot be generated**". Vue **is** generated:
`S11.vue` and `S12.vue` exist, I re-derived both byte-identically, and both ship to
`demos/vue-official/src/emitted/`. Its correct record is the third verdict with observed
behaviour, and that is what the board carries: `TypeError: _ctx.Promise is not a
constructor`, captured with the lane driven alone (T006 §5.2), mechanism located in
`@vue/shared`'s `GLOBALS_ALLOWED`.

Applying the brief literally would have rejected this board on a condition the oracle does
not impose. **The reject condition "a lane is missing WITHOUT a verbatim refusal" has
exactly one subject on this board: angular. It is satisfied, twice, verified by me.**

**A second, smaller brief error:** the dispatch lists "solid's finding-002 textarea
instance" among findings *"unfiled in `docs/DEFECTS.md`"*. **finding-002 IS filed** —
`docs/DEFECTS.md` §5, *"Emitted Solid uses `attr:value`, which solid-js's types reject —
`findings-002` — **upstream**"*, with a note at
`docs/goals/frameless-testing-ci-v1/notes/findings-002-solid-attr-namespace.md`. What is
unrecorded is the **new instance** (first non-`<input>`, reproducing as
`TextareaHTMLAttributes<HTMLTextAreaElement>`), which is an addition to an existing entry,
not an unfiled finding. T006's own blocker states this accurately; the brief overstates it.

---

## 3. THE REFUTED FIGURE STILL STANDING IN `goal.md` — FOUND BY MEASUREMENT

`goal.md` line 96, under **Non-negotiable constraints**:

> **Sort the digests, not the paths.** Expected `f326d314` / `aeb7edc1` / `f936e169`,
> 116 files.

I measured all five readings of `website/` at HEAD:

| method | value |
|---|---|
| sort the whole `shasum` **output lines** | **`f936e169`** ← the value `goal.md` itself states |
| sort the bare **digest** column ("sort the digests") | `feddd40b` |
| sort the **paths** | `b1dd182a` |
| sort paths, hash lines in that order | `b1dd182a` |
| no sort | `559a8b8e` (nondeterministic) |

**`goal.md` instructs a method that cannot produce the value `goal.md` expects.** "Sort
the digests" returns `feddd40b`. T004 measured this and the PM confirmed it
independently; `state.yaml`'s `checks.dirty_fingerprint` and T006's card were corrected to
*"SORT THE WHOLE shasum OUTPUT LINES (not the paths: b1dd182a; not the bare digest column:
feddd40b)"*. **`goal.md` — the editable charter a successor reads first — was not.**

This is not cosmetic. It is a live trap that has already fired twice on this board: T005
hit the paths reading and caught itself; T004 hit the digest-column reading and corrected
the standing instruction. The charter still points the next worker at one of the two wrong
readings. **This is precisely the class the T999 card names: "one audit found a refuted
figure still standing in `goal.md` after I had reported every site corrected."**

*(Two further staleness sites in `goal.md` are **not** blockers because §Rulings is
explicitly headed "measured — these override anything above them" and does correct them:
line 42's "T002 ruled TodoMVC Advanced ships in FIVE" is superseded by line 55's "**It is
four**", and lines 14–16's four-construct surface count is superseded by line 50's
`@try`/`@pending`/`@catch`. Line 96 is **not** under that override — it is in a different
section and it is the operative instruction.)*

---

## 4. THE FIVE ITEMS THE CARD ASKED ME TO WEIGH HONESTLY

### 4.1 A `blocked` T004 in the chain — **compatible with completion**

T004 stopped at `stop_if #1` **before any product edit**: its only `changed_files` entry is
its own note, and `git diff --exit-code -- packages/ demos/ scripts/` returned 0. Its entire
objective was re-dispatched as T006 with the one dropped file
(`packages/frameworks/vue/src/gate/index.ts`) restored, and T006 is `done` with that
objective met. A `blocked` card leaves an open obligation only if its scope is unmet;
T004's is met.

More than that, **T004's block is load-bearing evidence, not dead weight**. It probed
rather than predicted, enumerated the full blast radius (16 failed / 1213 passed across 9
files), proved the probe in both directions, and banked three dispatch corrections T006
consumed. Deleting or re-marking it would destroy the record of why the vue gate's
corpus-derived census exists. **It should stay `blocked`.**

### 4.2 T006 declining T005's byte-identical claim — **honest narrowing, not a gap**

The oracle asks that each app **"LOOKS LIKE ITS REFERENCE"**. It nowhere asks that the
five lanes be pixel-identical **to each other** — that was T005's bonus on a text-light
page, not an oracle clause. T006 declined the inherited phrasing and then did more work
than the claim would have required: proved rendering is deterministic per lane (0 differing
across repeat runs, so the cross-lane delta is real not noise), showed **every flat-fill
region 0-differing across all five** (rail interior, thread background, composer interior,
both pane bodies), showed every colour and every geometry number equal, and confined the
residual to glyph/arc rasterisation between the SSR-express trio and the Vite-dev pair.
**Refusing to repeat a phrase you cannot support, and bounding what you can, is the
behaviour this project keeps having to learn.** It strengthens the receipt.

*Recorded for a successor, not held against this board:* T006 flagged that the cause of the
trio/pair rasterisation split is **measured but unexplained**, and there is a mild tension
with T005's single-image claim for S11 at 900×900 that nobody has reconciled.

### 4.3 The `6 × 9` contract — **the oracle forbids joining it, it does not require it**

`oracle.signal` (3) reads **"pnpm e2e stays 6 x 9"**. `scripts/e2e.mjs:84` pins
`threeWayScenarios = ['s1','s2',…,'s9']`. **Adding S11/S12 would make it 6 × 11 and
*violate* part 3.** Browsable-only is what this oracle demands, not a shortfall — and both
T003's and T006's cards state it as scope ("`scripts/e2e.mjs` is NOT in scope"), matching
the sequencing S10 already took. Part 2 asks for a launch command per lane, not e2e
membership. **The driven browser walkthrough is the right instrument. Satisfied.**

**The honest cost, for the successor:** cross-lane behavioural equality for S10/S11/S12 is
therefore **not under witness**, and the playwright harnesses that produced the
walkthroughs live in worker scratchpads — both T005 and T006 record "nothing was added to
the repository". So those observations are **not re-runnable by me or by CI**. That is a
real durability gap. It is not an oracle violation, and it is the natural first card of a
successor board.

### 4.4 Angular / vue lane records — **verified, see §1.2 and §2**

Angular: two verbatim refusals, reproduced by me off the real modules, asserted in CI
through the real `emit()` with a passing control. Vue: emits in both apps, ships in both,
`emits-but-misbehaves` on the async axis only — the oracle's own third verdict, not a
refusal. **No lane is missing without a verbatim refusal.**

### 4.5 Unfiled findings — **do not block; they belong to a successor**

None of the three oracle parts requires a `DEFECTS.md` entry. And the two reproduced
findings are **already durably recorded in the product tree**, where they will fail loudly
if they change: angular's global-identifier ban in `test/unbuilt-scenarios.ts` (asserted
through the real `emit()`, with an `s10` control) and in five `regenerate.ts` headers;
vue's template-expression global limit in `packages/frameworks/vue/scripts/regenerate.ts`
and in both fixtures. `docs/DEFECTS.md` carries no entry for either
(`grep` for "global-identifier", "cannot resolve the identifier", "GLOBALS_ALLOWED",
"_ctx.Promise" → **none**), and react's post-`await` const-SSA divergence is unfiled **and
now unexercised** (S12 avoids it by construction). **Filing card, successor board.** The
precedent is this project's own: entries 15 and 8.1 were filed by a dedicated card.

---

## 5. WHAT ACTUALLY FAILS: ONE NAMED CLAUSE OF PART 2, FOR ONE APP

`oracle.signal` (2) requires, per app, **"a documented and ACTUALLY-RUN launch command per
lane."**

**TodoMVC Advanced satisfies both halves.** `notes/T003-todomvc-advanced.md` §5 is headed
*"Launch commands — ACTUALLY RUN, and the ports actually used"* and carries a six-row
table: command, lane and URL, including angular's `/todomvc-advanced` **404** — the
absence documented rather than omitted.

**The Codex clone satisfies only the "ACTUALLY-RUN" half.** `notes/T006-codex-clone.md`
has **no launch-command table and no URL anywhere**. Its entire record is one §8 row —
*"5 sites launched and driven (chromium, ports 5321–5325)"* — plus a ports paragraph.
I grepped the note for `launch`, `localhost`, `URL`, `port `, `pnpm dev`, `PORT=`,
`vite --port`, `node server` and `5321`–`5325`: the only hits are those two places. **Not
one lane's command, and not the `/codex` route, is written down.** Nor is it recoverable
from the repo: no README, no `scripts/demo.mjs` entry, no doc mentions `/codex` at all.

That the servers really ran is well attested (ports chosen clear of T003's and T005's,
checked free, stopped by recorded PID after `ps`/`lsof`, `pkill -f` never used). **The
missing half is "documented", and the oracle says THREE PARTS, ALL REQUIRED.** The app
this board called its hardest deliverable currently has no written way to open it.

**Related, and worth one honest sentence rather than a reject:** neither app was compared
against a **live** rendering of its named reference. T002 had no web tool and substituted
vendored upstream bytes with recorded provenance (`todomvc-app-css@2.4.3`, MIT, tarball
URL) — it said so in its own `missing_evidence`. T006 hit seven geometry targets the PM
measured off the live reference and vendored the shadcn default theme with commit
`6a070bf8…` and `theming.mdx` sha256 `403a71fe…`, correctly avoiding
`apps/v4/app/globals.css`. Both are **real comparisons against named references with
strong provenance**, both asserted off the rendered image, both mutation-tested (13/13 and
10/10). **This clause is met.** The proxy chain is recorded so nobody later mistakes it for
a side-by-side.

---

## 6. RULING

| oracle part | verdict |
|---|---|
| **(1) THE DOOR IS MEASURED** | **CERTIFIED.** Six lanes, witnessed per-lane, landed before any app. Closed in all six by a pincer upstream of every emitter; angular's `EMITS` refuted to `MISBEHAVES` by a deliberate red. Three confounds caught by non-async controls. |
| **(2) AUTHORED ONCE, EMITTED SIX WAYS, LOOKS LIKE ITS REFERENCE** | **CERTIFIED EXCEPT ONE CLAUSE.** No hand-written per-lane code — proved by my own derivation, not by assertion. Both apps one source. Angular's two refusals verbatim off the real modules. Visual comparison against a named reference for both. **S12 has no documented launch command per lane.** |
| **(3) NOTHING REGRESSES** | **CERTIFIED.** check 267, test exactly 1 (foreign ARM B), e2e 6 × 9 PASS, lint clean, citations clean — all re-run by me at HEAD. |

**`not_complete` / `full_outcome_complete: false`**, on two doc-only defects, both in files
already on this board's surface, both of the exact class this card exists to catch. This
board did the hard work well and should not be asked to redo any of it — the remaining
work is one small card.

**This is emphatically not a "manufacture a partial demo to look complete" situation.** The
capability list is real, the refusals are real, and **the Codex clone did not refuse** — it
ships in five lanes and runs completely in four, including a stream that keeps landing
while the app is navigated. What the app lost is the keyboard, and that loss is authored
into the source rather than faked. That is a strong outcome.

### Next task — T007 (worker, small, doc-only)

1. `docs/goals/frameless-app-suite-v1/goal.md` — replace "**Sort the digests, not the
   paths.**" with the measured method, naming **both** wrong readings:
   *sort the whole `shasum` output lines; not the paths (`b1dd182a`), not the bare digest
   column (`feddd40b`)*. The expected values `f326d314` / `aeb7edc1` / `f936e169` and 116
   files stay.
2. `docs/goals/frameless-app-suite-v1/notes/T006-codex-clone.md` — add a per-lane launch
   table in T003 §5's shape: command actually run, lane, `/codex` URL, and angular's **404
   / no route** recorded as an absence. Reconstruct from the demo `dev` scripts (each now
   runs `copy-shadcn-theme`) and **re-run each one to confirm before writing it down** —
   a command written from memory is exactly what the card's "REJECT if any launch command
   was not actually run" forbids.

### For a successor board, not for T007

- File the two lane limits in `docs/DEFECTS.md` (angular global-identifier ban; vue
  template-expression global limit), add the new textarea instance to
  `notes/findings-002-solid-attr-namespace.md`, and decide react's post-`await` const-SSA
  divergence relative to 12.2's recorded v-limit.
- Land the S10/S11/S12 browser walkthroughs as a re-runnable harness in the repo, or state
  plainly that those observations are one-shot and not under CI.
- Explain the SSR-express / Vite-dev glyph rasterisation split T006 measured but could not
  account for, and reconcile it with T005's single-image claim for S11.
