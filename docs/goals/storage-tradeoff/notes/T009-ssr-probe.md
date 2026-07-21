# T009 — SSR + hydration probe (owner-named gap: script-on-render confidence, "especially in cases like ssr")

STATUS: EVIDENCE only. Owner question 2026-07-21: "Would you say you feel
confident with storage function being able to create scripts on render?
Inlining a script? Especially in cases like ssr" — treated as the named next
dig per the T005 loop design. Nothing ratified.

## Setup (executed, zero installs, zero repo writes)

Standalone scratch root (job tmp `probe-ssr/`). React 19.2.7 + react-dom from
a sibling checkout's node_modules (symlinked), **development build** (so
hydration mismatches are loud), **StrictMode** on both server and client,
esbuild-bundled client, real `renderToString` on the server and real
`hydrateRoot` in Chromium headless shell 1228 over HTTP.

App emulates the compiler output for `export const theme = storage('theme',
'light')` under the recommended hydrating-target contract:
- provider renders the compiler-derived seed script as its first child
  (`dangerouslySetInnerHTML` + `suppressHydrationWarning` — the next-themes
  channel, source-confirmed in T008);
- component state initializes to the FALLBACK so server HTML and client
  first render are identical by construction;
- one effect patches from the landing slot (`window.__FRAMELESS_STATE__`)
  after hydration — the Nuxt-style handshake, no second driver read.

## Results — every assertion passed, both cases

SSR output (verbatim head of it):
`<script>(function(){var v;try{v=localStorage.getItem("probe-theme")||"light"}...)</script><main id="out">theme: light</main>`

| assertion | cold | stored `dark-from-storage` |
|---|---|---|
| inline seed script present in `renderToString` output | PASS | (same render) |
| SSR content renders fallback (server can't read localStorage) | PASS | (same render) |
| root attr correct AT first paint | `light` @20ms | `dark-from-storage` @12ms |
| hydration mismatch / recoverable-error console messages (dev+StrictMode) | ZERO | ZERO |
| patch effect resolved a single value | PASS | PASS |
| client driver reads (landing slot consumed instead) | 0 | 0 |
| content after hydration | `theme: light` | `theme: dark-from-storage` |

## What this retires

- "Script emitted on render works under SSR" — now EXECUTED on our stack
  shape, not just adoption-cited: React renders the inline script into the
  SSR stream, the browser runs it pre-paint, and hydration completes with a
  clean console in the strictest dev configuration.
- The T008 "C3 SSR/hydration path unprobed" ledger line — retired for React.
  The recommended contract's three-part SSR answer is demonstrated end to
  end: visuals correct from first paint (seed → root attr), content
  mismatch-free by fallback-parity, stored value patched exactly once
  post-hydration.
- The landing-slot advantage is now executed on the provider face: zero
  client driver reads (T008 showed next-themes double-reads; the Nuxt-style
  slot eliminates it, and here both faces are combined — provider channel +
  slot handshake — which is the thing only a compiler can do uniformly).

## Honest residue

- Solid SSR not run in this round (Solid's hydration model differs; same
  probe shape applies). Streaming SSR not separately probed — next-themes'
  production deployment covers it by citation only.
- As with T008: this proves the artifact/contract shape, not markless's
  actual emitted output; re-run against real generated bundles at
  implementation time.
- Content that must be CORRECT (not just non-flashing) before hydration
  remains structurally impossible for localStorage under SSR — the cookie
  driver (Nuxt precedent) is the only fully-truthful-server option; unprobed.

Probe files: job scratch `probe-ssr/{app.js,client.js,run.mjs}`; the table
above is the receipt (scratch is ephemeral).
