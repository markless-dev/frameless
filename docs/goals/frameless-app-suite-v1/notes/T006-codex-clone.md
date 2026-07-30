# T006 — the Codex clone shipped as S12, in four lanes, with two recorded refusals

Worker receipt detail. **Result: `done`.** T004's one-file hole is closed, the
twelfth scenario is in the corpus, and every axis the card names was measured on the
real module rather than inherited.

> **THE HEADLINE THE BOARD DID NOT EXPECT.** The card said this was "the one most
> likely to refuse" and that a capability list would be a legitimate deliverable.
> **It did not refuse.** S12 emits in five lanes, RUNS COMPLETELY IN FOUR — including
> a three-chunk streaming answer that keeps landing while the user navigates threads
> and switches both tab pairs — misbehaves on exactly one axis in a fifth, and is
> refused outright by one. **What the app actually lost is not streaming. It is the
> KEYBOARD, entirely**, and that loss is authored into the source rather than faked.

---

## 0. THE LANE TABLE, measured on S12 and not on S11

| lane | verdict | evidence |
|---|---|---|
| **react** | **RUNS** — every axis, **zero console messages** | driven in chromium; 4 distinct reply states across the stream |
| **solid** | **RUNS** — every axis, **zero console messages** | driven **alone**; see §5.1, the first reading was the harness |
| **qwik** | **RUNS** — every axis, **zero console messages** | driven at a 1800 ms settle; lazy resume |
| **svelte** | **RUNS** — every axis, **zero console messages** | driven in chromium |
| **vue** | **EMITS-BUT-MISBEHAVES** — every SYNCHRONOUS axis runs clean; the stream throws | `TypeError: _ctx.Promise is not a constructor`, §5.2 |
| **angular** | **REFUSES AT EMIT** — no `generated/S12.ts`, no route | verbatim message with S12's OWN member list, §5.3 |

Four lanes run the whole app. **That is the same table S11 produced, and this card did
not assume it** — the card's own rule ("a prior-card verdict is not a lane verdict")
was applied to the card's own prediction. Each lane's gate was re-run on the real S12
module and each shipped lane was then driven in a real browser.

---

## 1. WHAT THE APP IS, AND WHAT IT CANNOT BE

`packages/compiler/test/fixtures/s12-codex-clone.tsrx` — one authored source, 53
template hosts, the largest template in the corpus.

**Shipped:** a 256px sidebar of conversations with a New-chat button and a selected
state; a chat thread with per-thread message filtering, an empty state, and role and
timestamp on every row; a composer with a `value`-bound textarea and a Send button; a
**right detail pane with tabs** (Details / Files) and a **bottom detail pane with
tabs** (Terminal / Diff); and a **streaming assistant reply in three chunks** that
continues while the app is navigated.

**Not shipped, and NOT faked:**

- **NO KEYBOARD INTERACTION OF ANY KIND.** No Enter-to-send, no Escape, no shortcut,
  no Tab pane navigation. Two-word DOM events are unspellable in every lane
  (`DEFECTS.md` 15): every emitter lowercases the whole event name, so `onKeyDown`
  prints `onKeydown` and react-dom never fires it. **Enter-to-send is the reference's
  primary interaction.** The composer ships the Send BUTTON, which is the reference's
  other affordance and a plain click. Nothing in this tree shims a key event.
- **The stream is a FIXED count of three chunks**, not variable-length. A write inside
  a loop body around an `await` is `DEFECTS.md` 8.1 in every lane, so an unrolled
  count is the only authorable shape.
- **Timestamps are literal strings.** `Date` is a global; the angular lane cannot name
  one in a transplanted body and the vue lane's template compiler allows `Date` but
  not `Promise`, so a clock would have moved a refusal around without removing one.

---

## 2. THE ONE-FILE HOLE IS CLOSED, AND THE CENSUS WAS RE-ARGUED RATHER THAN RENUMBERED

`packages/frameworks/vue/src/gate/index.ts` is in this card's `allowed_files`, and the
twelfth golden moved all four derived figures exactly as T004 measured.

**Re-derived by an INDEPENDENT script** (scratchpad, not committed) that imports
nothing from `packages/frameworks/vue/test/gate.test.ts` and reads the policy's own
definitions, **over two independent routes that must agree**:

- **Route A** — walk the emitted `S<n>.vue` templates with `@vue/compiler-sfc`.
- **Route B** — walk the compiler goldens' handler ASTs, linking hosts to events
  through `host.eventIds`.

```
SCENARIO COUNT: 12   S1 … S12
ROUTE A: instances 19  applicable 8  outside 11   (outside that call onTrace: 11/11)
ROUTE B: instances 19  applicable 8
ROUTES AGREE: YES
ROUTE C (12b): printed entries 24, distinct names 7
S12 prop graph: prop:props writable=false writes=0 | 9 events, 1 suspends across an await
```

> **ROUTE B WAS BROKEN ON ITS FIRST RUN AND REPORTED `instances: 0`, AND THAT WAS
> FIXED RATHER THAN REPORTED.** The first version looked for a `host.events` array
> that does not exist in the golden schema, so it agreed with nothing and would have
> printed `ROUTES AGREE: NO` — a route that measures zero is not a disagreement, it is
> a dead instrument. The linkage is `host.eventIds` → `records.events[].handlers[0]`.
> Recorded here because a two-route proof whose second route is empty is the same
> defect as T003's vacuous derivation proof and this board's dead mutation harness.

### 2.1 The 12a denial, re-argued over twelve scenarios

Eleven → **twelve**-scenario corpus, eighteen → **NINETEEN** instances, seven →
**EIGHT** applicable. The outside count is **unchanged at eleven**, which is itself the
datum: S12 added exactly one host to this domain and it landed **inside** the sugar's
reach, moving the ratio 39% → **42%**. Gate 4 still FAILs on exactly the criterion it
failed on before, because a recognised subset is a FAIL at either figure.

**What is genuinely new is a TAG, not a count.** Every one of the previous eighteen
instances is an `<input>`. **S12's composer is the corpus's first `value`-bound
`<textarea>`** — S7 has shipped a textarea since long before this entry existed, but
it binds `data-notes`, not `value`. **The card's inherited claim that "a `<textarea>`
with a `value` binding is available — S7 already ships one" is FALSE**, and the
capability was therefore unmeasured until this module. See §7.1.

That crossing was worth a **new measured G5 difference rather than a borrowed one**.
Compiled at `vue@3.5.40`, `<textarea>` only:

| | v-model | the emitted baseline |
|---|---|---|
| client codegen | `_withDirectives(... {"onUpdate:modelValue": …}, 512 /* NEED_PATCH */)` + `[_vModelText, _ctx.draft]` | `{ value: _ctx.draft, onInput: … }`, `40 /* PROPS, NEED_HYDRATION */` |
| **SSR codegen** | `ssrRenderAttrs(_attrs)` then `ssrInterpolate(_ctx.draft)` | `ssrRenderAttrs(_temp0 = mergeProps({ value: _ctx.draft }, _attrs))` then `("value" in _temp0) ? _temp0.value : ""` |

The SSR row is a **fallthrough-attribute semantic an `<input>` cannot exhibit at all**,
because an input has no text child to interpolate. The shipped message now lists
**five** measured G5 differences, and says which one is the new tag's.

### 2.2 The 12b denial, re-argued over twelve scenarios

Twenty-three → **TWENTY-FOUR** printed entries; distinct names **held at seven**,
because S12's one entry is `onTrace`, a name the corpus already carried.

The re-argument is not a restatement. **S12 is the third whole application and the
first module here to STREAM**: one of its nine recorded events suspends **three times**
in a single handler and writes the message list after each resume. A streaming child
pushing partial answers upward is the single most natural shape a written-back prop
could take — it is what `defineModel` exists for — and the strongest available
instance of it still declares one read-only prop entry with `writable=false, writes=0`.
**ZERO is re-derived for the fourth time, not carried forward.**

Neither assertion in `test/gate.test.ts` was softened. `SPELLED_NUMBERS` already
reached TWENTY-FIVE, so its table did not need extending either.

---

## 3. THE FULL BLAST RADIUS WAS LARGER THAN T004'S LOWER BOUND, AS T004 SAID IT MIGHT BE

T004 measured **16 failed / 1213 passed across 9 files** with S11 copies staged, and
labelled it a lower bound because "the qwik and svelte gates were silent only because
the stand-in was already-passing S11 output". Measured here with the **real** S12:

| suite | moved? | repair |
|---|---|---|
| `compiler/test/enriched-ir.test.ts` | **yes, three places** | FIXTURES, EXPECTED_HOSTS (53 hosts), callback names, ANNOTATED |
| `react/test/size.test.ts` | yes | budget row |
| `solid/test/size.test.ts` | yes | budget row |
| `solid/test/emitted-typecheck.test.ts` | yes | one accepted finding-002 row |
| `vue/test/gate.test.ts` → `vue/src/gate/index.ts` | yes | §2 |
| `angular/{emitter,gate,parse-emitted,emitted-typecheck}.test.ts` | yes | one `unbuilt-scenarios.ts` row |
| **`qwik/test/**`** | **NO — 93 passed unchanged** | none; the qwik gate accepts S12 as authored |
| **`svelte/test/**`** | **NO — 121 passed unchanged** | none; the svelte gate accepts S12 as authored |

So the lower bound was honest in the right direction: the real S12 moved **one more
suite** than the stand-in (`enriched-ir.test.ts`, which the probe never drove), and the
two suites T004 flagged as possibly-silent were **genuinely silent** — not an artifact.

### 3.1 Two size readings worth keeping

- **REACT: the corpus's biggest template is not its biggest emission.** S12 carries 53
  hosts against S11's 41 — a third more — and emits **smaller** on both axes:
  386/424 = 0.91× lines, 1760/1891 = 0.93× nodes, the two ratios agreeing to within
  2%. Emitted size tracks handler bodies, not host count. S11 is dense in handlers;
  S12 is dense in static markup.
- **SOLID: the line premium flips sign.** Against react's same-scenario budget, solid
  printed **+29** lines at S10, **+16** at S11 and **−24** at S12, while the node
  premium held: +37, +39, **+2**. The per-`computed` accessor hypothesis this table has
  twice been tempted by is refuted a third time — S12 declares seven computeds, one
  fewer than S11, while the node gap collapsed by 37.

---

## 4. THE STREAM, MEASURED

The send handler suspends three times, and the post-`await` writes are **chained
through `const`s** — `opened` → `chunk1` → `chunk2` → `chunk3` — rather than re-reading
the state cell. **That is not style.** S11 measured that react keeps const-SSA form and
resumes from the pre-suspension `const` while solid, qwik and svelte resume against the
live cell; a stream that re-read the cell between chunks would be a different app in
react than in the other three, and the cross-lane comparison this corpus exists for
would be comparing two designs. The const chain makes the four lanes agree **by
construction**, with no emitter change.

Sampled every 200 ms in each running lane, identically:

```
200ms STREAMING reply=""                                                        caret shown
400ms STREAMING reply="Reading the twelve-scenario corpus"                      caret shown
800ms STREAMING reply="… , then emitting all six lanes"                         caret shown
1200ms IDLE     reply="… , then emitting all six lanes from one authored source." caret hidden
```

Four distinct reply states, draft cleared, message count 2 → 4.

### 4.1 "Streaming while still navigating the app" — Patrick's actual ask

Driven explicitly: send, then **150 ms later leave the thread**, switch the right pane
to Files and the bottom pane to Diff while chunks are still landing, wait, come back.

```
titleWhileStreaming        "Measure the async door"   (a different thread is open)
messagesShownInOtherThread 0                          (the streaming row is hidden, not torn down)
statusWhileAway            "streaming"                (it is still running)
replyAfterReturn           the complete third chunk
rightTabStillFiles / bottomTabStillDiff  1 / 1        (navigation state survived)
```

This works because the thread filter is a **`hidden` binding on the row**, not a repeat
over a filtered view — the row keeps its key across the switch, so the chunks land on a
row that is merely hidden. That authoring choice was forced by Solid (repeating over a
`computed` is refused) and it is what makes the axis observable.

---

## 5. THE THREE READINGS THAT NEEDED A SECOND LOOK

### 5.1 SOLID'S FIRST READING WAS THE HARNESS, NOT THE APP

Driven concurrently with four other Vite servers, solid reported five console errors —
all of them `WebSocket connection to 'ws://localhost:24678/' failed` and its
consequences. **Port 24678 is Vite's HMR socket and five dev servers contend for it.**
Re-driven **alone**: `CONSOLE: []`. T003 recorded this exact trap; reporting the first
reading would have blamed the app for the harness.

### 5.2 VUE'S REFUSAL, VERBATIM, CAPTURED WITH THE LANE DRIVEN ALONE

Same reason — the contention noise was masking the real page error behind
`Failed to send error to Vite server`. Driven alone, the record is clean:

```
syncAxesConsole: []          <- thread navigation, BOTH tab pairs, new chat, composer draft
PAGEERROR: TypeError: _ctx.Promise is not a constructor
warning: [Vue warn]: Unhandled error during execution of native event handler
  at <CodexClone onTrace=fn<noTrace> >
```

Every synchronous axis of the Codex clone runs in this lane with **zero console
output**; only the stream throws. Mechanism unchanged from S11 and re-confirmed here on
S12: the vue emitter inlines handlers into **template expressions**, and Vue's template
compiler prefixes any identifier outside `GLOBALS_ALLOWED` with `_ctx.` — a list
carrying `Date` and `JSON` and **not** `Promise` or `setTimeout`. A lane limit inside
Vue's own design envelope; **not a defect to file upstream.**

### 5.3 ANGULAR'S REFUSAL, READ OFF S12 AND NOT OFF S11

Attempted by adding the row to that lane's `regenerate.ts` and running it. It threw
with **S12's own declared-member list**, which is what proves it was measured on this
module:

```
Angular emitter cannot resolve the identifier "Promise" in a transplanted body: it is
neither a body-local binding, a function parameter, a @for variable, nor a declared
component member (blocked, bottomTab, draft, messages, nextMessage, nextThread,
onTrace, openThread, openTitle, rightTab, status, streaming, threads, turns,
turnsLabel, visible, visibleLabel). The emitter throws rather than guessing whether it
is a global
```

The row was removed and the absence documented. `test/unbuilt-scenarios.ts` carries the
subtraction for all four angular suites and **drives the real `emit()` to assert it
throws with that message**, so the list stays distinguishable from a skip list.

**THE READING WORTH RECORDING: the angular lane cannot hold a STREAMING APP AT ALL, on
a limit that is not about streaming.** Every synchronous axis here is inside its
envelope; a streamed answer needs an artificial delay, the only delay this authoring
surface can express is `new Promise` + `setTimeout` (`computed(async …)` is closed in
all six lanes, T001), and this lane cannot name the globals a delay is made of.

---

## 6. THE VISUAL PASS — asserted off the image, and the image found what the assertions did not

Vendored from **`theming.mdx`'s "Default Theme CSS" block**, not from
`apps/v4/app/globals.css`, exactly as T004 warned. Provenance in
`demos/shared/shadcn-theme/README.md`: commit `6a070bf8…`, `theming.mdx` sha256
`403a71fe…`, MIT "Copyright (c) 2023 shadcn", `LICENSE` fetched and read in full.
**Nothing was fetched, cloned or copied from the Square UI repository at any point.**

### 6.1 The card's seven targets, measured off the rendered PNG at 1280×900

| target | measured | how |
|---|---|---|
| sidebar **256px** | fill `(250,250,250)` to x=254, border `(229,229,229)` at **x=255**, white at 256 | colour transition scan on the image |
| nav item **230×36 r8** | ink box **230×36**; three corners NOT filled, filled 8px along both edges | accent-fill extent + corner probes |
| section label **12/500 uppercase wide-tracked** | ink **44×9**; cap height 9 = all-caps | ink box; the tracking mutant moves it to 33×10 |
| empty heading **24px/600** | ink **253×23** | ink box on the empty thread |
| composer shell **630×175 r14** | ink **630×176**; top row's stroke starts 12px in, left column 11px | drawn-extent scan + arc probe |
| textarea **628×120 pad 12/16** | placeholder ink starts **17px** from the shell edge = 1px border + **16px** padding | ink box inside the shell |
| body **ui-sans-serif 16/24** | `ui-sans-serif 16px/24px` in all five lanes | **computed style, NOT ink — flagged in §7.3** |

Two honest imprecisions, stated rather than rounded away: the shell measures **176** ink
rows against a 175px box (the bottom edge's antialiased row), and the 14px radius reads
as **12** fully-opaque pixels because the arc's last two are below threshold. The arc
probe is nonetheless a real radius test — see M5 and M10 below.

### 6.2 The assertions were mutation-tested. 10 injected, control green, **10/10 KILLED**

| mutant | what moved |
|---|---|
| M1 rail 240px | rail edge 255 → 239, nav 230 → 226 |
| M2 nav radius 0 | all three corner probes false → true |
| M3 nav 200px | nav box 230 → 200 |
| M4 label tracking + case off | label ink 44×9 → **33×10** (width AND cap height — it really is uppercase and really is tracked) |
| M5 composer radius 0 | arc **[12,11] → [0,0]** |
| M6 composer 600px | box 630 → 600 |
| M7 textarea padding 4px | pad 17 → **5** |
| M8 send radius 0 | send corner false → true |
| M9 heading 14px | heading ink 253×23 → **157×14** |
| **M10 composer radius 8px** | arc **[12,11] → [5,5]** |

**M10 is the one that matters.** An arc probe that only distinguished "round" from
"square" would have been satisfied by any radius; M10 shows it separates **14 from 8**,
which is the difference between the reference's composer and a stock `rounded-md`.

### 6.3 THE IMAGE FOUND A DEFECT NO ASSERTION IN §6.1 COULD SEE

**Every target above was already green while every message body, every detail-pane row
and the terminal output rendered CENTRED.** The React scaffold's own `src/index.css`
sets `text-align: center` on its container; taking the app out of flow with
`position: fixed; inset: 0` fixed its POSITION and inherits nothing less.

Nothing in the geometry pass could see it: the rail is an edge, the nav item is a box,
the composer is a box and an arc, the padding is an offset. **Centred text changes
none of them.** It was found by rendering the screenshot and LOOKING AT IT, which is
what the card asked for and what an assertion list is not a substitute for. Repaired
with `text-align: left` on `.codex`; all fourteen ink numbers unchanged afterwards.

The same class of finding hit the container itself first: before `position: fixed`, the
rail rendered **256px wide starting at x=78**. `.rail` reported exactly 256×900 the
whole time.

### 6.4 THE FIVE LANES ARE NOT BYTE-IDENTICAL, AND THAT CLAIM IS NOT MADE

T005 could report one distinct image across five lanes. **This card cannot, and says
so.** Measured at 1280×900:

- **Rendering is deterministic per lane**: react run 1 vs run 2 = **0 differing**;
  svelte run 1 vs run 2 = **0 differing**. So the cross-lane delta is real, not noise.
- react = solid = vue **byte-identical**. qwik and svelte each differ from that trio.
- **The difference is confined to glyph and arc RASTERISATION.** Every flat-fill region
  is identical across all five: rail interior **0**, thread background **0**, composer
  interior **0**, right pane below its rows **0**, bottom pane below its rows **0**.
  Every solid colour agrees exactly — rail `(250,250,250)`, border `(229,229,229)`, nav
  accent `(245,245,245)`, send fill `(23,23,23)`.
- Every geometry number in §6.1 agrees across all five lanes, except the composer arc
  probe (12/11 in react·solid·vue, 10/9 in qwik·svelte) — the same antialiasing
  difference seen from the other side.
- The DOM is identical: same text, same computed font, `.rail-item.selected` at
  `[13,128,230,36]` in every lane. qwik additionally injects
  `data-qwik-inspector` attributes and a dev inspector overlay in the bottom-right,
  which accounts for its larger raw diff.

**Claiming byte-identity here would have been false.** What is true and asserted: same
DOM, same boxes, same colours, same geometry; differing text antialiasing.

---

## 7. THREE ERRORS FOUND, ALL MEASURED

### 7.1 THE CARD'S TEXTAREA CLAIM IS FALSE — and it is inherited from T004

T004's §4.2 banked, for this successor: *"`<textarea>` with a `value` binding is
available — S7 already ships one."*

**S7's textarea binds `data-notes`. It has no `value` binding.** Verified in the
fixture and in the emitted output of every lane:

```
$ grep -rn "textarea" packages/compiler/test/fixtures/*.tsrx
packages/compiler/test/fixtures/s7-form-controls.tsrx:35:  <textarea
      data-control="notes"   data-notes={notes}   onInput={…}
```

So a `value`-bound `<textarea>` was **unmeasured in all six lanes** when this card
started, and the composer is the first one the corpus has ever asked for. Measured
here: five lanes emit it; the react emitter rewrites `onInput` → `onChange` and
`event.currentTarget` → `event.target`, **which is also why react's controlled-field
warning does not fire**; the vue gate accepts it as a 12a domain instance; and the
solid lane produces a **new** accepted finding-002 diagnostic with the tag substituted
straight through on both sides —
`TextareaHTMLAttributes<HTMLTextAreaElement>` where every prior instance says
`InputHTMLAttributes<HTMLInputElement>`. **That is the first evidence that finding 002
follows the `value` BINDING rather than the `input` element**, which is what its note
predicted and nothing in the corpus could previously distinguish.

The claim was load-bearing: the whole composer depends on it. It happened to be true
in outcome and false in its evidence, which is the shape that survives longest.

### 7.2 THE FINGERPRINT TRAP, RE-CONFIRMED IN BOTH DIRECTIONS

Sorting whole `shasum` **output lines** returns `f936e169`. Sorting the bare digest
column returns **`feddd40b`**, reproduced here on purpose to confirm T004's correction
rather than take it on trust. The card still says "SORT THE DIGESTS, NOT THE PATHS",
which is the under-specified phrasing T004 asked the PM to fix.

### 7.3 ONE OF THE SEVEN VISUAL TARGETS IS NOT IMAGE-ASSERTABLE, AND IS FLAGGED

`body ui-sans-serif 16/24` is read from **computed style**, not from ink. There is no
element on the page that renders at the inherited 16/24 — every text role overrides it
(15px message text, 14px nav, 13px pane rows, 12px labels, 24px heading) — so there is
no glyph whose ink height could witness it. Reporting it as an image assertion would
have been the kind of quiet substitution T005's stop_if forbids. **It is reported as
computed style and labelled as such.** The type scale it anchors IS witnessed in ink:
24px heading → 23 ink rows, 12px label → 9.

### 7.4 THE NOTE PATH ON THE CARD IS STALE

T006's `allowed_files` carries `docs/goals/frameless-app-suite-v1/notes/T004-codex-clone.md`
— T004's note, copied forward with the rest of the list. The dispatch that assigned
this card names **`notes/T006-codex-clone.md`**, which is this file. It was written
here and **T004's note was not modified**, so the predecessor's record is intact. The
PM should correct the entry on the card.

---

## 8. COMMANDS AND BASELINES

| command | result |
|---|---|
| six-lane emit of the REAL module | five EMIT; angular REFUSES with the verbatim message read off S12 |
| all six lane suites | react 201, solid 199, qwik 93, svelte 121, vue 145, angular 157 — all pass |
| INDEPENDENT vue census, two routes | 19 / 8 over 12 scenarios, ROUTES AGREE: YES; 24 entries / 7 names |
| vue `v-model` vs baseline on `<textarea>`, client + SSR | five G5 differences, the fifth measured on the new tag |
| **DERIVATION PROOF** — delete 22 S12 artifacts, re-run 5 regenerate + 5 copy-emitted + 6 copy-shadcn-theme | `PRESENT AFTER DELETE: 0`, then **22/22 BYTE-IDENTICAL**; each demo copy's digest EQUALS its lane's generated digest; all six theme copies equal |
| `git diff --exit-code` over every S1–S11 artifact and `demos/shared/todomvc-app-css` | **exit 0** |
| **5 sites launched and driven** (chromium, ports **5321–5325**) | 10 axes per lane; react/solid/qwik/svelte clean, vue synchronous-clean and stream-throwing. **Per-lane commands and `/codex` URLs: §8.1** |
| screenshots + 14 ink probes across 5 lanes | §6.1 |
| **mutation test of the image assertions** (10 mutants, injected live) | control green, **10/10 KILLED** |
| `pnpm test` | **EXACTLY 1** failure — `package-inventory` ARM B, foreign / **1281 passed** |
| `pnpm check` | **267** `error TS` lines. **Did NOT rise.** |
| `pnpm e2e` | **PASS — 6 demos × 9 scenarios, all observations equal.** `scripts/e2e.mjs` untouched |
| `pnpm lint` | 0 warnings, 0 errors, 479 files |
| `pnpm check:citations` | clean — 4 documents, 17 watched sources, 539 swept |
| owner fingerprint, START and FINISH | `f326d314` / `aeb7edc1` / `f936e169`, `website/` **116 files** — IDENTICAL at both ends |

**Ports 5321–5325**, chosen clear of T003's 5301–5306 and T005's 5311–5315 and checked
free before use. Every process was started by this card and stopped by **recorded PID**
after `ps`/`lsof` confirmed its working directory; **`pkill -f` on a broad pattern was
never used**, and no port held by a foreign process was touched.

### 8.1 LAUNCH COMMANDS — ACTUALLY RUN, and the ports actually used

> **Provenance, stated first, because it is the whole point of this table.** T006 launched
> and drove five sites at ports 5321–5325 but **wrote down no command and no URL** — the
> `ACTUALLY-RUN` half of `oracle.signal` (2) without the `documented` half. T999 caught it.
> **T007 did not reconstruct these commands from T006's memory; it RE-RAN every one of
> them** at its own ports **5331–5336**, checked free first, and read the result off the
> wire. What is recorded below is what T007 executed and what the server answered.

| lane | command actually run | URL | result |
|---|---|---|---|
| react | `PORT=5331 pnpm dev` in `demos/react-official` | `http://localhost:5331/codex` | **200**, 4234 B of SSR HTML |
| solid | `PORT=5332 pnpm dev` in `demos/solid-official` | `…:5332/codex` | **200**, 4597 B |
| qwik | `pnpm copy-emitted && pnpm copy-todomvc-css && pnpm copy-shadcn-theme && npx vite --port 5333 --strictPort` in `demos/qwik` | `…:5333/codex/` — **note the trailing slash** | **200**, 55 250 B |
| svelte | `pnpm copy-emitted && pnpm copy-todomvc-css && pnpm copy-shadcn-theme && npx vite dev --port 5334 --strictPort` in `demos/svelte-official` | `…:5334/codex` | **200**, 6990 B |
| vue | `PORT=5335 pnpm dev` in `demos/vue-official` | `…:5335/codex` | **200**, 8248 B |
| angular | `pnpm start --port 5336` in `demos/angular-official` | `…:5336/codex` | **404**, body `Cannot GET /codex` — **NO ROUTE** |

Every 200 above was confirmed to be the Codex clone and not a fallback page: each body
carries the emitted root marker **`data-app="codex-clone"`** and a link to
`/shadcn-theme/codex.css`. `pnpm dev` in the react, solid and vue lanes is
`copy-emitted && copy-todomvc-css && copy-shadcn-theme && node server`, so the emitted
bytes and the theme are re-copied by the launch itself.

**Angular's absence is recorded, not omitted.** The 404 is structural, not a
misconfiguration: `demos/angular-official/src/app/app.routes.ts` declares `''`, `s2`–`s9`
and `todomvc` and **no `codex` path**, and `packages/frameworks/angular/generated/` holds
`S1`–`S10` and **no `S12.ts`** — the lane refused at emit (§5.3), so there is no component
to route to. `/codex/` with a trailing slash is also **404**. The **control** on the same
server: `…:5336/todomvc` returns **200**, which is what proves the site itself runs and the
absence is S12-specific.

**Three things this re-run measured that the commands do not show on their face:**

1. **`PORT=` is not optional for react/solid/vue.** All three read
   `process.env.PORT || 5173` in their own `server.js`, so all three default to the *same*
   port and only one can run at a time without it.
2. **qwik's own `pnpm dev` FAILS ON THIS MACHINE, and it is not the demo's fault.** That
   script is pinned to `vite --port 5175 --strictPort`, and **port 5175 is still held by
   the foreign `node` process PID 64413** — the same foreign PID T003 recorded. Run
   verbatim it exits 1 with `Error: Port 5175 is already in use`. **The port was recorded
   and routed around, never killed**, exactly as T003 did; the explicit-port form in the
   table is what works. *The script has not drifted — the machine is occupied. Nothing in
   `demos/qwik` was edited.*
3. **Angular is `start`, not `dev`, and `--` collides.** There is no `dev` script in that
   package. `pnpm start -- --port 5336` **fails**, verbatim:
   ```
   Option '--' has been specified multiple times. The value '5336' will be used.
   Error: Schema validation failed with the following errors:
     Data path "" must NOT have additional properties().
   ```
   **`pnpm start --port 5336`, without the `--`, works** — pnpm appends the flag to the end
   of the `&&` chain, where `ng serve` receives it. That is the form in the table, and it is
   simpler than T003 §5's `npx ng serve` workaround for the same lane.

**A correction to T003 §5's table shape, found by re-running it here:** that table records
qwik's URL as `…/todomvc-advanced` with no trailing slash. Qwik City **canonicalises to a
trailing slash** — `/codex` and `/todomvc-advanced` both answer **301** with
`location: /codex/`. A browser follows it silently, which is why driving the lane never
surfaced it; a `curl` or `fetch` check sees the 301 and reads zero bytes. The qwik row
above records `/codex/` directly.

Ports **5331–5336** were confirmed free with `lsof` before use, each server was started by
T007 and stopped by **recorded PID** (the `pnpm` launcher *and* the `node` child that
actually held the socket, found with `lsof -t` on the port), and all six were confirmed
free afterwards. **`pkill -f` was never used.** Foreign PID 64413 was still listening on
5175 at the end, untouched.

---

## 9. WHAT THIS LEAVES OPEN

1. **S12 is browsable only.** `scripts/e2e.mjs` pins `threeWayScenarios` to the literal
   `['s1'..'s9']` and is out of scope here, so the Codex clone does not join the 6 × 9
   contract — same sequencing S10 and S11 took.
2. **Three findings from T003 remain unfiled in `docs/DEFECTS.md`** and this card
   reproduced two of them on new bytes: vue's template-expression global limit
   (reproduced on S12), angular's global-identifier ban (reproduced on S12), and
   react's post-`await` const-SSA divergence (**avoided by construction here** via the
   const chain, so S12 does not exhibit it — which means it is still unfiled and now
   also unexercised).
3. **A fourth, NEW and unfiled:** finding 002 now has its first non-`<input>` instance
   and its producer is confirmed to be the `value` binding. That belongs in
   `notes/findings-002-solid-attr-namespace.md`, which is outside this card's list.
4. **The five lanes are not pixel-identical** (§6.4). If a successor wants that claim,
   the qwik dev inspector must be excluded — as T005 did — and the residual
   text-rasterisation difference between the SSR-express trio and the Vite-dev pair
   still needs a cause, which this card measured but did not explain.
