# T038 — Ruling on the S6 cross-lane whitespace divergence

Judge, 2026-07-27. Board: `docs/goals/frameless-defects-and-targets-v1/state.yaml`.
Tree read at `8af8ed1` (`git show` for the two files a live Vue Worker holds).
Input: `notes/T027-corpus-s6-whitespace.md` §4, §4.4 — authoritative.

---

## 0. The ruling, in four lines

1. **Repair: (b) GATE — refuse the construct, at the compiler, fail-closed.**
   Not (a) normalise. Not (c) accept-and-document alone.
2. **T027's decision to keep the divergent construct out of the shipped fixture:
   RATIFIED**, and the ruling upgrades it from "defensible" to "required".
3. **The Solid gate's missing whitespace policy: a DEFECT — of the recorded-reason
   kind, not the missing-predicate kind.** Solid is measurably the *most*
   aggressive of the six, not the safest.
4. **Yes, it belongs in the defects half's ledger** (`docs/DEFECTS.md`), as the
   only currently-open defect in frameless's own shipped output. It does **not**
   extend half 1's oracle.

Everything below was re-derived at this tree. Nothing is inherited from the T027
note or from the T038 card, and **two things in the card's own framing are
overturned by measurement** (§2, §5).

---

## 1. What I re-measured, and what changed

The card says MEASURE, NEVER INHERIT and warns that five rulings this session
rested on wrong reasons, one of them planted by the PM's own brief. So the
finding was re-derived from the compilers, not read off T027.

**The T027 finding reproduces exactly.** Probing each lane's own compiler on
`one  two three` (two literal U+0020):

```
react    react-dom 19.2.3 renderToStaticMarkup   -> "one  two three"   PRESERVE
svelte   svelte 5.56.8 compile generate:server   -> "one  two three"   PRESERVE
                       and generate:client       -> "one  two three"   PRESERVE
solid    babel-preset-solid 1.9.12 generate:ssr  -> "one two three"    CONDENSE
                                  generate:dom   -> "one two three"    CONDENSE
vue      @vue/compiler-sfc 3.5.40 parse+compile  -> "one two three"    CONDENSE
angular  @angular/compiler 22.0.8 parseTemplate  -> "one two three"    CONDENSE
```

3–3, confirmed. Qwik was not re-probed: `@qwik.dev/core` 2.0.0-beta.38 no longer
exports a callable `transformModulesSync` from `./optimizer`, and building the
lane is out of bounds while a Worker is live. Qwik's PRESERVE row rests on T027's
end-to-end browser measurement, which is a *stronger* instrument than a compiler
probe, so the row stands — but it is recorded here as measured differently from
the other five.

**Then three things turned up that T027 did not have, and each one moves the
ruling.**

### 1.1 The finding is bigger than a run of two spaces. Solid rewrites character identity.

Probing Solid with inputs built by `String.fromCharCode` so nothing depends on
what a shell put in a heredoc:

```
                 IN                   OUT
nbsp   x1   one U+00A0 two   ->   one U+0020 two     CHARACTER CHANGED
nbsp   x2   one U+00A0 U+00A0 two -> one U+0020 two
thin   x1   one U+2009 two   ->   one U+0020 two
ideo   x1   one U+3000 two   ->   one U+0020 two
figure x1   one U+2007 two   ->   one U+0020 two
zwsp   x1   one U+200B two   ->   one U+200B two     (not whitespace; survives)
```

The same five inputs through the other four probeable lanes:

| construct | react | svelte | vue | angular | solid |
| --- | --- | --- | --- | --- | --- |
| `a  b` (U+0020 ×2) | preserve | preserve | **condense** | **condense** | **condense** |
| `a b` (one NBSP) | preserve | preserve | preserve | preserve | **→ U+0020** |
| `a  b` | preserve | preserve | preserve | preserve | **→ one U+0020** |
| `a b` (thin space) | preserve | preserve | preserve | preserve | **→ U+0020** |

Two consequences, and they are the load-bearing ones in this whole document.

**First: on non-ASCII whitespace the split is 5–1, not 3–3, and Solid is alone.**
A *single* non-breaking space — one character, no run — comes out of Solid as an
ordinary space. That is not condensing. That is substituting a different
character with different semantics: U+00A0 is non-breaking and U+0020 is not, so
the author's line-break guarantee is silently deleted. Vue and Angular, the two
lanes that *do* condense space runs, both preserve NBSP byte-for-byte.

**Second: this is what kills option (a).** More on that in §3.

### 1.2 The compiler's existing tab handling does not sit where the card assumes. It manufactures the defect.

The card's constraint 4 says the compiler already normalises tabs and newlines,
and asks whether interior space runs are the same *kind* of thing — because if
they are, a compiler-level gate is "arguably where the existing behaviour already
lives".

**The layer conclusion is right. The kinship claim is backwards.** Read at
`packages/compiler/src/build.ts:2890`:

```js
function normalizeJsxText(value: string): string {
	const lines = value.replace(/\r/g, '').split('\n');
	let result = '';
	for (let index = 0; index < lines.length; index++) {
		let line = lines[index]!.replace(/\t/g, ' ');      // <-- one space PER tab
		...
```

`\t` → `' '` is a **1:1 character map**, not a condense. Measured through
`buildEnrichedIr` at this tree:

```
"two  spaces"   -> "two  spaces"     space run: VERBATIM
"a   b"         -> "a   b"           at any length
"tab\there"     -> "tab here"        one tab  -> one space
"tab\t\there"   -> "tab  here"       two tabs -> TWO spaces
"one\t\ttwo"    -> "one  two"        <-- THE DIVERGENT CONSTRUCT, MANUFACTURED
"x\ny"          -> "x y"             newline  -> one space
```

So the existing compiler behaviour is not a precedent for condensing. It is a
**second authoring path into the defect**: type two tabs between two words and
the compiler hands three lanes a construct they will each rewrite differently.
This also means the tab/newline sub-axis T027 §2 retired as "unreachable" is only
half retired — the *characters* are unreachable downstream, but their *product*
is exactly the reachable construct.

It strengthens the compiler as the placement, for a reason opposite to the one
the card offered: the compiler must be repaired not because it already does this
kind of thing, but because it is one of the two things producing the input.

### 1.3 The two gates are structurally blind, not merely narrow.

T027 §4.3 says both policies reduce to `content !== content.trim() || content.length === 0`,
which guards edges. True. But the deeper fact is that **widening that predicate
would not work**, because of what the gates are reading:

- `packages/frameworks/vue/src/gate/index.ts:809` calls `parse(source, { filename })`
  and walks `descriptor.template.ast` — which the file's own comment says is
  *already condensed*. Measured: `<p>one  two three</p>` reaches the predicate as
  `"one two three"`.
- `packages/frameworks/angular/src/gate/index.ts:473` calls
  `parseTemplate(template, ...)` under Angular's `preserveWhitespaces: false`
  default. Measured: same input reaches the predicate as `"one two three"`;
  re-parsing with `preserveWhitespaces: true` yields `"one  two three"`.

The run is destroyed *before the predicate sees it*. Any repair at those two
gates therefore requires a **second parse with preserve options**, kept separate
from the existing policy — which is defined deliberately as a property of the
condensed result. That is real cost, and it is duplicated per lane, and two of the
six lanes have no template parser to hang it on at all. It is an argument for
stating the rule once, upstream of all six.

### 1.4 Scope boundaries, measured rather than assumed

- **Attribute values are NOT affected.** `<p title="a  b">` reaches Angular's AST
  as `"a  b"`, Vue's as `"a  b"`, and Solid's template string as `title="a  b"`.
  All three condensing lanes preserve interior runs in attributes. The refusal
  correctly scopes to static *text nodes*.
- **Interpolated whitespace is preserved by all six, and it is already an
  asserted, green, six-lane claim.** `demos/react-official/three-way-contract.ts`
  asserts `[ wide  load ]` and `[  wide  load  ]` — interior double spaces
  carried as data — equal across six lanes, and the PM verified `pnpm e2e` 6×6
  all-equal at this commit. This is not a hypothetical escape hatch; the corpus
  is already proving it.
- **The proposed rule fires on nothing that exists.** Compiling every live
  `.tsrx` in `demos/`, `packages/` and `poc/` (60 files, 3 pre-existing unrelated
  compile errors, **108 static text nodes**): interior-rule violations = **0**.
- **But the edge half of the same rule would break two live demos.** The same
  scan with an edge predicate finds 4: `" open"` in `demos/ui-kit/src/TaskList.tsrx`
  and `demos/ssr/src/TaskList.tsrx`, `" seats"` in the two `PricingCard.tsrx`.
  Those are React/Solid-only demos predating the six-lane work. **Edges are out of
  scope for this repair** and are already guarded downstream in the two lanes that
  cannot express them.

---

## 2. The three repairs, weighed, with the cost of each named

### (a) NORMALISE — make the preserving emitters collapse interior runs

**Cost 1, the one the card names: it destroys author intent in three lanes.**
Today react, qwik and svelte render the author's exact characters. Normalisation
would silently rewrite them. The intent is not decorative: it is observable in
`<pre>`, under `white-space: pre` / `pre-wrap` / `break-spaces`, in every
`textContent` assertion — including the corpus's own witness boxes, which is how
this finding was detected in the first place. An emitter that rewrites the
author's characters to hide a lane difference makes the emitter the source of
behaviour the author did not write, which inverts the product's entire claim.

**Cost 2, and it is disqualifying, and it is new at §1.1: "make them agree" means
"normalise down to Solid's floor."** Agreement on space runs is not agreement. To
make all six agree on the *whitespace* question you must also settle NBSP, thin
space and every other Unicode space — and there Solid is alone against five. The
only uniform rule that yields six-way agreement is Solid's: `/\s+/g → ' '`. That
would require **five** lanes to start destroying non-breaking spaces they
currently honour, to match the one lane that does. A repair whose end state is
"delete the semantics of U+00A0 across the entire product so the matrix looks
tidy" is not a repair.

**Cost 3: it destroys the instrument at the root.** The seductive form of (a) is
not six emitter edits — it is one line in `normalizeJsxText`, `\s+ → ' '`,
which makes the matrix green with no error, no message and nothing to explain.
Name it explicitly because it is the version a reader will reach for. It is the
worst of the three: once the compiler erases the characters, **no lane can ever
again be measured against the author's source**, and the divergence becomes
permanently undetectable rather than merely unreported. That is the
finding-into-silence move in its purest form.

**Rejected.** The destroyed intent is real, observable, and would have to be
destroyed in five lanes rather than three to actually work.

### (b) GATE — refuse the construct at the compiler, fail-closed

**Cost 1: expressiveness.** A construct legal in plain React/JSX becomes illegal
in `.tsrx`. That is a genuine reduction and should be stated as one, not
euphemised.

**Cost 2: bounded by a measured, already-proven alternative.** The whitespace
remains fully expressible — carried as data (§1.4), which all six lanes preserve
verbatim and which the shipped e2e contract already asserts equal across six.
The refusal removes the *unportable spelling* of the capability, not the
capability. The error message can name the portable spelling in one line, and it
must **not** suggest `&nbsp;`/` `, which Solid rewrites (§1.1).

**Cost 3: risk of breaking existing code — measured at zero.** 108 static text
nodes across every live `.tsrx`, 0 interior violations. It cannot be used to make
anything green (nothing is currently red), which satisfies the additions-only
direction this board holds gates to.

**Cost 4: it must be calibrated or it is theatre.** A rule that fires on nothing
today is exactly the instrument this board's own doctrine says cannot be trusted
without a two-sided proof. A planted violation going red is mandatory.

**Chosen.** It is the honest position for this product: a construct with no
neutral meaning across the six activations is refused, at the authoring surface,
with the measurement in the message. This is the same shape as the Qwik `sync$`
throw that T031's card already calls "a v-limit being enforced, not a defect to
work around", and the same shape as `escapeText`'s existing throw in the Angular
emitter. It is fail-closed, reversible, and the refusal text *is* the permanent
record of the finding — which is the precise opposite of silence.

### (c) ACCEPT AND DOCUMENT — record it, ship it, move on

**Cost: it leaves a reachable, silent non-neutrality in a product whose only
claim is neutrality, with no instrument.** The next author who types two spaces —
or two tabs (§1.2) — gets three renderings and zero signal, having passed
`pnpm check`, `pnpm lint`, six gates and a green e2e. Worse, `pnpm e2e`'s
headline, "6 demos × 6 scenarios, all observations equal", would remain true and
would remain *misleading*: it would be a proxy asserting neutrality while a
reachable construct is not neutral. `docs/DEFECTS.md`'s own §"The shape all of
them share" indicts exactly this — an instrument whose silent precondition makes
its green meaningless.

**Rejected as the whole repair — but adopted as a component.** (b) without
documentation is a mystery error. The refusal must land *with* a ledger entry and
the measured matrix, so the constraint is explained rather than merely enforced.

**Ruling: (b), carrying (c)'s documentation. Explicitly not (a), in any of its
forms, including the one-line compiler condense.**

### Is a space run "the same kind of thing" as the tab/newline normalisation?

**No — and the card's suggested inference should not be drawn.** Measured
(§1.2): the compiler's tab handling is a 1:1 character map that *produces* space
runs, and its newline handling is a line-join. Neither is a condense; neither is
precedent for one. The compiler is nonetheless the right layer, for a different
and stronger reason: it is the single place that sees the shared input to all six
lanes, it already owns text normalisation, it closes both authoring paths
(literal spaces and tab runs) with one rule, and it is the only layer where the
rule can be stated once instead of six times — where, as §4 shows, one of the six
has already forgotten it.

---

## 3. T027's call: RATIFIED

T027 kept `one  two three` out of the shipped fixture. Ratified, on three
grounds, the third of which was not available to T027.

**1. A permanently-red cell is worse than a recorded finding.** Phase F's
stopping rule requires each scenario in all six lanes. Shipping the construct
makes S6 permanently red in three, which does not produce "a scenario that
records a finding" — it produces a broken matrix whose red is expected, and a red
that is expected is a red nobody reads. That is the same failure mode as a
`continue-on-error` flag, which this board's own oracle refuses in writing, and
it would degrade the signal for every future scenario, not just S6.

**2. The finding was not converted into silence, which is the only objection that
matters.** It is measured end to end in six real browser lanes, reproducible in
one command per lane, mechanism-named per lane, argued at length in a note rather
than a receipt line, and routed to a ruling that produces a repair. Omission is
silence only when there is no record. Here the record is the reason this document
exists.

**3. The decisive ground, which T027 could not reach: the ruling makes the
omission not merely acceptable but required.** T027's call was conditional on
what T038 decided, and it left that conditional open. Under ruling (b) the
construct becomes **inexpressible** — the compiler refuses it. A corpus scenario
asserting a construct the compiler rejects would be incoherent; the fixture could
not compile. So shipping it was never a live option, and the correct home for a
refused construct is a **refusal test**, not an e2e scenario. That is where the
Worker package puts it.

What S6 asserts is therefore right as landed: it proves the four whitespace
claims that *are* neutral across six lanes, and the non-neutral one is proven
non-neutral by a negative test in the compiler package. Two instruments, each
asserting what it can actually assert.

---

## 4. The Solid gate's missing whitespace policy: DEFECT

**Defect. And "Solid's divergence is upstream" is not available as a defence,
because the repo already rejected that reasoning twice.**

Vue's `whitespace: 'condense'` and Angular's `preserveWhitespaces: false` are
*also* upstream defaults, documented by their own frameworks, and both lanes
still carry a written, dossier-referenced, measured policy. Solid's
`babel-plugin-jsx-dom-expressions` normalisation is upstream in exactly the same
sense and to exactly the same degree. `grep -c whitespace` = **0** in both
`packages/frameworks/solid/src/gate/index.ts` and `custom-policies.ts` — verified
at `8af8ed1`. The asymmetry has no stated reason, and an omission with no stated
reason is precisely what T029 exists to repair in the Qwik gate. The same
standard applies here.

The card asks whether Solid is safe by analogy to React. **It is the opposite of
safe.** Measured at §1.1, Solid is the most aggressive of the six: alone among
them it rewrites the *identity* of every Unicode whitespace character to U+0020.
The lane a reader would assume behaves like React is the lane with the widest
rewrite and the only one with no instrument.

**But the repair is not a Solid gate predicate.** Adding a bespoke whitespace
policy to the Solid gate — and then, by symmetry, to react, qwik and svelte —
is the six-lanes-re-derive-one-rule trap, and it would be four more chances to
get it wrong for a rule the compiler now enforces once for all six. Ruled **not
required**, so a later Worker does not churn on it.

**What is required is the recorded reason.** The Solid gate gains the same
dossier-style measurement its Vue and Angular siblings carry: what Solid rewrites
(the §1.1 matrix), that no gate-level predicate is needed because the construct
is refused upstream at the compiler, and a pointer to the compiler rule. That
converts an unexplained silence into a recorded one, which is the standard the
Angular derived-set precedent set and the standard T029 is enforcing elsewhere on
this board.

---

## 5. Does it belong in the defects half's ledger? Plainly: yes — with a boundary

**Yes.** It is a defect in **frameless's own shipped code**, not upstream and not
a test artefact:

- We emit a construct into six lanes without checking it survives all six.
- The gate layer's whitespace policies read as though they protect cross-lane
  render equality — the Vue violation message says in so many words "so this text
  would render differently from the react, solid, qwik and svelte lanes" — while
  measurably not covering the case. That claim is correct for the *edge* case the
  policy guards (verified: Solid preserves `<p> a </p>` verbatim, so the message's
  lane grouping is accurate there), which is what makes the gap easy to miss: the
  policy is right about what it says and silent about what it implies.
- The reachable path is one keystroke, or two tab characters.

The card's fairness caution — a finding that reproduces on a stock scaffold with
none of our code is evidence the *test* is unfair — was weighed and **does not
apply**. Each lane's behaviour is its own framework's documented default and none
of them is being called broken. The defect claimed is ours: shipping one IR into
six activations without asserting the construct is neutral across them. Nothing
here should be filed upstream, against Solid or anyone else.

**The boundary.** It belongs in `docs/DEFECTS.md` as a new numbered entry. It
does **not** extend half 1's oracle, which is defined over the six named defects;
redefining the oracle mid-goal to include findings the goal itself produced makes
the goal uncloseable by construction. The precedent is T029, which was created
under the Operator Escalation rule as a Worker task without being folded into the
oracle. Same treatment.

Note for T999: at present, entries 3, 4 and 6 are test-suite defects, 5 is
upstream, 2 is not a defect, and 1 is closed. **This would be the only open
defect in frameless's own emitted output**, and T999 must state its status
explicitly rather than let it pass unmentioned.

---

## 6. The repair, specified

**Rule (the predicate).** A static IR text node value is portable iff every
whitespace character in it is U+0020 and no two whitespace characters are
adjacent. Reject when `/\s\s/.test(v) || /[^\S ]/.test(v)`. Text-node **edges**
are explicitly out of scope (§1.4: the edge half breaks four live demo texts, and
is already guarded downstream in the two lanes that cannot express it).

**Placement.** `packages/compiler/src/build.ts`, at the site where the text node
value is finalised (`:870`, immediately after `normalizeJsxText`), so the throw
carries the source file and the offending value. Fail-closed, matching the
existing precedent of the Angular emitter's `escapeText` throw and the Qwik
`sync$` v-limit.

**The message must** name the offending value, state that three of six lanes
rewrite it, and point at the portable spelling — whitespace carried as an
interpolated value. It must **not** suggest `&nbsp;` or ` `; Solid rewrites
those to U+0020 (§1.1).

**Calibration is mandatory.** The rule fires on nothing that exists (0/108).
Without a planted violation proving it red, it is an instrument that cannot fail.

**Not required, ruled explicitly so nobody churns on it:** whitespace predicates
in the six gates; any change to emitted output; any change to the two existing
edge policies; any change to `normalizeJsxText`'s tab/newline mapping (it is
now covered — a tab run produces a space run, which the new rule rejects).

**The lift trigger** — the ruling is (b), not (c), so this is when the v-limit may
be *removed* rather than when a documented divergence is re-opened. Lift the
refusal when, at pinned versions, all six lanes are measured to render an
interior whitespace run byte-identically — in practice, when
`babel-plugin-jsx-dom-expressions`, `@vue/compiler-sfc` and `@angular/compiler`
all stop condensing, or the three preserving lanes are shown to have changed. The
registered cross-lane matrix test is what will notice: if any lane's behaviour
moves at a version bump, that test goes red and this ruling is re-opened on
evidence rather than on memory. **Re-open on any single lane moving, in either
direction** — a lane that starts preserving is as much a change to the ruling's
basis as one that starts condensing.

---

## 7. What this ruling does not know

Recorded rather than glossed, because an unstated assumption is what
`docs/DEFECTS.md` says produced four false findings.

1. **Qwik's behaviour on non-ASCII whitespace is UNMEASURED.** Its space-run
   PRESERVE row rests on T027's browser measurement, which is sound. Its NBSP row
   is absent: `@qwik.dev/core` 2.0.0-beta.38 exposes no callable transform on the
   `./optimizer` subpath, and building the lane was out of bounds with a Worker
   live. The Worker must fill this cell.
2. **`pnpm e2e`, `pnpm test:browser` and `pnpm mutate:corpus` were not run** by
   this ruling — a Vue Worker holds the tree. The 6×6 all-equal and 36/36 red
   figures are the PM's, at this commit, and are relied on rather than re-derived.
3. **Solid's rewrite was probed through `babel-preset-solid` at `generate:'ssr'`
   and `generate:'dom'`**, both condensing. The demo lane's exact plugin
   configuration was not re-derived; T027's browser measurement covers it for the
   space-run case.

---

## 8. Reproducing this document

```sh
git show 8af8ed1:packages/frameworks/vue/src/gate/index.ts     | sed -n '860,885p'
git show 8af8ed1:packages/frameworks/angular/src/gate/index.ts | sed -n '950,975p'
sed -n '2890,2904p' packages/compiler/src/build.ts
git show 8af8ed1:packages/frameworks/solid/src/gate/index.ts | grep -c -i whitespace   # 0
```

Per-lane compiler probes: run `node` from each `packages/frameworks/<lane>`
directory with a `createRequire` on that directory, building every input with
`String.fromCharCode` and printing code points, never raw strings — a heredoc
will silently normalise U+00A0 and that would have inverted §1.1.

The corpus scan compiles every live `.tsrx` under `demos/`, `packages/` and
`poc/` through `buildEnrichedIr`, collects every `{ kind: 'text' }` value, and
applies the two predicates separately: interior = 0, edge = 4.
