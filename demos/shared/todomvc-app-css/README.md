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

This file is **upstream bytes**. The emitted TodoMVC markup already uses the canonical class
names — `todoapp`, `header`, `new-todo`, `main`, `toggle-all`, `todo-list`, `view`, `toggle`,
`edit`, `destroy`, `footer`, `todo-count`, `filters`, `clear-completed` — so the stylesheet
applies as-is. If something looks wrong, **the markup is wrong, not this file**; fix the
authored `.tsrx` and regenerate.

Refresh with:

```
curl -sL https://registry.npmjs.org/todomvc-app-css/-/todomvc-app-css-2.4.3.tgz | tar -xzO package/index.css > index.css
```
