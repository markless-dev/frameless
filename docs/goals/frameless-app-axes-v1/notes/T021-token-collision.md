# T021 — the `--accent` / `--border` collision, closed at its declaring block

**Board:** `docs/goals/frameless-app-axes-v1/state.yaml` · **base:** `992ac9f` ·
**ruling:** T019's receipt on the board · **result:** done, one verification round.

---

## 0. THE ONE SENTENCE T999 NEEDS

**HEAD IS NOW IN THE "CLOSED AT ITS CAUSE" STATE, AND IT WAS NEVER IN THE "LIVE
DEFECT" STATE.** Before this card the collision was **LATENT**: `tokens.css`
already won in every lane, on every page, in dev **and — measured here for the
first time — in a production build**, and the unmutated pixel diff was 0
everywhere. T013's `13498 / 27301 / 37698 / 7303` were, and remain, **the price
of an order flip that has not happened.** What changed is that the outcome no
longer depends on the order at all: forced scaffold-last now reads **0 in all
twenty-four cells**, in both OS colour-scheme arms.

So: **this card is hardening, not a repair.** A visual defect was not fixed here,
because there was not one. A race was removed.

---

## 1. THE CHANGE

`demos/shared/copy-shadcn-theme.mjs`, inside `deriveTokens()`, two emitted
selector strings:

```
:root {                 ->  :root:root {
.dark {                 ->  :root.dark, :root .dark {
```

Both `(0,2,0)`. Raised **equally**, so the file's own `:root` → `.dark`
source-order precedence survives untouched. **No value, no declaration and no
upstream byte moves.**

```
$ git diff -U0 -- '*shadcn-theme/tokens.css' | grep -E '^[+-]' | grep -v '^[+-][+-][+-]' | sort | uniq -c
   6 +:root.dark, :root .dark {
   6 +:root:root {
   6 -.dark {
   6 -:root {

$ git diff --stat -- '*shadcn-theme/tokens.css'
 6 files changed, 12 insertions(+), 12 deletions(-)

$ git diff --exit-code -- demos/shared/shadcn-theme/theming-default.css
 (exit 0)
```

Six copies × exactly two selector lines each. **Zero declaration lines.**
`theming-default.css` — the verbatim upstream MIT bytes — is untouched, and so
are all three create-vite scaffold sheets.

---

## 2. THE INSTRUMENT, AND WHY IT IS NOT ASLEEP

T013's first harness reported twenty zeros and measured nothing. Four guards,
each of which had to hold before any mutated cell was read:

1. **THE CONTROL READS 0 FIRST, PER CELL.** Every one of the 24 cells carries an
   unmutated `lane vs svelte` reading taken in the same browser context. All 24
   read 0 in both arms, before and after. `VACUOUS CELLS: 0`.
2. **THE FORCED SHEET IS ASSERTED LAST AGAINST THE WHOLE DOCUMENT**, via
   `querySelectorAll('link[rel=stylesheet], style')` — **not** against `<head>`,
   which is the assumption that made T013's first harness vacuous. Every mutated
   cell reports `sheets=4 last=true` and the harness *throws* otherwise.
3. **RAW DIFFERING PIXELS**, counted directly off two decoded PNGs — any of the
   four channels differing counts — not `pixelmatch`, whose antialiasing skip
   reports different numbers for the same images.
4. **THE `.dark` CHECK IS PROVEN ABLE TO FAIL** — §5.

The node order, read rather than assumed, is why the mutation has to land at the
end of `<body>`:

```
react  /habits (DEV)          react /habits (PRODUCTION BUILD)
 0 STYLE head  :root{--text…   0 LINK head  /assets/index-nqMpL4T3.css   <- SCAFFOLD
 1 LINK  body  tokens.css      1 LINK body  /shadcn-theme/tokens.css
 2 LINK  body  habits.css      2 LINK body  /habit-css/habits.css
```

---

## 3. THE FORCED-ORDER MATRIX — 3 LANES × 4 PAGES × 2 OS ARMS, BOTH ENDS

chromium 145.0.7632.6, 1440×1000, `deviceScaleFactor: 1`, full-page, animations
disabled. Each lane's **own** scaffold bytes forced in as the last stylesheet
node; diffed against svelte, which ships no scaffold at all.

### BEFORE (at `992ac9f`) — the board's four numbers reproduce a THIRD time

```
                  /habits   /board  /contacts  /codex     control
light  react       13498    27301     37698     7303        0
light  solid       13498    27301     37698     7303        0
light  vue         13498    27301     37698     7303        0
dark   react       13956    27870     38351     7343        0
dark   solid       13956    27870     38351     7343        0
dark   vue         13956    27870     38351     7343        0
```

Identical in all three scaffold lanes, exactly as T013 and T019 measured. The
OS-dark row is higher because the scaffold declares `--accent` and `--border` a
**second** time inside `@media (prefers-color-scheme: dark) :root`, with
different values — a third declaration site. A media query changes **matching**,
not **specificity**, which is precisely why the answer has to be a specificity
bump and not a scoping trick.

### AFTER

```
                  /habits   /board  /contacts  /codex     control
light  react/solid/vue   0        0         0        0        0
dark   react/solid/vue   0        0         0        0        0

VACUOUS CELLS: 0
```

**24 / 24 forced-order cells at 0.** T013's `"the residual IS NOT A SELECTOR"` is
false as stated: a **pure selector rewrite of the declaring block** — no value
touched, no declaration removed, no page sheet changed — closes it. The true
statement is the narrower one T019 wrote: *no rule in a page sheet can reach it.*

---

## 4. NOTHING MOVES TODAY

Unmutated captures, six lanes × every page each lane serves, BEFORE vs AFTER,
same browser build, same viewport:

```
PER-LANE CAPTURES COMPARED BEFORE vs AFTER: 44 · MOVED: 0
  of which the six lanes over the four token pages: 23 · MOVED: 0
LANE PAIRS (react vs each other serving lane): 36 · NON-ZERO: 0   [BEFORE]
LANE PAIRS                                   : 36 · NON-ZERO: 0   [AFTER]
```

Qwik's two dev-only injected elements are removed by id and the removal reported,
as T008 established.

**23, not 24**, on the six-lane × four-page cell: **angular refuses S12**, so it
serves `/habits`, `/board` and `/contacts` but not `/codex`. The card's verify
list says "SIX lanes x FOUR pages"; the honest count is 23 served cells. Nothing
is missing — a lane that refuses a page cannot be captured on it.

---

## 5. THE `.dark` ANSWER — BOTH PLACEMENTS, AND THE CHECK IS KILLED

All 31 `.dark` token names read off the served `tokens.css` and compared against
their `.dark` values, on an element inside the dark scope.

```
                     BEFORE (992ac9f)        AFTER
.dark on <html>   as-served    0/31 wrong    0/31 wrong
.dark on <html>   ROOT-ONLY   30/31 wrong   30/31 wrong   <- THE KILL
.dark on <html>   both bumped  0/31 wrong    0/31 wrong
.dark on wrapper  as-served    0/31 wrong    0/31 wrong
.dark on wrapper  ROOT-ONLY    0/31 wrong    0/31 wrong
.dark on wrapper  both bumped  0/31 wrong    0/31 wrong
```

The **ROOT-ONLY** row is the negative control the card asked for: raise the root
block strictly above the dark block and leave the dark block alone. Against the
pre-T021 bytes that is `:root` → `:root:root`; against the post-T021 bytes it is
`:root:root` → `:root:root:root`. Either way it is the same experiment, and
either way it measures a **real inversion** — `--background` resolves to
`oklch(1 0 0)`, which is verified to be *the light block's own value*. **So the
0/31 readings are not vacuous.**

And the wrapper rows are the mechanism, stated as a measurement: the inversion is
**invisible** on a wrapper, because **custom properties resolve by nearest
declaring ancestor, not by specificity.** Specificity only ever decides between
declarations on the *same* element — which is exactly the situation `<html>` puts
`:root` and `.dark` in, and exactly the situation the scaffold's `:root` and this
file's `:root` are in.

### BRIEF ERROR: it is 30 of 31, not 31 of 31

Both T019's receipt and the T021 dispatch say *"all 31 dark tokens fall back to
light"*. **Measured: 30.** The 31st is `--sidebar-primary-foreground`, which
upstream declares **identically in both blocks** (`oklch(0.985 0 0)`), so it
*does* fall back — it simply cannot show it. The cascade claim is right; the
observable count is 30. Recorded because a future card asserting 31 would fail a
correct check.

---

## 6. PRODUCTION STYLESHEET ORDER — MEASURED ONCE, RECORDED

Every prior reading on this subject (T008's, T013's, T019's) drove **dev**
servers. This is the first production reading, and it was the open
`missing_evidence` item on T019's ruling.

`pnpm --dir demos/react-official build`, served with `NODE_ENV=production`:

```
raw served HTML, /habits:
  <link rel="stylesheet" crossorigin href="/assets/index-nqMpL4T3.css">   <- the scaffold, bundled
  <link rel="stylesheet" href="/shadcn-theme/tokens.css"/>
  <link rel="stylesheet" href="/habit-css/habits.css"/>

as the browser sees it, /habits /board /contacts /codex, ALL FOUR:
  0 LINK head  /assets/index-*.css      <- SCAFFOLD, FIRST
  1 LINK body  /shadcn-theme/tokens.css
  2 LINK body  <the page sheet>
```

`/assets/index-nqMpL4T3.css` was confirmed to be the scaffold by reading its
first bytes (`:root{--text:#6b6375;…`) against `src/index.css`.

**PRODUCTION DOES NOT LAND THE SCAFFOLD LAST.** It lands it *first*, in `<head>`,
identically to dev. **So this card stays HARDENING and does not become a repair.**
The mechanism, since `frameless-supplement.css` predicted the opposite: React 19
hoists a `<link>` only when it carries a `precedence` attribute, and **none of
these links do** — `grep -o 'precedence="[^"]*"'` on the served document returns
nothing. That narrows `frameless-supplement.css`'s premise a second time without
contradicting it — the hoisting rule is real, this tree just does not trigger it.
**No configuration has yet been found in which the scaffold actually lands last.**
The forced-order arm remains a *simulation* of a flip, not an observation of one.

Order confirmed identical before and after the change; the production build also
serves the new selectors (`:root:root` at line 10, `:root.dark, :root .dark` at
line 54), which is what proves the built asset is not stale.

---

## 7. DERIVED, NOT HAND-EDITED

```
PRESENT-AFTER-DELETE:   0 (of 6)     <- asserted FIRST, so the digests below compare rebuilt files
PRESENT-AFTER-REDERIVE: 6 (of 6)

cf711864…  demos/react-official/public/shadcn-theme/tokens.css
cf711864…  demos/solid-official/public/shadcn-theme/tokens.css
cf711864…  demos/vue-official/public/shadcn-theme/tokens.css
cf711864…  demos/qwik/public/shadcn-theme/tokens.css
cf711864…  demos/angular-official/public/shadcn-theme/tokens.css
cf711864…  demos/svelte-official/static/shadcn-theme/tokens.css

cf711864…  <- sha256 of a fresh in-process deriveTokens() RETURN VALUE
```

All six byte-identical to one another **and** to a fresh derivation. Not one lane
copy was hand-edited.

### `deriveTokens()` still throws rather than emitting a partial file

Positive control first, or the three negative arms prove nothing:

```
CONTROL (unmutated): emitted 3274 bytes, DID NOT THROW
  :root block removed             THREW: shadcn theme: no ":root {" block found
  .dark block removed             THREW: shadcn theme: no ".dark {" block found
  @theme inline --radius-* gone   THREW: shadcn theme: @theme inline declares no --radius-* tokens
NEGATIVE ARMS THAT THREW: 3/3
```

Note the parser still looks for upstream's **bare** `:root {` and `.dark {`. Only
the **emitted** selectors changed; the derivation reads upstream exactly as it
did before, which is what keeps a future upstream value change unable to fail to
move here.

---

## 8. WHAT WAS FALSE AND IS NOW CORRECTED

Four page sheets asserted the residual **"IS NOT A SELECTOR"**, and that
`tokens.css` was **"not this card's to re-scope"**. `codex.css` additionally
asserted that re-scoping `:root` *"would also put it above its own `.dark`
block"*. **All three are refuted by measurement**, and each block now says so
in place, with the mechanism and the numbers:

- `demos/shared/habit-css/habits.css`
- `demos/shared/board-css/board.css`
- `demos/shared/contact-css/contacts.css`
- `demos/shared/shadcn-theme/codex.css`

`deriveTokens()`'s header and `demos/shared/shadcn-theme/README.md` said the two
blocks *"pass through unchanged"*. **The declarations still do; the selectors no
longer do**, and that distinction is the whole ruling. Both now carry it, plus
the rejected alternatives (`@layer` loses to unlayered rules; renaming the host's
tokens touches the untouched official scaffold these demos exist to prove
neutrality against).

All twenty-four derived lane copies were re-derived from the shared sources
rather than edited.

### The one thing left uncorrected, deliberately, and it is a real tension

`tokens.css`'s own emitted header still reads *"the only transformation is
structural: the `--radius-*` scale … is lifted into `:root` here"*. A reader now
sees `:root:root` above a comment that names `:root`. Amending it was **not**
done because this card's verify list bounds the `tokens.css` diff to **"EXACTLY
the two selector lines and ZERO declaration lines"**, and a header edit would
break that bound in all six copies. Nothing in the header is *false* — the
transformation is structural, `:root:root` still matches only the root element,
and "No VALUE is computed, rewritten or reformatted" is the load-bearing claim
and it survives — but it is now **incomplete**, and the file points at
`copy-shadcn-theme.mjs` and `README.md`, both of which carry the full story.
**Flagged for whoever owns the next tokens card**: either widen the bound or
accept the pointer.

---

## 9. BOARD ERROR: T017 AND T018'S FINGERPRINT REPRODUCES EXACTLY

The board records that T018 reported `24edb270 / 30403cba / f1a06e0f`, that the
PM re-measured, that the board's `f326d314 / aeb7edc1 / f936e169` was correct, and
that **"the board is not changed on an unreproducible reading."** T020 then
"confirmed" the board's values a third time and T019 a fourth.

**Measured here, in the same repository, at both ends of this card:**

```
method                                            lock       workspace  website(116)
shasum -a 256, relative, sort WHOLE LINES     f326d314    aeb7edc1    f936e169   <- the board
shasum          (DEFAULT = SHA-1), same       24edb270    30403cba    f1a06e0f   <- T017 and T018
shasum -a 256, relative, sort PATHS           —           —           b1dd182a   <- the board's recorded wrong answer
```

**T017 and T018 were not drifting and were not wrong.** They ran `shasum` with
its **default algorithm**, SHA-1. The board's recorded method — *"fingerprint the
owner's three paths … SORT THE WHOLE shasum OUTPUT LINES"* — **never names an
algorithm**, in any of the eleven cards that carry it. Every digit of both
triples is reproducible on demand, from the same bytes, by the same command
modulo one flag.

Two consequences worth writing down:

1. The load-bearing claim survives untouched, and it is the one that matters:
   **the owner's three paths did not move during this card.** START == FINISH on
   *both* methods, 116 files.
2. `A SINGLE FILE'S shasum IS CONTENT-ONLY AND ADMITS NO METHOD VARIATION` — the
   argument the PM used to dismiss T018 — is **false**. It admits exactly one
   variation, the digest algorithm, and that is the variation that occurred.
   **The board should record `-a 256` explicitly.**

---

## 10. REPOSITORY VERIFICATION

| command | result |
|---|---|
| `pnpm test` | **exactly 1 failure**, 1380 passed / 1381. The failure is the foreign, pre-existing `packages/compiler/test/package-inventory.test.ts` ARM B, which reads the owner's modified `pnpm-lock.yaml`. Identical count to T020. |
| `pnpm check` | **251**, ceiling 267. **Fourth card to measure 251.** All 251 are under `packages/frameworks/`; **zero** name any file this card touched, and zero are under `demos/` at all. |
| `pnpm e2e` | **PASS — 6 demos × 9 scenarios, all observations equal** |
| `pnpm lint` | 0 warnings, 0 errors over 552 files, 93 rules |
| `pnpm check:citations` | clean over 4 watched documents, 17 watched source files, 604 swept |
| `git diff --exit-code` over `packages/`, every `generated*/`, every `demos/*/src/emitted/` | **CLEAN**, paired with `git status --short` |
| owner fingerprint, START and FINISH | `f326d314` / `aeb7edc1` / `f936e169`, 116 files — **identical at both ends** |
| foreign processes | PID 64413 (5175) and PID 24931 (5178) alive with their original start times at both ends. `pkill -f` never used; my own servers stopped by recorded PID. |

Ports: `pnpm demo` moved qwik to 5176, svelte to 5177, vue to 5179 and angular to
5180 around the two foreign holders, reported it, and killed nothing.

---

## 11. WHAT T999 MAY AND MAY NOT CLAIM

**MAY** claim: the `--accent` / `--border` collision is **closed at its cause**.
Twenty-four forced-order cells at 0 across two OS colour-scheme arms; the 36 lane
pairs still 0; 44 per-lane captures unmoved; dark mode intact in both placements
with the check proven able to fail; the fix derived, not hand-edited, and
byte-identical across six lanes.

**MAY NOT** claim: that a visual defect was repaired. There was none to repair —
`tokens.css` won in dev and in production alike, and the unmutated diff was 0 at
`992ac9f` and is 0 now. **This was hardening.**

**STILL OPEN**, and it is the honest residue: **no configuration has been found in
which the scaffold actually lands last.** The forced-order arm simulates a flip.
Production was the last plausible place for a real one and it has now been read:
scaffold first, in `<head>`, no `precedence` attribute anywhere. The race this
card removed is real in the cascade and, so far, unobserved in the wild.
