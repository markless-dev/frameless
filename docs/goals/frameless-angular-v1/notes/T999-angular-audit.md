# T999 — Angular lane final audit

**Verdict: COMPLETE. `full_outcome_complete: true`, scoped to `a6bd400`.**

Read-only audit. Nothing was implemented, staged or installed. Per the command restriction (a
Worker is concurrently landing S7 across all six lanes) this audit ran **no** `pnpm e2e`, no
`pnpm test:browser`, no `pnpm mutate:corpus` and no build in `demos/angular-official`. It inherits
the PM's verified state at `a6bd400` for those, and independently re-derives the *underlying facts*
those suites rest on, by direct probe and by reading the tree at `a6bd400`.

---

## 1. The oracle, checked against the artifact rather than the receipt

> `pnpm e2e` includes an Angular row driving an official Angular scaffold at the pinned lockfile
> version, and its S1/S2/S3 observations are **ASSERTED** equal to `demos/react-official`,
> `demos/solid-official`, `demos/qwik` **AND** `demos/svelte-official` under the same matrix.

**ASSERTED, not merely reported.** `scripts/e2e.mjs` builds `threeWay[framework].observed[scenario]`
from each lane's own recorded note, then for every scenario `JSON.stringify`s the reference lane's
observation array and compares it string-wise against every other lane, pushing a divergence and
`process.exit(1)`. The `angular` row is one of the six `officialDemos` entries and is inside that
loop. The row drives `demos/angular-official`, which is the `ng new --ssr` scaffold at
`@angular/cli` 22.0.8, served by **the scaffold's own** `dist/angular-official/server/server.mjs`.
The oracle is over-satisfied: it asks for S1/S2/S3 and the matrix now carries **six** scenarios
(`threeWayScenarios = ['s1'…'s6']`), so the Angular row is asserted equal on 6 scenarios × 5 peer
lanes.

**Secondary oracle** — the decorator-vs-signal question re-run with G1 and G5 recorded against a
real build — discharged by T005 (G1 measured by AOT-compiling the shipped `generated/S1.ts`
byte-for-byte beside a signal twin; G5 measured on two limbs) and folded by T008 into worked
example 11. See §5.

---

## 2. Reject-if constraints, each checked mechanically

| Constraint | Result | Evidence |
|---|---|---|
| Angular row must **ASSERT** equality | PASS | `scripts/e2e.mjs` cross-lane `JSON.stringify` compare + `exit(1)`; angular is in `officialDemos` |
| No activation-neutrality check weakened | PASS | `git show d1ad075 -- demos/react-official/three-way-contract.ts`, non-comment lines only: **four** added lines total — `'angular'` into the hydrate union, `angular: '<script src="main.js" type="module"></script>'`, `angular: 0`. No existing literal moved; neither total `Record` relaxed to a pattern, range or optional field |
| Emitter must not ship source never activated in a browser | PASS | `copy-emitted` copies **all six** goldens verbatim (`S1→RenderOnce … S6→WhitespaceBoard`); all six are routed in `src/app/app.routes.ts`; the box visits all six paths |
| Lowered handler members byte-stable across regeneration | PASS | `test/emitter.test.ts` asserts every golden `is byte-identical to a fresh emission`, with a calibration arm for the comparison itself; names are keyed on `(hostNodeId, eventName)` (ruling 3b), never a counter or index; the collision path **throws** and is calibrated with a *planted* duplicate (`refuses the lowered method name onH2Input` / `onH4Click`), since the corpus has zero natural instances. T008 and T011 each re-ran `regenerate` twice with `git diff --exit-code` clean |
| No fix landed without a witnessed prior failure | PASS | Every T004 deviation cites its own prior measurement: `noImplicitAny:false` after measuring **exactly six** TS7006 on the untouched scaffold; `NG_ALLOWED_HOSTS` after measuring 400 for `localhost`, `127.0.0.1` and an arbitrary host; the child-process server after measuring platform-server replacing `globalThis.Event`; `MISMATCH_PATH` moved to a query after measuring the path form rendering an empty `<router-outlet>` |

---

## 3. One spot-check per task. Five prior rulings on this board rested on wrong reasons, so nothing
was taken on the receipt's word.

**T004 — R1.** Not accepted as a one-off browser measurement: it is a **standing per-run
assertion**. `assertS3` calls `measureServedAttribute({ served, marker: 'data-action="text"',
name: 'value', equals: 'hello' })`, which reads the **server's own bytes**, asserts the exact
string, and runs **two** negative arms on every call (payload-wide deletion and a *scoped* deletion
from the marked element's start tag), each with its own vacuity guard. `generated/S3.ts` still
spells `[value]="text"` and `[checked]="checked"` — nothing was repaired to `[attr.value]`.
So R1 is not "measured once in July"; a regression in Angular's property→attribute reflection
turns the lane red.

**T005 — G6 FAIL and the sole enforcement point.** Probed `@angular-eslint/eslint-plugin@22.1.0`
directly: `rules['prefer-signals'].meta.docs` is `{description, url}` with **no `recommended`
field**. Of 50 TS rules, 12 carry the flag and `prefer-signals` is not among them. The claim that
upstream keeps it in `all` and the derived applied set is therefore silent is **confirmed**, and
`packages/frameworks/angular/src/gate/index.ts:1050` carries the frameless-owned
`no-signal-members` refusal with the ruling, the deciding gate and both measured limbs named in
the violation message.

**T007 — the refuted mechanism.** Confirmed both refuting facts directly:
`demos/angular-official/package.json` declares `jsdom ^28.0.0` and `prettier ^3.8.1` as its **own**
`ng new` scaffold devDependencies, and `@angular/compiler-cli@22.0.8`'s `dependencies.chokidar` is
`^5.0.0` — a caret, not an exact pin. Vendored exactness is not the cause; workspace membership is.
Separately confirmed the fact ruling 1 required be asserted: `@angular/build`'s `dependencies.vite`
is `7.3.6` (with `esbuild 0.28.1`, `sass 1.99.0`).

**T010 — the peer-atom count, re-derived by a third parser.** Wrote an independent depth-counting
reader over `pnpm-lock.yaml`'s `snapshots:` keys. First attempt returned **68** and disagreed with
the recorded 66 — and the cause was *my* parser, which overwrote the base name on multi-suffix keys
like `X(a)(b)`. That is the same class of bug T007's throwaway probe carried, one variant over,
which is a small live demonstration that the instrument earns its keep. Corrected reader:
**67 atoms = the recorded 66 plus the single opaque hash `81eb5ac4e8e5156d9ca3bd08c6ca184b`**, which
`package-inventory.test.ts` deliberately asserts separately as `['@angular/build']`. Set difference
against the shipped `PEER_ATOMS` literal is **empty in both directions**. `jsdom@28.1.0` is present,
i.e. the nested-atom regression is really fixed. T010's refutation of T007's headline number stands
on a third independent measurement.

**T009 / T011 — the counts and the metadata.** Counted the control-flow blocks in the goldens
myself: S1 `@if`×1, S2 `@if`×1 `@for`×1, S3 none, S4 `@if`×1 `@for`×2, S5 `@if`×1 `@for`×1, S6
`@for`×1 — **9 blocks across 5 of 6 goldens at `a6bd400`**, and **zero** `*ngIf`/`*ngFor` anywhere.
That reproduces T011's reconciliation exactly (8 across 4 of 5 at `abb5e44`, plus S6's one), and it
confirms T009's correction of T005's "all three goldens emit `@if` AND `@for`", which was false in
both quantifiers. Probed `@angular-eslint/eslint-plugin-template@22.1.0`: **41** template rules,
and exactly **4** carry `meta.docs.recommended === 'recommended'` —
`banana-in-box, eqeqeq, no-negated-async, prefer-control-flow`. Byte-identical to the derived set
the gate ships.

---

## 4. The contestable Gate 6 reading on worked example 5 — RULED: **the recorded reading holds**

The two readings, both recorded in `notes/T009-control-flow.md` §6 and in the policy entry:

- **Strict.** Gate 6's preamble ("the check must exercise the target lane … and assert observable
  behavior") governs both `PASS` bullets. The emitter gate is not a scaffold check and asserts no
  observable behaviour, so example 5 is `FAIL` and `@if`/`@for` is denied.
- **Recorded.** Gate 5 explicitly *routes* non-behavioural reasons to Gate 6, "which requires them
  to be **measured**". Measurement is what Gate 6 demands of that class, and measurement is what was
  supplied.

I uphold the recorded reading, and on a ground stronger than the one the note offers.

1. **Gate 6's own `PASS` clause is disjunctive**: "such a check exists, **or the sugar's claimed
   benefit is itself asserted by one**." The second arm exists precisely for benefits that are not
   the lane's observable behaviour. Reading the preamble as annihilating the second arm makes the
   arm dead text.
2. **The document's own established practice already decided this.** Worked example 10 (Qwik, a
   conditional `SyncPolicy` → a synthesized guard) is `G6 PASS` carried **entirely** by
   non-behavioural standing checks — the `v-limits` refusal tests, two frameless-authored gate rules
   with mutant calibration, and a green-vacuum guard — and it states in terms that "there is no
   *behavioural* three-way scenario". Under the strict reading, example 10's `PASS` falls too, and
   with it an **adopted forced-lowering** ruling that is shipped in the Qwik emitter. A reading that
   retroactively invalidates a shipped adopted ruling elsewhere in the same document is the wrong
   reading.
3. **Example 5's Gate 6 evidence is strictly stronger than example 10's**, which is the part worth
   recording. Example 10's checks are frameless-authored; example 5's decisive arbiter is
   **third-party-authored and derived, not hand-picked** — upstream's own `meta.docs.recommended`
   metadata, read at the lockfile version, reporting the baseline three times by name and the
   shipped candidate zero times, with a planted `([ngModel])` drawing `banana-in-box` as
   calibration. Add the second benefit asserted by a second standing check (`@for`'s `track` is
   syntactically mandatory, pinned by the `parseTemplate` arbiter with a track-deletion mutation
   proving red) and the `BASELINE_FORM_INVENTORY` allowlist.
4. **The reductio is real and is not rhetoric.** The strict reading forces nine shipped call sites
   into `*ngIf`/`*ngFor` — a form that this lane's own applied, upstream-authored arbiter reports as
   a violation. A policy outcome that requires the emitter to emit what the policy's own arbiter
   flags is incoherent.

Two things keep this from being self-serving, and both are already in the entry: the negative result
is stated plainly (`pnpm e2e` would **not** go red on a *competent* switch to the baseline — only on
an incompetent one, via `NG8103`), and Gate 5 was measured `PASS` on node identity rather than
assumed, so the sugar is not being carried by a gate that was never exercised.

**Not a policy defect, but a documentation debt worth naming:** Gate 6's preamble sentence and its
own second `PASS` clause pull against each other, and this is now the **second** entry decided on
the disjunction (10 and 5). The fix belongs on a policy board, not this one: the preamble should say
that the *lane and version* requirement binds the behavioural arm, while a claimed benefit may be
asserted by any standing check this repo runs at the lockfile version. Recorded as a finding, not
applied.

---

## 5. Gate 6's upstream dependency — CONFIRMED PRESENT, and it is **tripwired**, which the receipts
under-claimed

T009 named it "THE SINGLE MOST FRAGILE INPUT" and T011 carried it forward as an unmitigated
dependency at three prose sites. Checked:

- **Still there.** `prefer-control-flow`'s `meta.docs.recommended === 'recommended'` at
  `@angular-eslint/eslint-plugin-template@22.1.0`, verified by direct probe today.
- **Recorded** in three places (the note, worked example 5, the `renderBranch` decision-site
  comment) — as the receipts claim.
- **And mechanically pinned, which no receipt says.** `packages/frameworks/angular/test/gate.test.ts`
  asserts `ANGULAR_ESLINT_TEMPLATE_RULES_DERIVED` **equals** the exact four-name list, and
  `ANGULAR_ESLINT_TS_RULES_DERIVED` the exact twelve, plus `41`/`50` rule totals, plus an explicit
  `not.toContain` over `prefer-signals` and three others. So if upstream **demotes**
  `prefer-control-flow` out of `recommended`, `pnpm test` goes **red by name** and worked example 5's
  deciding gate is re-opened by a failing test rather than by someone remembering a prose
  carry-forward. The symmetric direction is covered too: upstream **promoting** `prefer-signals` into
  `recommended` also goes red, which is worked example 11's re-open trigger.

This is the strongest single thing on the board and it was recorded as an unmitigated risk. Correct
the record: it is mitigated.

---

## 6. T005's `missing_evidence` — RULED **sufficient, not owed**

Two items, both recorded in the durable artifact (worked example 11) and not only in a receipt:

1. **SSR served-payload not compared between decorator and signal forms.** Not owed. The ruling is
   already `FAIL` at Gate 5 on two limbs that are *type- and reactivity-level* and hold by
   construction (the exported member type changes `any → InputSignal<any>`; a `computed()` over
   `instance.derived` diverges from the rendered DOM under one form and not the other). A served-
   payload difference in `ngh` annotations could only *add* a reason to a denial. It cannot flip a
   `FAIL` to a `PASS`, and the entry says so in those words while forbidding the green from being
   read as a served-payload claim. The direction of the error, if any, is the conservative one:
   the policy itself records that a fabricated `PASS` is the more damaging of the two errors.
2. **Probes ran in jsdom, not Chromium.** Accepted with the caveat as written. The compile was a
   **real AOT build** of the shipped golden byte-for-byte; jsdom supplied the DOM, not a framework
   substitute, and T009's probe was independently calibrated against T005's published `kit:2 →
   kit:10` result and reproduced it exactly. The entry carries the standing instruction — if
   challenged, **re-run in Chromium rather than defend jsdom**. That is the right disposition for a
   deny.

Both would be owed if either ruling were an **adoption** resting on the unmeasured site. Neither is.

---

## 7. IR-8 — CONFIRMED carried forward as a limitation, not quietly closed

The hole is real and visible in the shipped artifact: `generated/S3.ts` emits `@Input() initial:
any;` and `@Input() onTrace: any;`. A real `ng build` on the untouched scaffold reports **exactly
six** TS7006 diagnostics, all in `src/emitted/KeyedTodo.ts`, all lambda parameters in transplanted
handler bodies. It is recorded in four places, each of which a different reader would hit first:

- `demos/angular-official/tsconfig.app.json` — the `noImplicitAny: false` delta with the measurement,
  the scope (consumed entirely by emitted output), the citation of this repo's own standing ruling
  (`packages/frameworks/react/test/emitted-typecheck.test.ts:14-16`, "deliberate scope, not laxity"),
  and an explicit statement of **what is not relaxed**: `strictNullChecks` and Angular's
  `strictTemplates` both stay on, so all fifteen lowered call sites and every `@for` `track`
  expression are still type-checked.
- `packages/frameworks/angular/README.md` — a section headed *"Everything is `: any`, and that is
  IR-8 recorded, not closed"*, including why `event: Event` is refused (the real DOM type would make
  `event.currentTarget.value` a type error, so emitting it would be the emitter inventing a type to
  look better-typed than it is).
- The board, via T002 ruling 5, which named the re-derivation count and routed it upward.
- **The umbrella board owns it**: `frameless-defects-and-targets-v1` carries IR-8 as a first-class
  item across four lanes and scopes an emitter capability phase (T032) with *"IR-8 typed props
  COMES FIRST and is the gate on the rest"*. Composition was overturned as the first Phase F landing
  *because* IR-8 makes it a population with no signal.

Not closed, not quietly anything. The relaxation is correctly scoped and the coverage it does buy
(`strictTemplates` over the lowered call sites) is exactly the coverage T001/T002 said Angular adds.

---

## 8. Limitations this certificate does **not** cover, stated so a green is not over-read

- **Dev configuration only.** The Angular box is `modes: ['dev']` and `build:e2e` runs
  `ng build --configuration development`. AOT and template type-checking do run on every e2e pass —
  which retires T002's dissent that T003 shipped goldens no Angular type checker had seen — but
  optimization and `outputHashing: "all"` do not. The `production` config was run once, green, at
  T004. `pnpm e2e` pinning dev mode is a **repo-wide** standing limitation recorded in `goal.md`, not
  an Angular regression. Note that `servedClientEntry`'s Angular literal is a property of the
  development configuration and the contract says so.
- **The chokidar 4→5 major move** that arrived with this lane is benign *for the measured suites
  only* — four browser lanes and six e2e rows, none of which exercises a file watcher or a storage
  backend. markless's watch/storage paths remain unmeasured. That is T007's recorded scope and it is
  not this board's outcome.
- **This certificate is scoped to `a6bd400`.** A Worker is concurrently landing S7 across all six
  lanes. S7 belongs to the umbrella board's Phase F, which owns cross-lane corpus breadth for every
  lane; closing this board orphans nothing. If the Angular row diverges on S7, that is a Phase F
  finding against the corpus, not a reopening of this goal's oracle.
- **`packages/frameworks/angular/generated` is outside every tsconfig in the package**, by design —
  it imports `@angular/core` and the Angular package is deliberately node-only so the two Vites
  never meet in one package. Its type-check is `ng build` in the demo, which now runs on every e2e
  pass. Recorded because a reader comparing lanes will notice Angular has no
  `emitted-typecheck.test.ts` and should know why.

---

## 9. Board hygiene

All tasks T001–T011 are `done`; no queued required Worker blocks completion; `remaining_blockers` is
empty on every receipt; no `stopped_because`. The two contended folds (T008 behind Vue T006, T011
ahead of Vue T010) were serialized on independently-reached reasoning and both held — T008's fold
extended Vue's Gate 1 discharge list without overwriting it, and T011's example-4 replacement
preserved the heading and the ruling word `no-sugar` verbatim so the queued Vue 12a/12b citation
still resolves. Verified in the policy at `a6bd400`: heading 4 reads `no-sugar`, heading 5 reads
`sugar`.

---

## 10. Findings handed back

1. **Gate 6's preamble contradicts its own second `PASS` clause.** Two entries (10 and 5) are now
   decided on the disjunction. A policy-board edit is owed; it is not this board's to make.
2. **The "single most fragile input" is already tripwired** by `gate.test.ts`'s exact-set assertion.
   Three prose carry-forwards describe it as unmitigated. Correct the record rather than build a
   second instrument.
3. **A depth-counting parser is easy to get wrong in a second, different way** — this audit's own
   independent reader overwrote the base name on multi-suffix keys and read 68 before it read 67.
   The shipped inventory pins the *first* variant of that bug by name; it does not pin this one.
   Cheap follow-up for whoever next touches that file, not a defect today.
