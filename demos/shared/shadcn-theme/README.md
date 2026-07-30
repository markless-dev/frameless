# shadcn/ui default theme, vendored

The token layer behind `S12` — the Codex clone — plus this repo's own component
sheet for it. Same shape and same discipline as `demos/shared/todomvc-app-css/`:
upstream bytes are verbatim and are not editable; the file this repo wrote is
named and is the only one that may change.

## Files

| file | origin | editable |
|---|---|---|
| `theming-default.css` | **UPSTREAM, VERBATIM.** The complete "Default Theme CSS" block from the shadcn/ui theming docs. | **no** |
| `LICENSE` | **UPSTREAM, VERBATIM.** `shadcn-ui/ui/LICENSE.md`. | **no** |
| `codex.css` | **This repo's own.** Hand-written against the vendored token names. | yes |
| `tokens.css` *(not here — derived per lane)* | Written into each lane's asset root by `demos/shared/copy-shadcn-theme.mjs` from `theming-default.css`. | n/a |

## Provenance, verified at source

- **Source URL**:
  `https://raw.githubusercontent.com/shadcn-ui/ui/main/apps/v4/content/docs/(root)/theming.mdx`
  — the file behind <https://ui.shadcn.com/docs/theming>.
- **Commit**: `6a070bf8c5a248270258ed7284efe4d5892f4528` (2026-03-25).
- **`theming.mdx` sha256**: `403a71fea629dd9d5eebdf3656baab6b8550972adfb4fc5ed0847d13b3dc73f0`.
- **`theming-default.css` sha256**: `c99bf9c3912c7b6c5456043ef451190db79326de6c378f3fccf01894febb77a7`
  — the fenced ` ```css ` block under the `## Default Theme CSS` heading, extracted
  whole and unmodified.
- **Licence**: MIT, "Copyright (c) 2023 shadcn". `LICENSE` here is
  `https://raw.githubusercontent.com/shadcn-ui/ui/main/LICENSE.md`, fetched and read
  in full rather than assumed.

### NOT `apps/v4/app/globals.css`

That file is the **docs site's own theme**, not the documented default, and the
difference is visible: `--foreground` is `oklch(0% 0 0)` there against
`oklch(0.145 0 0)` here, `--primary` likewise, and its `--chart-*` tokens are rebound
to `var(--color-blue-300…800)`. It also carries `--surface`, `--code*`, `--selection*`
and `--destructive-foreground`, none of which the default theme declares. It is the
most obvious file to reach for and it is the wrong one.

## Why `tokens.css` is derived rather than copied

The upstream block is **not a browser stylesheet**. It opens with
`@import "tailwindcss"`, declares its radius scale inside `@theme inline`, and closes
with a `@layer base` block of `@apply` rules. A browser drops an unknown at-rule and
everything inside it, so linking these bytes directly would define **none** of
`--radius-sm/md/lg/xl` — silently, with no error. `copy-shadcn-theme.mjs` therefore
lifts the `:root` and `.dark` declaration blocks through unchanged and moves the
`--radius-*` scale out of `@theme inline` into `:root`. It copies declaration TEXT and
computes no value, and it throws rather than emitting a partial file.

## Referenced but NOT vendored

Two more sources are named on the card that ordered this work. Neither contributed a
byte to this directory, and both are recorded so a reader can check that claim.

- **shadcn/ui block `sidebar-07`** — the rail's layout reference. MIT, same repo and
  the same licence as the tokens above. Nothing copied: the rail's geometry here is
  numbers measured off a rendered page.
- **Vercel AI Elements** (`github.com/vercel/ai-elements`), the `conversation`,
  `message` and `prompt-input` families — the thread and composer layout reference.
  **APACHE-2.0, "Copyright 2023 Vercel, Inc." — a DIFFERENT licence from the MIT layer
  above, attributed separately for that reason.** Nothing copied.
- **Square UI** (`zerostaticthemes/square-ui`) was named by this repo's owner and is
  **excluded on licence**: it ships a bespoke "ln-dev UI License" (c) 2026 lndev,
  which GitHub classifies `NOASSERTION` and which forbids publishing the templates or
  any derivative in any repository. Frameless is public. Nothing from that repository
  has ever been fetched, cloned, copied or vendored here.

All three references are Tailwind + React. Frameless emits plain markup into six
lanes, so their code could not have been copied even where the licence allowed it.
What is reproduced is the RESULT, on the MIT token layer, from measured numbers.
