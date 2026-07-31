# T006 — Wire the routing that already exists; label the 17 links that have nowhere to go

Board: `docs/goals/frameless-app-fidelity-v1/state.yaml` · Worker · harness claude-code.
Dispatch HEAD `ac3b33b`. Owner fingerprint at START and FINISH: `f326d314` / `aeb7edc1` /
`f936e169`, website 116 files, all three with `shasum -a 256` over relative paths, whole
output lines sorted.

---

## 1. ORACLE PART 1 — measured against a RENDERED CAPTURE of the reference, never against the other lanes

`https://news.ycombinator.com/` loaded in real Chromium (playwright 1.58.2) at 1440x1000 and
read out of the live DOM. Nothing below is a cross-lane comparison; cross-lane agreement is
forbidden by this board's oracle as fidelity evidence and is not offered as any part of it.

### The masthead link SET, feature by feature

| reference (measured) | ours | verdict |
| --- | --- | --- |
| `Hacker News` → `/news` | wordmark → this front page | SAME LINK, and ours reaches it |
| `new` → `/newest` | `#/newest` | destination-less here |
| `past` → `/front` | `#/front` | destination-less here |
| `comments` → `/newcomments` | `#/newcomments` | destination-less here |
| `ask` → `/ask` | `#/ask` | destination-less here |
| `show` → `/show` | `#/show` | destination-less here |
| `jobs` → `/jobs` | `#/jobs` | destination-less here |
| `submit` → `/submit` | `#/submit` | destination-less here |
| `login` → `/login?goto=news` | `#/login` | destination-less here |

The SET MATCHES ONE FOR ONE — nine masthead links, same labels, same order. **What differs is
that the reference has a real destination behind every one of them and we have nine.**

### The footer link SET

Reference: `Guidelines` `FAQ` `Lists` `API` `Security` `Legal` `Apply to YC` `Contact` —
**eight, and our eight are the same eight in the same order.** Reference destinations are
`/newsguidelines.html`, `/newsfaq.html`, `/lists`, `/HackerNews/API`, `/security.html`,
`/legal/`, `/apply/` and a `mailto:`. Ours are all `#/…`.

### The number that settles the residual

**`document.querySelectorAll('a[href^="#"]').length` on the reference front page is ZERO,
out of 227 anchors.** The reference has no stub links at all. Ours has 31 on `/hn`. That is
the gap, and it is now LABELLED on the page rather than hidden or faked.

### The domain, and it is a REAL FIDELITY GAP (T002 surfaced it; this card confirms it and does NOT close it)

Reference: **30 `.sitebit` nodes, 30 of them containing an anchor**, `href="from?site=<domain>"`,
with a `<span class="sitestr">` inside the anchor. Ours: `<span class="hn-domain">`, 12 nodes,
**zero anchors**. `a.hn-domain` matches nothing in any lane. THE DOMAIN IS A LINK THERE AND A
SPAN HERE. Out of this card's slice — it needs a fixture change with its own ruling — and it
stays on the board as an open, unowned fidelity gap.

### Per-item disclosure — the reference does not have it, so we do not either

Reference subtext, verbatim: `277 points by Jrh0203 1 hour ago | hide | 100 comments`.
`collapseControlsOnFrontPage: 0`. Ours, measured in all six lanes at HEAD: `collapse: 0`.
Adding one would be a fidelity REGRESSION under this board's own oracle. Not added.

### Two reference facts worth recording against our page

- The reference's `More` goes to `?p=2` — real pagination. Ours is `#/more` and is one of the
  seventeen. Labelled, not faked.
- The reference's subtext links its AUTHOR and its AGE (`Jrh0203`, `1 hour ago`); ours carries
  both as plain text inside `.hn-meta`. A second, smaller, unclosed fidelity gap — recorded
  here, not closed here.

---

## 2. WHAT CHANGED, AND WHY IT IS SMALL

**The links were never missing a destination.** Every stub in the emitted `HnFront` already
carried `event.preventDefault()` followed by `onTrace('nav', { to: 'home' }, event)` — named,
lowered and typed by six emitters. **The sink was missing.** All six hosts passed a no-op.
No emitter, no IR node kind, no authoring-surface construct was touched, and none was needed.

Per lane, the sink dispatches through THAT LANE'S OWN ROUTER:

| lane | router used | `/hn` reachable | `/hn-item` reachable |
| --- | --- | --- | --- |
| react | `location.assign` — the scaffold has no client router; `scenarioFor(url)` IS the routing | yes (document reload) | **yes** |
| solid | `location.assign`, same reason | yes (document reload) | **yes** |
| qwik | `useNavigate()` from `@qwik.dev/router` | yes (1 history call) | **yes, without a reload** |
| svelte | `goto` from `$app/navigation` | yes (1 history call) | **NO — lane emits no `HnItem`** |
| vue | `location.assign`, same reason as react | yes (document reload) | **NO — lane emits no `HnItem`** |
| angular | `Router.navigateByUrl` | **no-op, see §5** | **yes, without a reload** |

`hnDestination(name, detail)` is the same pure function in all six lanes and returns `null`
for everything it cannot reach. `open` is deliberately absent from it: that trace belongs to a
story TITLE whose `href={story.url}` is a REAL url held on the page by the fixture's own
`preventDefault` (constraint 11). **`href={story.url}` was not touched on any of the twelve.**

---

## 3. THE RESIDUAL IS LABELLED, NOT FIXED

One `<p class="hn-note">` + `<span class="hn-notemark">` + `<span class="hn-notetext">` in the
footer, **copying `s16-task-board.tsrx`'s `tb-note` / `tb-notemark` / `tb-notetext` shape
rather than inventing one** — T002 named that as the in-corpus disclosure precedent. The CSS
copies `.tb-note` from `board-css/board.css`; only the palette differs, because `/hn` links no
shadcn token sheet.

Rendered and STYLED in all six lanes, measured off `getComputedStyle` and the bounding box:
`display:flex`, `border-left: 3px rgb(255,102,0)`, round 16px mark, box `[108, 468, 1224, 111]`,
1074 characters. **An unstyled `<p>` would report `display:block`, `0px` border and a square
mark; the assertion distinguishes them.**

**The note added ZERO anchors** — `/hn` is still 43 anchors / 31 stubs / 12 real. The
disclosure does not inflate the census it describes.

---

## 4. THE ANCHOR CENSUS, RE-MEASURED PER LANE IN A BROWSER

T002's `84 / 71 / 13` was rendered from the REACT lane only. Re-measured here by loading all
eight application routes in real Chromium per lane and testing for the APP ROOT MARKER, never
for HTTP 200 — react, solid and vue answer 200 for any path and fall back to s1.

| lane | anchors | stubs | real | stubs now resolving | still dead |
| --- | --- | --- | --- | --- | --- |
| react | 84 | 71 | 13 | **14** | 57 |
| solid | 84 | 71 | 13 | **14** | 57 |
| qwik | 84 | 71 | 13 | **14** | 57 |
| angular | 81 | 68 | 13 | **14** | 54 |
| svelte | 63 | 51 | 12 | **2** | 49 |
| vue | 63 | 51 | 12 | **2** | 49 |

Per-route: `s10=3 s11=3 s12=0 s13=43 s14=21 s15=2 s16=3 s17=9`.

**T002's number reproduces EXACTLY in react, solid and qwik — and the re-measurement shows it
was never a six-lane number.** Angular is 81/68 (no S11, no S12) and svelte and vue are 63/51
(no S14). `84 anchors, 71 stubs` is the THREE-LANE maximum, not the corpus.

---

## 5. THE FOUR-LANE CLAIM, AND ONE ANGULAR MEASUREMENT THAT REFUTED MY OWN FIRST WORDING

### `/hn-item` ships in FOUR lanes. The refusals, verbatim, driven through the REAL emitters at HEAD over the real `s14-hn-item.json` golden:

```
Svelte emitter has no lowering for a same-module component reference (HnItem): a .svelte
file declares exactly one component, and a snippet cannot own state or a lifecycle
```
```
Vue emitter has no lowering for a same-module component reference (HnItem): a .vue SFC
declares exactly one component
```

**NO `/hn-item` ROUTE WAS INVENTED IN EITHER LANE, and that is asserted by body hash rather
than by status:** svelte answers `/hn-item` with **404, hash `e3dafebd6a9d` — byte-identical to
its bogus-path 404**; vue answers 200 with hash `a3731810b4fd` — **byte-identical to its
bogus-path body**, because both fall through to s1. In both lanes the comments click leaves
the URL on `/hn` and moves zero DOM.

### THE ANGULAR HOME LINK IS OBSERVABLY INERT, AND I FOUND IT BY MEASURING MY OWN CLAIM

My first version of the on-page note said the wordmark "reaches this front page". Driven at
HEAD: in angular, clicking it produces **no document reload and ZERO
`history.pushState`/`replaceState` calls**, while react/solid/vue reload the document and
qwik/svelte each record exactly one history call. Angular's `Router` treats a same-URL
navigation as a no-op, and `/hn`'s wordmark targets `/hn`.

**The sink is still proven reached in angular, by difference:** the comments arm of THE SAME
handler through THE SAME router moves `/hn` to `/hn-item` and renders 15 threads. Same handler,
same router, different target — so what differs is the target, not the wiring. Making it move
would need `onSameUrlNavigation: 'reload'`, which would invent a behaviour **the reference does
not have either** — the wordmark on news.ycombinator.com points at `/news` from `/news`.

**I rewrote the note text to match the measurement** and re-derived every artifact rather than
ship a page making a claim one lane refutes.

---

## 6. EVIDENCE THAT CANNOT PASS VACUOUSLY

**Body hashes, never HTTP 200** (react/solid/vue answer 200 for any path):

| lane | `/hn` | `/hn-item` | bogus path | distinct? |
| --- | --- | --- | --- | --- |
| react | 200 `5d46c529854d` | 200 `0595e2797c22` | 200 `2540b92adb0b` | **yes** |
| solid | 200 `391475cb5ac1` | 200 `43c6494f1de2` | 200 `fdbd246583ca` | **yes** |
| qwik | 200 `c7b576080422` | 200 `f734e97ad13c` | 404 `3e4f4f6c4739` | **yes** |
| angular | 200 `12de62634cfb` | 200 `0dd503217fb7` | 404 `cb218e08ff05` | **yes** |
| svelte | 200 `1afaa3fc680f` | 404 `e3dafebd6a9d` | 404 `e3dafebd6a9d` | **NO — and that is the proof no route was invented** |
| vue | 200 `5f3c139f340f` | 200 `a3731810b4fd` | 200 `a3731810b4fd` | **NO — same proof** |

**A real mouse click on a `N comments` link on `/hn` lands on `/hn-item`** in react, solid,
qwik and angular: URL moves, DOM hash moves, **15 `.hn-thread` on screen**. Zero in svelte and
vue, whose URL does not move at all.

**NEGATIVE CONTROL — three of the seventeen destination-less links** (`#/ask`, `#/jobs`,
`#/guidelines`), real mouse clicks, ALL SIX LANES: **URL did not move and the body hash did not
move — 18 of 18 clicks.**

**NEGATIVE CONTROL ON THE HOME PROBE ITSELF**, because a probe that reports "navigated" for
everything would prove nothing: the identical sentinel+history measurement applied to
`#/ask` reports `navigated: false` in all six lanes, while the wordmark reports `true` in five.
**The assertion can fail.**

**THE STORY TITLES ARE UNTOUCHED AND STILL HELD:** `href` is
`https://github.com/markless-dev/frameless` — a real absolute url — and a left click leaves the
page unmoved, in all six lanes.

**DERIVATION PROOF, WITH A SHELL ARRAY** (this is zsh, which does NOT word-split — the trap
that made T001's first proof vacuously true): **19 artifacts present → deleted → `PRESENT
AFTER DELETE: 0` ASSERTED BEFORE ANY REBUILD → rebuilt → 19 present, all 19 byte-identical**
by `shasum -a 256`.

---

## 7. A REFUSAL THIS CARD BOUGHT, RECORDED AS FIXTURE CONSTRAINT (14)

The note first read `each story's comments link`. **The REACT DOSSIER GATE refused the emitted
result**, verbatim:

```
generated/S13.tsx  eslint:react/no-unescaped-entities  (T002 ruling 10):
`'` can be escaped with `&apos;`, `&lsquo;`, `&#39;`, `&rsquo;`.
```

Only react gates on it, and only the three JSX lanes could see it at all. **The narrowing is to
spell the possessive without the apostrophe** (`the per-story comments link`), NOT to escape it —
an `&apos;` in the AUTHORED source would reach the svelte, vue and angular templates as six
literal characters. Sixteen fixtures preceded this one without ever putting an apostrophe in
template text. **No emitter and no gate was touched.**

---

## 8. NUMBERS

- **`pnpm check`: START 251 → END 251. PREDICTED RISE 0, STATED IN ADVANCE, DELIVERED.** The
  note is three static hosts with no bindings; nothing new is typed.
- `pnpm test`: **1 failed / 1380 passed — exactly the foreign `package-inventory` ARM B.**
- `pnpm e2e`: **PASS — 6 demos x 9 scenarios, all observations equal.**
- `pnpm lint`: 0 warnings / 0 errors over 552 files. `pnpm check:citations`: clean, 604 swept.
- **S13 IS THE ONLY s-NUMBERED ARTIFACT THAT MOVED**, in all six lanes.

### Size budgets moved, and their derived arithmetic was re-derived rather than left to rot

React S13 `555 → 576` lines, `2073 → 2106` nodes. Solid S13 `578 → 599` / `2138 → 2171`. Hosts
`62 → 65`. **+21 lines from three hosts is not a three-host cost: three hosts are worth about
six, and the other fifteen are the formatter wrapping ONE long prose string** — a third
line-expensive, node-cheap source shape alongside the sixteen separator spans.

Every downstream citation of those numbers was recomputed, not just the budget literals: S13's
own split (react 19% → 22%, solid 19% → 21%), S14's ratios against S13, S15's ratios and
lines-per-host, and S16/S17's references to S13's cost per host. **One reading did not survive
and was rewritten rather than rounded:** S15's row claimed its divergence was "of the same
magnitude" as S13's in the opposite direction. It was 22% against 19%; it is 33% against 22%
now. **Opposite DIRECTIONS were always the argument; the near-equal magnitudes were a
coincidence of two corpora, and one edit separating them is the evidence of that.**

---

## 9. STILL OPEN

1. **THE DOMAIN IS A `<span>` HERE AND AN ANCHOR ON REAL HN** — 30/30 on the reference,
   `href="from?site="`. Confirmed by this card's own capture, NOT closed by it. Needs a fixture
   card.
2. **The reference links the AUTHOR and the AGE in its subtext; we carry both as plain text.**
   Newly surfaced here, unowned.
3. **Seventeen of `/hn`'s thirty-one stubs remain dead BY DESIGN** and are documented, not
   fixed. The final audit must read that as a MEASURED REFUSAL.
4. **The angular home link is a same-URL no-op** (§5). Measured, explained, matches the
   reference's own behaviour, not a defect — but it is a per-lane difference and is labelled.
5. **`84 anchors / 71 stubs` is a THREE-LANE number, not a corpus number.** Angular is 81/68
   and svelte and vue are 63/51. Any successor quoting 84/71 must say which lanes.
6. Inherited and still open: `hn.css`'s stale claim that Angular refuses `/hn-item`, and the
   cascade-collision sweep of the other shared sheets.
