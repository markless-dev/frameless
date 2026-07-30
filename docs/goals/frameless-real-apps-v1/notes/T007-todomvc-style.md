# T007 — the six TodoMVC sites made to LOOK like TodoMVC

Worker receipt long-form. Everything below is MEASURED in this working tree at
`6f454dc`, in a real headless Chromium at 900×900, `colorScheme: light`. Nothing
is inherited from the dispatch — including the dispatch's central claim, which was
wrong.

---

## 0. THE DISPATCH'S CENTRAL CLAIM IS FALSE, AND IT COST THREE OF THE FIVE THINGS THE OWNER NAMED

The card and the vendored README both say:

> The emitted TodoMVC uses the real class names — todoapp, header, new-todo, main,
> toggle-all, todo-list, view, toggle, edit, destroy, footer, todo-count, filters,
> clear-completed — and PM CONFIRMED every one is covered by the stylesheet. So the
> stylesheet should apply AS-IS.

Every one of those fourteen classes IS covered. **The list is not the markup.** The
emitted TodoMVC carries **seventeen** classes. The PM flagged three of the extra
four — `new-todo-form`, `edit-form`, `cancel-edit` — as the risk to watch, and
missed the fourth:

```
$ grep -n 'className=' packages/frameworks/react/generated/S10.tsx
170:  className="todo-title"
```

`todo-title` is the class on the element that **holds the todo's text**. Canonical
TodoMVC puts that text in a `<label>`, and `index.css` hangs **three separate
things** off `label` selectors:

| index.css | what it draws | matched by the emitted markup? |
| --- | --- | --- |
| `.todo-list li label` (line 213) | the title's 60px left gutter, colour, block layout | **NO** |
| `.todo-list li.completed label` (line 223) | **THE STRIKETHROUGH** | **NO** |
| `.todo-list li .toggle + label` (line 199) | **THE ROUND TOGGLE CIRCLE** | **NO** |

The circle is the sharpest of the three, because `.todo-list li .toggle` is itself
`opacity: 0` (line 195). The checkbox is deliberately invisible and the *adjacent
label* carries an SVG data-URI background in its place. With `index.css` alone
there is no label, so there is **no circle at all** — only an invisible 40px hit
area — and the title text collides with the space it should have left for it.

The owner named five things. `index.css` alone delivers the framed white card and
the giant thin heading, and **fails the round toggle circles, the strikethrough,
and the title layout**. The `<form>` wrappers the card warned about are real but
were the *smaller* problem.

None of this is repairable in the authored source. The `<button>` is a MEASURED
svelte refusal recorded by T002 §3.6 — `<label>{todo.title}</label>` is rejected
with `a11y_label_has_associated_control` and the `<span>` alternative with
`a11y_no_static_element_interactions`. So the repair goes where the card said it
should if it were needed: a separate, clearly-named supplement.

**The adjacent-sibling trick survives unchanged.** The `<button class="todo-title">`
sits in exactly the DOM position the `<label>` did, so `.toggle + .todo-title` is a
one-character-class substitution, not a re-implementation.

---

## 1. THE SIX-ROW LAUNCH TABLE — every command RUN, every site OPENED

| lane | launch command | URL | looked at |
| --- | --- | --- | --- |
| react | `pnpm --dir demos/react-official dev` | http://localhost:5173/todomvc | ✅ |
| solid | `pnpm --dir demos/solid-official dev` | http://localhost:5173/todomvc | ✅ |
| qwik | `pnpm --dir demos/qwik dev` | http://localhost:5175/todomvc | ✅ on **5176** |
| svelte | `pnpm --dir demos/svelte-official dev` | http://localhost:5173/todomvc | ✅ |
| vue | `pnpm --dir demos/vue-official dev` | http://localhost:5173/todomvc | ✅ |
| angular | `pnpm --dir demos/angular-official start` | http://localhost:4200/todomvc | ✅ on **4200 and 4201** |

React, solid, svelte and vue all bind 5173 and cannot run at once; each was
launched, shot and stopped in turn. **T002 recorded svelte on 5174 — that was the
port vite fell back to while another lane held 5173, not a lane property. Run
alone, svelte binds 5173 like the other three.**

### Two port collisions, both from processes that predate this session

**qwik.** `pnpm --dir demos/qwik dev` is `vite --port 5175 --strictPort` and it
failed, verbatim:

```
> @frameless/demo-qwik@0.0.0 dev
> pnpm copy-emitted && pnpm copy-todomvc-css && vite --port 5175 --strictPort
error when starting dev server:
Error: Port 5175 is already in use
    at Server.onError$1 (…/vite@7.3.1/…/config.js:14933:28)
```

The holder is **PID 64413**, `vite preview --port 5175 --strictPort`, elapsed
**3 days 9 hours**. It is the same process T002 recorded and it was NOT killed. The
lane was verified with the same vite on `--port 5176`.

**angular.** `pnpm --dir demos/angular-official start` failed with

```
An unhandled exception occurred: Port 4200 is already in use. Use '--port' to specify a different port.
```

The holder is **PID 96248**, `ng serve (angular-official)`, elapsed **1h02m** at
first contact — it predates this session too, so it was not killed. It is an
instance of this very command, it hot-rebuilt these changes, and it served them; it
was measured. The command was then ALSO run cleanly as
`pnpm --dir demos/angular-official start --port 4201` and shot again. **Both
angular screenshots are byte-identical to each other and to the other four lanes.**

---

## 2. THE SIX ROWS — what is actually on the screen

Full-page screenshots at 900×900. Every row below is what the image shows, not what
the CSS says.

| lane | what the page looks like |
| --- | --- |
| **react** | A giant thin **red `todos`** (80px, weight 200, `#b83f45`) centred at y≈44 over a flat **`#f5f5f5` grey** page. Below it a **550px white card**, centred, y 130–356, with the layered TodoMVC drop-shadow and the two stacked "torn paper" edges under the footer. Top row: a grey **`❯` chevron** at the left, then italic grey placeholder **"What needs to be done?"** at 24px. Two rows follow. Row 1 **"Taste JavaScript"**, **struck through in `#949494`**, with a **green ✓ inside a circle** at the left. Row 2 **"Buy a unicorn"** in dark `#484848`, with an **empty grey circle**. Footer: **"1 item left"** left, three filter pills **All / Active / Completed** centred with **All boxed in red**, **"Clear completed"** right. No destroy × until hover. Zero console errors. |
| **solid** | **Byte-identical PNG to react** (`7cc6b3ee…`). Same heading, same card, same two circles, same strikethrough, same footer. |
| **qwik** | **Identical to react over the whole app region** — 0 differing pixels above y=420 apart from a 4×4 blue dot at (175,396), *below* the card. The only other difference is a black rounded pill reading **`Click-to-Source: Alt`** in the bottom-right corner. Both are `#qwik-inspector-overlay` / `#qwik-inspector-info-popup`, fixed-position dev-server chrome injected by `vite dev`, outside `.todoapp`. **Not a styling divergence.** |
| **svelte** | **Byte-identical PNG to react** (`7cc6b3ee…`). |
| **vue** | **Byte-identical PNG to react** (`7cc6b3ee…`). |
| **angular** | **Byte-identical PNG to react** (`7cc6b3ee…`), on both 4200 and 4201. |

### Edit mode, shot separately in every lane

Double-clicking row 2's title puts the row in `editing`: the `.view` is replaced,
an inset **edit input** appears indented 43px from the left with the todo's text at
24px, the row's bottom border is gone, and a small uppercase grey **`CANCEL`**
sits inside the input's right edge. **All six editing screenshots are identical
over the app region** (`c92c5deb…` for five; qwik 0 differing pixels above y=420).

`CANCEL` is **not part of canonical TodoMVC**. It is T002's stand-in for the Escape
key, which is unspellable in every lane because no emitter can produce a two-word
DOM event name. Stated plainly rather than dressed up.

---

## 3. THE DIVERGENCE THE SCREENSHOTS CAUGHT AND EVERY COMPUTED-STYLE CHECK MISSED

The six lanes did **not** look the same on the first pass. Three PNG digests came
back, not one:

```
7cc6b3ee…  angular, svelte
a4a48301…  react, solid, vue
8704233a…  qwik
```

A pixel diff put **3614 differing pixels between react and angular, all of them in
rows 25–83** — the heading. The computed geometry was identical: same rect, same
80px, same weight 200, same `#b83f45`, same `text-rendering`. The difference was a
property nobody had thought to read:

```
react   h1 fontFamily: system-ui, "Segoe UI", Roboto, sans-serif   letterSpacing: -1.68px
angular h1 fontFamily: "Helvetica Neue", Helvetica, Arial, …       letterSpacing: normal
```

`index.css` gives `.todoapp h1` a size, a weight, a colour and a text-rendering
hint and **no font-family**, because canonical TodoMVC lets the heading inherit
`body`'s Helvetica Neue stack. **Inheritance loses to any rule.** So
`react-official/src/index.css`'s `h1, h2 { font-family: var(--heading) }` and
`h1 { letter-spacing: -1.68px }` both won — in three lanes, and not the other
three. The giant `todos` was rendering in **system-ui at -1.68px tracking** in
react/solid/vue and in **Helvetica Neue at normal tracking** in qwik/svelte/angular.

Fixed by `.todoapp h1 { font-family: inherit; letter-spacing: normal }`.

### And a second one, from over-correcting

The same `h1` rule needed `margin` neutralised — the scaffolds ship
`h1 { margin: 32px 0 }` and `index.css` sets no margin. The first attempt was
`margin: 0`. That rendered all six lanes **identically and all six wrong**: the
heading is absolutely positioned at `top: -140px` inside a card whose top is at
130px, so its margin box starts at **-10px** and only the UA default
`h1 { margin: 0.67em 0 }` — 53.6px at this font size — drops it into view. With
`margin: 0` the word `todos` was sheared off by the top of the viewport in every
lane. **Six lanes agreeing is not the same as six lanes being right**; only opening
the screenshot caught it. The shipped value is `0.67em 0`.

---

## 4. WHAT WAS BUILT

### `demos/shared/todomvc-app-css/frameless-supplement.css` — NEW, this repo's own

The vendored `index.css` was **not touched**: `git diff HEAD` on it and on
`LICENSE` is empty. The supplement loads **after** it and does two jobs.

**(A) The four non-canonical elements.**

1. `.todo-title` gets `.todo-list li label`'s own declarations re-pointed, plus the
   four a `<button>` needs and a `<label>` did not (full width, left-aligned text,
   transparent background, pointer cursor); `.todo-list li.completed .todo-title`
   restores the strikethrough; `.toggle + .todo-title` and
   `.toggle:checked + .todo-title` restore the two circle artworks. **The two SVG
   data URIs are copied verbatim from `index.css` lines 204 and 210** — CSS cannot
   inherit a declaration and the upstream file cannot be edited to add a selector.
   They are the only upstream bytes that exist twice, and the README now records
   that a refresh must re-copy them.
2. `.new-todo-form` / `.edit-form` lose their UA margin; the edit form becomes the
   positioning context for the cancel control.
3. `.cancel-edit` becomes a small uppercase control inside the edit input's right
   edge, and `.edit` gains `padding-right: 72px` to clear it.
4. `.destroy` gets `font-size: 0` with `:after { font-size: 30px }`. The emitted
   button carries the literal text `x` and `index.css` draws the glyph as
   `:after { content: '×' }`, so **without this the button reads `x×`.** The text
   is kept — it is the button's accessible name — and hidden visually.

**(B) Neutralising three host scaffolds.** `react-official/src/index.css`,
`solid-official/src/index.css` and `vue-official/src/style.css` are the create-vite
landing-page stylesheets: `:root` typography and `color-scheme: light dark`,
`body { margin: 0 }`, a `#root`/`#app` **flex column pinned to 1126px with
`text-align: center` and side borders**, and the `h1` rule from §3.
`qwik/src/global.css` is **empty**, `angular-official/src/styles.css` is a single
comment, and svelte-official has **no global stylesheet at all**. Without this
block three lanes render the card left-aligned inside a bordered 1126px column on a
white (or, in an OS dark theme, near-black) canvas, and three do not.

Those rules are written `html:has(.todoapp)`, `body:has(.todoapp)`,
`#root:has(.todoapp)`, `#app:has(.todoapp)` **and that is not cosmetic**. Section
(A) overrides upstream at equal specificity and so depends on load order, which the
paired `<link>`s guarantee. Section (B) cannot lean on that, because it must beat a
**third** stylesheet whose position is not ours to fix: React 19 hoists a `<link>`
rendered anywhere in the tree into `<head>`, while Vite injects `src/index.css`
into `<head>` at module-eval time during hydration, so in that lane the scaffold's
sheet can land *after* ours. `:has()` adds a class to each selector, so section (B)
wins on **specificity** and the outcome stops depending on injection order.

### `demos/shared/copy-todomvc-css.mjs` — NEW

Neither stylesheet is imported by any lane. This script copies **both, in cascade
order**, into a lane's static-asset root, so all six serve them at the identical
URLs `/todomvc-app-css/index.css` and `/todomvc-app-css/frameless-supplement.css`.

Why files rather than an import: five lanes serve `public/`, SvelteKit serves
`static/`, and **angular-official is built by `@angular/build`**, not by a
vite.config this repo controls, so a `?url` import of a path outside the project
root is not available in every lane. A real file under each asset root is the only
uniform shape — and the only way to have six of them without six things to
maintain is to derive them, exactly as `copy-emitted` already does.

Each lane gained a `copy-todomvc-css` script chained ahead of `dev` / `start` /
`build` beside `copy-emitted`.

### Six route wirings, and one new Angular wrapper

The stylesheet is linked **only on `/todomvc`**, in all six lanes. `index.css`
restyles `body` and every `button` in the document, so a global link would move the
geometry of the nine `s1`–`s9` scenarios that `pnpm e2e` compares across six lanes.

Five lanes had a route wiring to put the two `<link>`s in. Angular did not: its
`/todomvc` route mounted the emitted `TodoMvc` directly, and the only global
alternatives were `src/index.html` and angular.json's `styles` array. So
`src/app/todomvc-page.ts` was added — it renders the emitted
`<frameless-todo-mvc>` and two `<link>` elements and nothing else. **The precedent
is `src/app/async-gate.ts`**, the lane's existing wrapper, and this is host wiring
in exactly the sense T002 used the word: no emitted output was edited and no
per-lane app code was written.

---

## 5. DERIVATION, ASSERTED

The twelve derived CSS copies were **deleted** and rebuilt by each lane's own
`pnpm copy-todomvc-css`. All twelve came back byte-identical to the two sources:

```
   7 a7ebe511…   frameless-supplement.css   (6 copies + the source)
   7 c7dd5d13…   index.css                  (6 copies + the source)
```

The authored source was **not touched**, so T002's twelve-artifact rebuild was not
re-run: `packages/compiler/test/fixtures/s10-todomvc.tsrx`, the six goldens'
`generated/S10.*` and the six `demos/*/…/TodoMvc.*` are all unmodified in
`git status`. This card changed no emitted byte.

---

## 6. VERIFICATION

| command | status | evidence |
| --- | --- | --- |
| `pnpm check` | **pass** | **exactly 267**, unchanged. The supplement adds no TypeScript; `todomvc-page.ts` adds none either. |
| `pnpm e2e` | **pass** | `Three-way: 6 demos x 9 scenarios, all observations equal` — unmoved |
| `pnpm lint` | **pass** | 0 warnings, 0 errors over **455** files (453 + `todomvc-page.ts` + `copy-todomvc-css.mjs`) |
| `pnpm check:citations` | **pass** | clean over 4 documents, 17 watched, 527 swept |
| `pnpm test` | **unchanged** | 1250 passed / 10 failed — **exactly the dispatch baseline**. The 9 are T006's and the 10th is the foreign lockfile ARM B. Nothing added. |
| six sites opened and shot | **pass** | §1, §2 |
| six lanes look the same | **pass** | 5 byte-identical PNGs; qwik 0 differing pixels over the app region |
| derivation proof | **pass** | §5 |

Protected paths fingerprinted at start AND finish, unchanged:
`f326d314…` / `aeb7edc1…` / `f936e169…`, `website/` 116 files.

---

## 7. WHAT A FOLLOW-UP SHOULD KNOW

1. **The `:has()` rules in section (B) are load-bearing and fragile to a rewrite.**
   Anyone who "simplifies" them back to bare `:root` / `#root` selectors will
   silently re-break react, solid and vue only, and only after hydration.
2. **TodoMVC is still not wired into `pnpm e2e`** — that stays 6 × 9. If a later
   card wires it, the `<link>`s will start appearing in a compared payload and the
   three-way contract will need a ruling on whether that counts as an observation.
3. **The two SVG data URIs are duplicated** between `index.css` and the supplement.
   The README records the obligation; nothing enforces it.
4. **`text-rendering`, `font-synthesis` and `-webkit-font-smoothing` are pinned on
   `html:has(.todoapp)` although they moved no pixel today.** They are pinned
   because §3 showed exactly how an unpinned inherited typography property behaves:
   invisible until a longer string renders.
