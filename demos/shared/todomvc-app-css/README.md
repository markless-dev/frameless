# todomvc-app-css (vendored)

`index.css` is **todomvc-app-css@2.4.3**, verbatim, from
`https://registry.npmjs.org/todomvc-app-css/-/todomvc-app-css-2.4.3.tgz`.
`LICENSE` is its MIT licence, shipped alongside as that licence requires.

## Why vendored rather than a dependency

Two measured reasons.

1. **Worker sandboxes have no network.** A dependency would make every future task that
   touches these demos require a PM pre-install. A stylesheet is a static asset, not logic.
2. **`pnpm-lock.yaml` currently carries the owner's uncommitted `website/` work.** Adding a
   dependency rewrites that file. Vendoring touches nothing outside this directory.

## Do not edit it

This file is **upstream bytes**. If something looks wrong, the fix goes in
`frameless-supplement.css` beside it, never here.

## It does NOT apply as-is — `frameless-supplement.css` is why

The emitted TodoMVC markup uses fourteen canonical class names — `todoapp`, `header`,
`new-todo`, `main`, `toggle-all`, `todo-list`, `view`, `toggle`, `edit`, `destroy`, `footer`,
`todo-count`, `filters`, `clear-completed` — and every one of them is covered here.

**That list is not the whole markup, and the omission was load-bearing.** The emitted markup
also carries `new-todo-form`, `edit-form`, `cancel-edit` and — the one that matters —
**`todo-title`**, which is a `<button>` standing where canonical TodoMVC has a `<label>`.
`index.css` hangs the title's 60px gutter, **the completed strikethrough**, and **the round
toggle circle** off `label` selectors, so with `index.css` alone all three are simply absent.
Measured in all six lanes; see
`docs/goals/frameless-real-apps-v1/notes/T007-todomvc-style.md`.

`frameless-supplement.css` re-points those rules at `.todo-title`, repairs the three other
non-canonical elements, and neutralises the create-vite landing-page CSS that three of the six
host scaffolds ship. It is **this repo's own file**, MIT like the rest of the workspace, and it
is the only file in this directory that may be edited.

## Refreshing `index.css`

```
curl -sL https://registry.npmjs.org/todomvc-app-css/-/todomvc-app-css-2.4.3.tgz | tar -xzO package/index.css > index.css
```

**If you do, re-copy the two toggle-circle data URIs into the supplement.** CSS cannot inherit
a declaration and `index.css` cannot be edited to add a `.todo-title` selector, so those two
`background-image` values are duplicated in `frameless-supplement.css`. They are the only
upstream bytes that exist twice, and a refresh that changes the artwork would otherwise leave
the checked/unchecked circles stale.

## `frameless-advanced.css` — the THIRD file, for TodoMVC **Advanced**

Added by `frameless-app-suite-v1` T003 for the `/todomvc-advanced` route, and **also this
repo's own file**, editable like the supplement. It carries the controls the advanced app adds
and that canonical TodoMVC has no artwork for at all — a search field, a local/remote result
pair, a sync status line, a server-failure control, and the per-row `saving` state an
optimistic update needs.

**It is a third file rather than more rules in the supplement, and that is deliberate.**
`/todomvc`'s six byte-identical screenshots are a shipped result, and nothing that edits
`index.css` or `frameless-supplement.css` can leave them untouched. A separate sheet linked
only on the new route makes the advanced styling reversible by deletion.

Its header records, per selector, which declarations are traceable to a named selector in
vendored `index.css` and which are **this repo's own inventions** — the bar itself, the
`saving` row state, and the server-failure control. The amber "in flight" colour is a
convention, not a measurement, and is recorded as such.

### Three rules in it are **not cosmetic**, and all three came out of a rendered image

Upstream gives `.toggle-all + label` `position: absolute; top: -65px`, so the toggle-all
chevron reaches 65px **above** `.main`. In canonical TodoMVC that lands inside `.header`, at
the left of the new-todo input. On `/todomvc-advanced` the element 65px above `.main` is the
new bar, and that one declaration caused all three:

1. **`.advanced { z-index: 3 }`** — upstream also gives `.main` `z-index: 2`, so a tie loses on
   document order. Measured in a browser by T003: at `z-index: 2` the bar's own controls were
   visible, enabled and **unclickable**, because the chevron's invisible 45×65 hit area sat on
   top of them.
2. **`.todoapp-advanced .main { position: static }` with `.toggle-all + label { top: 1px }`** —
   T005 then found that raising the bar had made the chevron **invisible**: it was being
   painted underneath. The repair changes the label's *containing block* rather than its
   offset, so the bar's height is not hard-coded into a second place. `1px`, not `0`, because
   an absolute offset resolves against the containing block's **padding** box and `.main`
   carries a `border-top` that `.todoapp` does not — `top: 0` was tried first and left the
   chevron one pixel high.
3. **Every length in `.advanced` is an integer** — `line-height: 1.4em` at 14px is 19.6px, which
   made the bar 198.765625px tall and put the footer, the torn-paper sheets and the card's
   bottom edge on a **different subpixel phase** from the `/todomvc` page they are asserted
   identical to: 17976 differing pixels. The bar is now exactly 201px.

**None of the three is visible in a stylesheet review, and that is the point.** All were found
by screenshotting both routes on identical data at 900×900 and diffing them, per the T007
precedent. See `docs/goals/frameless-app-suite-v1/notes/T005-advanced-style.md`.

## How the lanes load them

No file here is imported by any lane. `demos/shared/copy-todomvc-css.mjs` copies **all three,
in cascade order**, into each lane's static-asset root — `public/todomvc-app-css/` in five
lanes, `static/todomvc-app-css/` in SvelteKit — so all six serve them at the identical URLs
`/todomvc-app-css/index.css`, `/todomvc-app-css/frameless-supplement.css` and
`/todomvc-app-css/frameless-advanced.css`. Each lane's `copy-todomvc-css` script runs it,
chained ahead of `dev` / `start` / `build` beside `copy-emitted`. The copies are **derived,
never hand-kept**: delete them, re-run, compare digests.

**All three land in all six lanes, including the one that cannot link the third.** The angular
lane has no `/todomvc-advanced` route at all, because the angular emitter refuses S11 on its
global-identifier ban. Copying uniformly keeps "delete the copies, re-run, compare digests" a
single check; making one lane conditional would trade a real invariant for one unserved file.

Only the `/todomvc` route links the first two, and only `/todomvc-advanced` links all three.
`index.css` restyles `body` and every `button` in the document, so a global link would move the
geometry of the nine `s1`–`s9` scenarios that `pnpm e2e` compares across six lanes.
