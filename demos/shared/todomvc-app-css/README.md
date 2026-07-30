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

## How the lanes load them

Neither file is imported by any lane. `demos/shared/copy-todomvc-css.mjs` copies **both, in
cascade order**, into each lane's static-asset root — `public/todomvc-app-css/` in five lanes,
`static/todomvc-app-css/` in SvelteKit — so all six serve them at the identical URLs
`/todomvc-app-css/index.css` and `/todomvc-app-css/frameless-supplement.css`. Each lane's
`copy-todomvc-css` script runs it, chained ahead of `dev` / `start` / `build` beside
`copy-emitted`. The six copies are **derived, never hand-kept**: delete them, re-run, compare
digests.

Only the `/todomvc` route links them. `index.css` restyles `body` and every `button` in the
document, so a global link would move the geometry of the nine `s1`–`s9` scenarios that
`pnpm e2e` compares across six lanes.
