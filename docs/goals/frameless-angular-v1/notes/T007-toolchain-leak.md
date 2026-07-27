# T007 — the dependency leak that runs the other way

**Board:** `docs/goals/frameless-angular-v1/state.yaml`
**Task:** T007 (judge)
**Date:** 2026-07-27
**Ruling:** **ASSERT IT.** Not acceptable as-is. `pnpm.overrides` REFUSED, on grounds different
from T002's.
**T002 ruling 1:** decision **STANDS**; its reasoning is **materially wrong in one sentence** and
its cost list is framed wrongly, not merely short by one entry.

---

## 0. The headline, before anything else

**The stated mechanism is refuted by measurement.** The T007 brief and the T004 finding both say
the leak happens because `@angular/build` declares `esbuild` and `sass` as **exact** dependencies,
and that *the same exactness* that makes Angular immune to the catalog is what lets it override
optional peers elsewhere. That is an elegant symmetry and it is **not what happened.**

Measured causes of the six moved optional peers:

| moved peer | before | after | actual cause | exact pin? |
|---|---|---|---|---|
| `esbuild` | 0.27.7 | 0.28.1 | `@angular/build` dep `esbuild: 0.28.1` | **yes** |
| `sass` | *(unresolved)* | 1.99.0 | `@angular/build` dep `sass: 1.99.0` | **yes** |
| `jsdom` | *(unresolved)* | 28.1.0 | `demos/angular-official/package.json` devDep `jsdom: ^28.0.0` — the **ng-new scaffold's own default** | **no, caret** |
| `prettier` | *(unresolved)* | 3.9.6 | `demos/angular-official/package.json` devDep `prettier: ^3.8.1` — **scaffold default** | **no, caret** |
| `chokidar` | 4.0.3 | **5.0.0** | `@angular/compiler-cli` dep `chokidar: ^5.0.0` | **no, caret** |
| `lru-cache` | *(unresolved)* | 11.5.2 | Angular closure | **no** |

**Four of six arrived on ordinary caret ranges, and two of those are the scaffold's own
`devDependencies`, not `@angular/build`'s vendored anything.** Exactness is not the mechanism.
The mechanism is **workspace membership**: in a pnpm workspace, any member's dependency closure
becomes a candidate provider for every other member's *unsatisfied optional peers*. A lane that
declared `vite: catalog:` and vendored nothing at all would have done the same thing with `jsdom`
and `prettier`.

This matters for the ruling because a mitigation reasoned from "exact pins leak" would be aimed at
`@angular/build` and would miss four of the six. It also matters for the next lane: **this is not
an Angular property.** Angular is simply the first member whose closure was large enough
(+3918 lockfile lines) to make the effect visible to a human reading a diff.

---

## 1. What actually moved — independently measured, not inherited

Method: `git show HEAD:pnpm-lock.yaml` vs the working tree, parsing the `snapshots:` section and
comparing, per package name, the **set of peer-suffix keys**. Script preserved at
`scratchpad/peerdiff.mjs` during the ruling; the result is reproducible from the lockfile alone.

### 1.1 Twenty-five packages changed peer-resolution identity

Not two. The full list:

```
@async/witness@0.7.0                       ← the e2e instrument itself
@markless/bundler   @markless/core   @markless/router   ← the owner's own vendored product
@qwik.dev/core (both variants)   @qwik.dev/router
@sveltejs/adapter-auto   @sveltejs/kit   @sveltejs/vite-plugin-svelte
@vitejs/plugin-react   @vitejs/plugin-vue   vite-plugin-solid
@vitest/browser   @vitest/browser-playwright   @vitest/mocker   vitest
@voidzero-dev/vite-plus-core   @voidzero-dev/vite-plus-test   vite-plus
nitro   unstorage   vite-imagetools   vitefu
vite@7.3.1 (Qwik's vendored)   vite@8.0.16 (the catalog's)
```

That set contains **every lane on the board** — react, solid, svelte, vue, qwik — plus the
instrument that measures them and the vendored `@markless/*` product this repo is a front door
for. The T004 finding named "react, solid, vue and every vitest browser lane"; svelte, qwik,
witness and markless were also in it.

### 1.2 The workspace peer-atom inventory moved by six entries

Distinct peer atoms appearing in lockfile snapshot keys: **46 after, 40 before.**
Replacements: `esbuild 0.27.7 → 0.28.1`, `chokidar 4.0.3 → 5.0.0`.
Additions reaching other lanes: `sass@1.99.0`, `prettier@3.9.6`, `lru-cache@11.5.2`,
`jsdom@28.1.0`.
(The remaining additions — `@angular/compiler`, `ajv`, `css-tree`, `express@5.2.1`, `hono`,
`listr2`, `rxjs`, `zod@4.4.2` — are Angular-internal and reach nothing else.)

The single largest item is one nobody named: **`chokidar` crossed a MAJOR version boundary,
4 → 5**, for `unstorage`, `nitro`, `@markless/core` and `@markless/router`. `chokidar@4.0.3` is
no longer resolved as a peer *anywhere* in the workspace.

### 1.3 Every move is inside the declaring package's own accepted range

Measured off the installed manifests, not from documentation:

| consumer | declared optional peer range | resolved | inside? |
|---|---|---|---|
| `vite@8.0.16` | `esbuild: ^0.27.0 \|\| ^0.28.0` | 0.28.1 | yes |
| `vite@8.0.16` | `sass: ^1.70.0` | 1.99.0 | yes |
| `vite@7.3.6` (Angular's) | `sass: ^1.70.0` | — | n/a |
| `vitest@4.1.5` | `jsdom: *` | 28.1.0 | yes |
| `@voidzero-dev/vite-plus-test@0.1.20` | `jsdom: *` | 28.1.0 | yes |
| `@qwik.dev/core@2.0.0-beta.38` | `prettier: *` | 3.9.6 | yes |
| `unstorage@2.0.0-alpha.7` | `chokidar: ^4 \|\| ^5` | 5.0.0 | yes |
| `unstorage@2.0.0-alpha.7` | `lru-cache: ^11.2.6` | 11.5.2 | yes |

**Not one lane is running a combination its own author declined to sanction.** `@markless/core`
and `@markless/router` carry no peer declarations of their own; their suffix change is
`unstorage`'s bubbling upward.

This table is the load-bearing fact for §3.

### 1.4 The substitution is live, not nominal

`require.resolve('vite/package.json')` from the repo root lands in
`node_modules/.pnpm/vite@8.0.16_@types+node@24.12.2_esbuild@0.28.1_sass@1.99.0_yaml@2.9.0/`, whose
`node_modules/` contains `esbuild` **and** `sass`, and whose `vite/dist/node/index.js` references
esbuild. The old `vite@8.0.16_..._esbuild@0.27.7_yaml@2.9.0` directory still exists on disk but
nothing resolves through it. `esbuild@0.27.7` survives in the lockfile only as Qwik's
`vite@7.3.1`'s own hard dependency.

---

## 2. Does T002 ruling 1 stand?

**The decision stands. The reasoning does not, and appending a fourth cost would preserve the
error rather than fix it.**

### 2.1 What is correct and should not be reopened

- `@angular/build@22.0.8` really does declare `vite: 7.3.6` exact; the catalog really cannot pin
  the Angular toolchain even in principle. `toolchain.test.ts` asserts this and its assertions are
  all still true.
- Accepting a vendored Vite because "a vendored Vite is what official Angular tooling IS" was and
  remains right. Blocking on it would have been blocking on the scaffold being official.
- Refusing to force the *Angular lane* onto catalog Vite was right, for the reason given: it
  replaces the Vite version Angular tested against with one it did not.

### 2.2 The sentence that is false

> "there is no shared surface to pin, so the catalog is not violated, it is INAPPLICABLE"

There **is** a shared surface. It is not the `vite` version — it is the **workspace optional-peer
graph**, and the catalog governs consumers hanging off it. The catalog is inapplicable *to the
Angular lane*; the ruling then treated that as *isolation*, and it is not isolation. It is one-way
permeability, and the ruling checked only the impermeable direction.

The same overreach is written into the shipped mitigation. `toolchain.test.ts:35-41`:

> "that structural separation is what GUARANTEES Vite 7 and Vite 8 never meet in one package"

True as literally written, and it is cited as the **structural discharge** of ruling 1. It
discharges only the vite-meets-vite hazard. It says nothing about the Angular lane supplying
`esbuild`, `sass`, `jsdom`, `prettier`, `chokidar` and `lru-cache` into peer slots the other five
lanes leave open — which is what happened, in the same install, in the same package that carries
the comment.

### 2.3 Why "a fourth cost" is the wrong repair to the record

Costs (a), (b) and (c) all have the same polarity: *the catalog fails to reach Angular.* A fourth
entry of the opposite polarity does not belong on that list; it is a second, differently-framed
list. Bolting it on invites exactly the reading that produced this gap — "the isolation ruling had
three costs, now four, still an isolation ruling."

**The frame to record instead:** the Angular lane is *exempt from* the catalog **and is a provider
into** the peer graph the catalog governs. Two relationships, opposite directions, one of which
ruling 1 examined.

### 2.4 The recurrence, which is the actual lesson

This board's standing lesson is *measure, never inherit*, and its recorded failure mode is the
Option D chain: **the same inference error recurring while each pass corrected the previous one's
wording.** It just recurred again, one layer up, twice in a row on the same phenomenon:

1. **T002** enumerated three costs of the Angular/catalog divergence and missed the direction it
   had not looked in.
2. **T004** found the missed direction, and under-scoped it by the same factor — it named two
   moved peers of six, twenty-five affected packages as "react, solid, vue and every vitest
   browser lane", and attributed all of it to exact pins when four of six arrived on carets and
   two are the scaffold's own `devDependencies`.

Both readers were careful and both were reading a **diff**, by eye. That is the finding under the
finding: **the detection method does not scale and did not scale here.** A 3918-line lockfile diff
is not an instrument. The next lane's diff will be read less carefully than this one was, because
this one was read under a live suspicion.

---

## 3. Why NOT `pnpm.overrides` — and why T002's stated reason does not apply here

`pnpm.overrides` is the obvious repair and a future reader will reach for it, so this is recorded
with its refusal grounds rather than by citation.

**First, T002's reason does not transfer.** T002 refused overrides because forcing the Angular
lane onto catalog Vite "replaces the version Angular tested against with one it did not." That
reason is **inapplicable** to the repair being contemplated here: an override pinning *root Vite
8's* `esbuild` back to 0.27.7 does not touch the Angular lane at all — Angular's `vite@7.3.6`
carries `esbuild` as a **hard dependency**, not a peer, so no override on the peer slot reaches
it. Inheriting T002's refusal here would be inheriting a measurement taken on a different
question. It is refused anyway, on three fresh grounds.

Note also that `pnpm.overrides` is **not** a novel mechanism in this repo — root `package.json`
lines 38-49 already carry nine entries. The refusal is not squeamishness about the tool.

**(a) Every move is inside the sanctioned range (§1.3).** Overriding back to `esbuild@0.27.7`
pins the workspace to one point inside a range Vite itself declares compatible, on no evidence
that the other point is worse. That is second-guessing an upstream compatibility statement from
inference — the precise error class this board just *avoided* when T004 refused to "repair"
`[value]` to `[attr.value]` and the browser measurement proved the inference would have been
wrong. Doing it here would be regressing to the habit on the same board.

**(b) The override set would itself become the silent thing.** The leak set is six packages across
two Vite majors and four unrelated consumers. A hand-maintained override table pinning all six
would need to be revisited on every upstream bump, and an override that quietly rots — silently
holding a lane on a version its consumer has dropped support for — is strictly worse than a
resolution that quietly moves, because it is invisible *and* actively wrong. The overrides block
would need its own tripwire, which is the instrument we are specifying anyway, minus the risk.

**(c) It buys nothing measured and costs real risk.** The measured blast radius is green
(§4). Reverting a green, author-sanctioned resolution to satisfy a preference for isolation buys
an aesthetic and costs a hand-pinned `esbuild` that Vite 8 will eventually stop accepting.

**Refused, and the refusal is on the record with its reasons.**

---

## 4. Is "benign" established? Mostly — with one named hole

The PM's measurement is real and sufficient for what it covers: `pnpm test:browser` byte-identical
on all four lanes (react 60, solid 49, svelte 13, vue 18) and the six-row `pnpm e2e` green with all
18 observation strings byte-identical. I did not re-run either, per the T007 constraint and because
a Vue Worker is live on this tree.

**The hole:** those suites exercise the *build and activation* paths. **Nothing in them exercises a
file watcher or a storage backend**, which is exactly what moved a MAJOR version — `chokidar`
4 → 5 under `unstorage`, `nitro`, `@markless/core` and `@markless/router`. `packages/core/src/index.ts:28`
re-exports from `@markless/core`, and `packages/core/test/authoring-surface.test.ts` loads it, so
"it still imports" is established. "Its watch/storage paths still behave" is **not established, and
was not measured.**

This does **not** change the ruling, for two reasons: `chokidar@5.0.0` is inside `unstorage`'s own
declared `^4 || ^5`, and this repo exercises none of those paths in any proven surface. But
"benign" must be recorded with its scope — **established for four browser lanes and six e2e rows;
unestablished for markless's watch and storage paths** — or a later reader will inherit an
unqualified green. That scope is the re-open trigger in §6.

Related, and worth keeping: T004's own receipt records that `pnpm test:browser` was **missing from
its verify list** and that the PM added it. The one suite that could have caught this was the one
the card omitted. That is the same class of gap as the ruling itself: the check that covers the
direction nobody was looking in is the check that gets left off the list.

---

## 5. The ruling: ASSERT IT, and assert the SET, not the versions

### 5.1 Why not "acceptable as-is"

The question set by the card is whether a silent cross-lane toolchain move is acceptable
**unasserted**. It is not, and the disqualifying fact is not that it broke something — it is that
**there is no instrument at all**, and this board's own standing rule is that an instrument which
cannot fail is not an instrument. Here there is not even one that cannot fail. Detection was a
human reading a diff, and that human under-scoped it by a factor of three (§2.4).

T002 invented the asserted-toolchain-fact mitigation for cost (c) — "an `@angular/build` patch can
move Vite under the lane with no file in this repo changing." The event that actually occurred is
strictly worse than cost (c): a change **in this repo** moved the toolchain under **five other
lanes**, and the mitigation built for the weaker hazard was green throughout.

### 5.2 The design constraint that decides the instrument's shape

**The existing `toolchain.test.ts` would not have caught this, and neither would any test built the
same way.** It asserts version *literals* for names it already knows: vite 7.3.6, vite 8.0.16,
Angular 22.0.8, TypeScript 5.9.3 / 6.0.3. Every one of those assertions was **correct and green**
through the entire event.

The failure was **an unlisted NAME appearing**, not a listed version being wrong. `sass`, `jsdom`,
`prettier` and `lru-cache` went from *unresolved* to *resolved*, and no equality-against-a-literal
can see a name it was never given.

> **An inventory instrument must assert the SET, not the members.**

This is the same discipline the board already calls "baseline form inventory", applied where it was
not applied. It also generalises the lesson of §2.4 correctly: both under-scopings were failures to
enumerate, not failures to compare.

### 5.3 What the instrument asserts

A **workspace peer-resolution inventory** over `pnpm-lock.yaml`, with two arms:

- **Arm A — completeness.** The set of distinct `name@version` peer atoms appearing in the
  lockfile's `snapshots:` keys equals a recorded, sorted list. (Currently 46 entries; parsing must
  handle nesting — `jsdom@28.1.0(@noble/hashes@2.2.0)` is one atom with a nested one inside it, and
  a naive innermost-parens match reads it as `@noble/hashes` and misses `jsdom` entirely. That bug
  is live in the ruling's own throwaway probe and is called out so the Worker does not reproduce
  it.) **This is the arm that goes red on the event that happened.**
- **Arm B — identity of the shared consumers.** For a declared list of packages that more than one
  lane depends on, the full peer-suffix key equals a recorded literal. Arm A misses a pure version
  move that adds no name (a future lane bringing `esbuild@0.29.0` and nothing else); Arm B catches
  it and localises *which consumer* moved.
- **Calibration, two-sided**, in the file, per instrument rule 3: a planted extra atom must fail,
  a planted missing atom must fail, and the reader must be proven to return a non-empty set on a
  healthy lockfile — an inventory that silently parses to `[]` compares nothing and passes forever.

### 5.4 On "it will go red on every legitimate upstream bump"

The card's warning is the right worry and it does not land here, for one structural reason:
**`pnpm-lock.yaml` is committed, and the instrument reads the lockfile.** A recorded literal can
therefore only go red in a commit that already moves `pnpm-lock.yaml`. The red is never
spontaneous; it is exactly coincident with the moment a human is already changing dependencies and
should be looking.

The failure mode that produces deletable noise is an assertion that fires **with no repo change** —
which is cost (c)'s shape, and is why `toolchain.test.ts` reads resolved `node_modules` rather than
the lockfile. This instrument deliberately reads the **lockfile**, so it inherits the lockfile's
change discipline instead of the filesystem's.

The maintenance contract, which must be written in the file or it will be deleted: *if this goes
red and the suites are green, update the recorded list **in the same commit that moved the
lockfile**, and name in the commit message which member caused it.* The red is the notification,
not the defect.

### 5.5 Where it lives — and why not in `toolchain.test.ts`

**Not** `packages/frameworks/angular/test/toolchain.test.ts`. The invariant is not Angular's. It is
the workspace's, and scoping it to the Angular package guarantees the next lane's author never
finds it — which is the same scoping error as §2.3.

**`packages/compiler/test/package-inventory.test.ts`**, as a third `describe` block. That file
already carries `describe('workspace byte invariants')` — the LF/CRLF guard — and already wrote
down this exact placement decision in its own words at lines 65-69:

> "This lives here rather than in a framework package because the invariant is the workspace's,
> not any one package's, and this file already reads from the workspace root."

The precedent is this repo's own, it is one file away from the thing being added, and the LF guard's
shape (loud named failure, explicit precondition assertion, two-sided calibration block) is the
shape to copy. It is inside the node project's `packages/*/test/**/*.test.ts` glob, so it runs under
`pnpm test` with no config change.

`toolchain.test.ts` gets a **comment-only** correction to the §2.2 overreach at lines 35-41, and a
pointer to the new inventory. **No assertion in it changes** — all six of its tests are still true
and still worth keeping.

---

## 6. What should make this go red, and where the tripwire lives

**Tripwire:** `packages/compiler/test/package-inventory.test.ts`, `describe('workspace peer-resolution inventory')`.

**Must go red on:**
1. A new workspace member (or a new dependency of an existing one) supplying an optional peer that
   another lane's toolchain previously left unresolved. ← **the event that happened; Arm A.**
2. Any version change to a peer atom already in the inventory. ← Arm A.
3. Any change to the peer-suffix key of a declared shared consumer (`vite@8`, `vite@7.3.1`,
   `vitest`, `vite-plus`, `@vitest/browser-playwright`, `@qwik.dev/core`, `@markless/core`,
   `unstorage`, `@async/witness`). ← Arm B, localises the cause.
4. A peer atom disappearing — a lane removal restoring a slot to unresolved is equally a
   cross-lane toolchain move.

**Must NOT go red on:** anything confined to the Angular lane's own vendored toolchain — that is
`toolchain.test.ts`'s job and the two must not overlap or one will be maintained and the other
rotted.

**Re-open trigger for the `benign` verdict (§4):** if anything in this repo ever starts exercising
`@markless/core` / `@markless/router` watch or storage paths, or `nitro`/`unstorage` at runtime,
the `chokidar 4 → 5` major move becomes **unmeasured behaviour on a live path** and owes a
measurement. Until then it is unexercised, and that is recorded as scope, not as proof.

**Explicitly refused and recorded so it is not re-derived:** `pnpm.overrides` entries for
`esbuild`, `sass`, `jsdom`, `prettier`, `chokidar` or `lru-cache` (§3).

---

## 7. Dissent

- **The inventory is a proxy for the thing that matters.** What we care about is *behaviour under a
  changed toolchain*; what we are asserting is *that the toolchain changed*. That is precisely the
  proxy-for-measurement fault this board has recorded against itself four times. It is accepted
  here **only** because the alternative — proving behavioural equivalence across a toolchain
  substitution — is not a test, it is a research programme, and because an inventory red routes to
  a human who can then measure. But it should be written down as a **notification**, not as a
  **verdict**, and the file must say so or someone will read a green as "the toolchain is fine."
- **46 recorded atoms is a real maintenance surface**, and the honest risk is that the first
  routine `pnpm update` produces a 15-line literal diff and the next person deletes the block. §5.4's
  maintenance contract is the mitigation and it is a social one, not a technical one. If the block
  is found deleted in six months, the correct reading is that Arm A was too wide, and the fallback
  is Arm B alone over the nine shared consumers.
- **This ruling did not re-run the suites**, per constraint. The `benign` verdict is inherited from
  the PM's measurement — which is exactly the "measure, never inherit" posture this board forbids.
  It is accepted because the PM's measurement was taken on this exact tree and is recorded with its
  numbers, and because the tree is currently in motion under a live Vue Worker. But if any part of
  this ruling is later found wrong, **that inheritance is the first place to look.**
- **I am not certain Arm B's nine-package list is the right cut.** It was chosen as "packages more
  than one lane depends on", which is a judgement, and a judgement inside an instrument is the
  thing ruling 3a on this same board refused to allow inside an emitter. The difference is that this
  list is *declared and re-read*, not *computed from content* — but the analogy is close enough to
  flag.
