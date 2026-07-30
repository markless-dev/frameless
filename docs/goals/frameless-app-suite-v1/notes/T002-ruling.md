# T002 — What the door supports, and the spec for TodoMVC Advanced

Judge ruling at `14f89ef`. Read-only: nothing was authored, emitted, or edited
outside this file. Every claim below is either read out of a source file named
here, or is marked UNMEASURED.

---

## 0. THE ERROR IN THE DISPATCH, AND IT IS THE LOAD-BEARING ONE

The brief and T001's handoff both say:

> streaming (repeated resolution) and optimistic write-then-revert BOTH EMIT in
> all six lanes via `async` event handlers

That is true of the **lowering** and false of the **source**. `P8`'s own header
says so in as many words:

> Awaiting the same promise three times resolves to the same value three times,
> which is the point: what is being measured is whether the SECOND and THIRD
> post-`await` writes are lowered and land, **not whether the source can produce
> distinct chunks.**

So what emits in six lanes is *"await a promise the host already made."* The apps
need something else: **a NEW promise per user action** — one per search term, one
per optimistic save, one per stream chunk. Ask that question and the six-lane
intersection is **empty**. Three shapes exist and each loses a different lane:

| shape of the async source | lanes that emit | the one that refuses |
|---|---|---|
| `chunk: Promise<string>` prop, awaited (P8/P9) | **all six** | — but it resolves **once**, to **one** value |
| `load: () => Promise<string>` callback prop (P4/P5/P6) | five | **qwik** |
| `new Promise` + `setTimeout` in the handler (PA) | five | **angular** |

### Why qwik cannot be worked around — read out of the emitter, not inferred

`packages/frameworks/qwik/src/emitter/index.ts`, `lowerStatement`: a statement
containing a callback-prop call is accepted on exactly one path —

```
statement.type === 'ExpressionStatement' &&
statement.expression.type === 'CallExpression' &&
calls.length === 1 && callbackName(statement.expression.callee, context)
```

The expression must **be** the `CallExpression`. `const next = await load();` is a
`VariableDeclaration` and falls through to
`Qwik v1 callbacks must be observational expression statements in ${event.id}`.
So does `value = await load();` — an `AssignmentExpression`, not a
`CallExpression`. **The obvious assignment-form workaround does not exist.**
`callbackCalls` is also checked on `computed` bodies (`Qwik computed … cannot
invoke a callback prop`) and on local initializers. Conclusion, from source:
**qwik cannot consume a callback prop's return value anywhere.** The same
function carries a second rule the apps must obey —
`Qwik v1 rejects synchronous actions after an awaited callback` — which is why
every S10 handler calls `onTrace(...)` as its **last** statement.

### Why angular cannot be worked around

`packages/frameworks/angular/src/emitter/index.ts` resolves every `Identifier` in
a **transplanted body** against lexical scope plus declared component members and
throws otherwise. T001 measured six globals refusing, on a **fully synchronous**
control (`PC`). `Promise`, `setTimeout`, `fetch`, `Date`, `JSON` are all globals.
Angular therefore cannot manufacture a promise, and cannot read a clock or parse
JSON, inside any handler or `computed`.

### The consequence

**The binding constraint on this goal is not "fetch-on-render must become
fetch-on-ask."** That narrowing is real, and it is the smaller one. The binding
constraint is:

> **One promise per render, or lose a lane.**

Everything below follows from that sentence.

---

## 1. RULING — TodoMVC Advanced is NOT buildable as the owner described it in six lanes. It ships in FIVE.

The owner's four axes, ruled one at a time.

| axis | verdict |
|---|---|
| local/in-memory state + CRUD | **six lanes, no narrowing.** S10 proves every construct. |
| **local filtering** | **six lanes, no narrowing.** A `computed` plus S10's `hidden` binding. |
| **optimistic updates** | **five lanes** for a genuine per-action revert; six only if every action shares one canned server answer. |
| **remote query with artificial delay** | **five lanes.** A fresh delay per search term needs a promise made in the handler. |

The lane that goes unbuilt is **angular**, and it is worth being exact about why:
angular is lost **not to async at all**. It is lost to a standing
global-identifier ban that `PC` reproduces with no async in the module. That is a
missing lane *with* a verbatim refusal, which the oracle names as a legitimate
outcome, and it is the honest reading rather than a convenience.

### Where exactly it narrows, and what it does NOT narrow

- **"Loads its data when it appears" → "when the user asks."** ACCEPTED, and it
  **does not gut this app.** Ruled plainly: TodoMVC Advanced's two async axes are
  *already* user-initiated by their own nature. A remote query begins when you
  type a term; an optimistic update begins when you toggle a row. Neither is a
  mount-time load. The only thing lost is the initial list, and S10 already seeds
  its list **in the component** for an unrelated measured reason (IR-8 has no
  lowering for `TSArrayType`, so a `seed` prop is refused in three lanes).
- **An explicit initial-load button is therefore NOT the right shape and should
  not be built.** It would be a control that exists only to apologise for a
  missing lifecycle hook. Seed in-component exactly as S10 does, and spend the
  async budget on the two axes that are genuinely asynchronous. The demo the
  owner wanted — type a query, watch a spinner, watch results arrive, toggle a
  row and watch it revert — is fully intact.
- **A per-row `pending` flag and a revert indicator are the optimistic axis's
  visible surface.** `P9` proves the whole shape emits, including the keyed
  repeat over `rows` with a per-row `pending` field.
- **Every conditional is an expression; no write sits inside an `if` or a loop**
  (`DEFECTS.md` 8.1). This also means **no `for`/`while` around an `await`** — a
  variable-length async loop is unauthorable in the react lane and silently so.

### The shape ruled OUT, and why it is recorded rather than hidden

There is a six-lane shape: the handler calls `onQuery(term)` as its last
statement (bare call — qwik-legal, angular-legal), the **host** performs the
delayed query, and the results come back down as a prop. All six lanes emit it.
It is rejected because it moves the app's defining mechanism into **six
hand-written hosts**, which is `goal.md`'s named second misfire. Recorded here so
that a later card that wants six lanes at any cost knows the price it would pay.

---

## 2. RULING — the Codex clone is REACHABLE, narrowed, and its streaming axis is five-lane

Not out of reach. Three of the four blockers on the card are weaker than stated,
and the fourth is the one from §0.

1. **Multi-component is NOT a blocker.** The card reads ".svelte and .vue refuse
   multi-component modules by name" as structural. The real constraint is **one
   component per MODULE**, and multi-**module** composition is already shipped and
   e2e-proven: `demos/composition-kit/src/page.tsrx` imports `Frame`, `Dashboard`,
   `Status` and `Search` across four module boundaries. A sidebar, a thread, and
   two tabbed panes are four modules.
2. **Solid's zero-prop refusal is mechanical.** Every component takes at least one
   prop. A child component always has one.
3. **Two-word events cost real features, not the app.** No `onKeyDown` means no
   Enter-to-send (use implicit form submission, as S10 does), **no keyboard
   shortcuts, no Escape, no Tab-key pane navigation.** Double-click survives via
   S10's `event.detail === 2` idiom. Panes and tabs are clicks and internal state
   — S10's filter is the precedent, and there is no routing construct anyway.
4. **Streaming is the one that binds.** By §0:
   - *distinct chunks arriving over time* needs a promise per chunk → **five
     lanes** (PA shape), angular unbuilt;
   - *a fixed, host-supplied set of promises* is six lanes but is not a stream —
     it is N awaits of values the host made before the click, and the S8
     click-armed gate exists because qwik's SSR serializer awaits such props;
   - *a variable-length loop* is unauthorable anywhere, because a write inside a
     loop body is `DEFECTS.md` 8.1.
   - **Navigation during streaming is the strongest part of the ask and it is
     reachable**: the handler suspends across `await`, other handlers still
     dispatch, and S8 already proves two dispatches in flight.
   - Angular additionally has no clock: message timestamps must arrive as props.

**Verdict: buildable-narrowed.** A Codex *shell* — sidebar, thread, right tabs,
bottom tabs, navigation while a scripted stream runs — in five lanes, with
angular's verbatim refusal recorded, and with keyboard interaction recorded as
UNSPELLABLE rather than quietly dropped. **If T004's budget is consumed before
the shell stands, the capability list in this note is the deliverable and that
is a legitimate close.** Do not stretch to keep the app alive.

---

## 3. THE NAMED VISUAL REFERENCE, and how a Worker compares against it

**Disclosure first, because the card asked for browsing.** This harness gave me
`Read` and `Bash` only — no web tool. I did not browse. The reference below is
settled from **upstream bytes already vendored in-repo with recorded
provenance**, which is stronger evidence than a screenshot of a website anyway.

### The reference

> **`todomvc-app-css@2.4.3`**, vendored verbatim at
> `demos/shared/todomvc-app-css/index.css` from
> `https://registry.npmjs.org/todomvc-app-css/-/todomvc-app-css-2.4.3.tgz`, with
> its MIT `LICENSE` beside it —
> **plus the shipped `/todomvc` page at HEAD as the rendered ground truth.**

TodoMVC Advanced **extends** it. No second external reference is needed and none
is obtainable: there is no upstream "TodoMVC Advanced" stylesheet, and the
controls Advanced adds (search field, local/remote selector, spinner, revert
indicator, per-row pending) have no canonical artwork anywhere.

The second half of that reference is the part worth insisting on. The prior pass
had a stylesheet and still lost three of five visual features, because it
compared **class names** against **a list**. Advanced has something better
available: an already-rendered, already-pixel-verified sibling page. Its shared
region must come back **pixel-identical**, which no class census can fake.

### New pixels go in a THIRD stylesheet

`demos/shared/todomvc-app-css/frameless-advanced.css`, copied by the existing
`copy-todomvc-css.mjs` and linked **only** on the advanced route. Rationale:
`/todomvc`'s six byte-identical screenshots are a shipped result, and nothing
that touches `index.css` or `frameless-supplement.css` can leave them
untouched. A third file makes the whole styling step reversible by deletion.

Two rules on its contents:

1. **Every declaration must be traceable to a named selector in vendored
   `index.css`** — the precedent is `frameless-supplement.css`, which re-pointed
   `label` rules onto `.todo-title` and copied the two toggle SVG data URIs
   verbatim. Cite **by selector, never by line ordinal**: `check:citations` bans
   first-party ordinals.
2. **Any pixel that is this repo's own invention must be listed as such in the
   note**, with the reason it has no upstream ancestor. `CANCEL` is the standing
   precedent — recorded as a stand-in, not dressed up.

### The comparison procedure — five steps, in order

1. **Screenshot all six lanes** at 900×900, headless chromium, `colorScheme:
   light`, full page, on the advanced route. Five digests must be **identical**;
   qwik is compared over the app region with `#qwik-inspector-overlay` and
   `#qwik-inspector-info-popup` excluded — they are dev-server chrome outside
   `.todoapp`.
2. **Diff the shared region against `/todomvc`** in the same lane, same data. The
   header, the framed card, the rows and the footer must be pixel-identical. This
   is the ground-truth comparison and it is the one that cannot be argued with.
3. **Assert the five named features ONE BY ONE**, by looking at the image, not at
   the CSS: (a) the flat `#f5f5f5` page with the 550px white card and its layered
   shadow and torn-paper edges; (b) the 80px weight-200 `#b83f45` `todos`
   heading; (c) the **round toggle circle** on each row; (d) the
   **strikethrough** on completed rows; (e) the footer with three filter pills
   and the selected one boxed in red. These are enumerated because the last pass
   lost exactly (c), (d) and the title gutter while every class name checked out.
4. **Diff pixels, never computed styles.** T007's cross-lane divergence — 3614
   pixels, all in the heading — was invisible to every geometry check and was
   `font-family` plus `letter-spacing` inherited differently in three lanes.
5. **Six lanes agreeing is not six lanes being right.** T007 made all six
   identical and all six broken with a single `margin: 0`. Step 2 is what keeps
   step 1 honest.

---

## 4. What T003 must MEASURE rather than inherit — including from this ruling

Before authoring the app, on the **real module**, not on a probe:

1. Emit the authored source to all six lanes and read angular's **verbatim**
   message. If angular unexpectedly emits, ship six and say so.
2. Confirm the promise created in the handler survives each lane's own output
   verification (react/solid/qwik re-analysis, vue `compileScript` in four modes,
   svelte `compile`). Angular verifies nothing — `EMITS` there means only "did not
   throw", so its output must be read, not trusted.
3. Re-derive the vue gate census. `packages/frameworks/vue/src/gate/index.ts`
   carries a shipped refusal asserting a **live count** over "the ten-scenario
   corpus… TWELVE shipped instances… the sugar applies to THREE". An eleventh
   scenario moves both numbers. **Re-measure with an independent script and
   RE-ARGUE the ruling. Do not edit the numbers to fit** — that is exactly what
   T006 was praised for refusing to do.

## 5. The inventory blast radius, enumerated so T003 does not stop where T002 did

The prior board shipped the app and then **stopped**, because `generated/` is an
exactly-asserted inventory in ten-plus per-lane suites and five files sat outside
its envelope. That cost a whole extra card. The eleventh scenario moves the same
surface again:

- the fixture **must** be named `s11-…` and emit `S11.*` — every suite derives its
  inventory from `/^s(\d+)-[\w-]+\.json$/`, and a differently-named artifact is
  rejected by construction in ten-plus suites at once;
- `packages/compiler/test/enriched-ir.test.ts` carries a per-fixture expectation
  map keyed by filename;
- six `scripts/regenerate.ts` fixture lists;
- react and solid `test/size.test.ts` `EMITTED_BUDGETS`;
- solid `test/emitted-typecheck.test.ts` accepted-row list (finding 002 reaches
  any module with a bound input `value`);
- angular `test/emitter.test.ts` `typedInputsSeen`, and `test/parse-emitted.test.ts`;
- vue `test/gate.test.ts` **and** `src/gate/index.ts`, the policy source above;
- six `demos/*/package.json` `copy-emitted` lists — inline `node -e` string arrays;
- six route wirings, one of which (angular) needs a page wrapper because its route
  mounts the emitted component directly and a global `<link>` would restyle the
  nine s1–s9 scenarios `pnpm e2e` compares;
- **the six derived stylesheet copies under `public/`/`static/` are TRACKED files**,
  not gitignored. A third stylesheet adds six tracked copies.

`scripts/e2e.mjs` is deliberately **excluded** from T003's envelope: it pins
`['s1'..'s9']`, and leaving it alone is what keeps `pnpm e2e` at 6 × 9.
