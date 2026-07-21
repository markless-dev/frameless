# T008 — Owner-continued dig round: browser proof + winner internals

STATUS: EVIDENCE only. Owner response 2026-07-21 to the refreshed menu: "Not
deciding yet — name the next dig" (no specific unknown named). Per the T005
loop design the PM selected the two unknowns T007 itself flagged as its
weakest evidence: (a) the real-browser seed-ordering proof (previously
env-blocked, evidence spec-inferred only) and (b) the winner-internals source
read (the "two faces of one contract" amendment was adoption-inferred, and
T007's misfire self-check named it the highest decision-reading risk).
Nothing here is ratified.

## A. Real-browser seed-ordering probe — EXECUTED, all assertions pass

The T007 env triangle was sidestepped by building the probe in a standalone
scratch root outside every repo (job tmp dir), using `playwright-core` 1.61.1
from a sibling checkout's node_modules and the locally cached Chromium
headless shell 1228 — no installs, no repo writes.

Artifact emulated (the shape all suggestions generate): sync classic inline
seed script in `<head>` (reads localStorage with try/catch fallback, sets
`data-theme` on `<html>`, writes landing slot `window.__FRAMELESS_STATE__`),
then body content, then three runtime-chunk stand-ins: an ESM `type="module"`
chunk, a classic body-end chunk, and a **late progressive chunk** injected
50ms after `load` (the markless progressive-execution case). Served over HTTP,
paint timing via buffered `PerformanceObserver({type:"paint"})`.

Results (Chromium headless shell 1228, two contexts):

| case | seed ran | first paint | attr at first paint | module chunk saw | late progressive chunk saw |
|---|---|---|---|---|---|
| cold (no stored value) | 13.5ms | 32ms | `light-fallback` | attr + landing slot | landing slot |
| stored `dark-from-storage` | 2.7ms | 12ms | `dark-from-storage` | attr + landing slot | landing slot |

All 7 assertions passed in both cases: seed executed before first paint;
root attribute already correct **at** first paint (no-flash confirmed with the
stored value, honest fallback confirmed cold); seed ordered before the module
chunk, the classic chunk, and the late progressive chunk; the landing slot was
visible to every chunk class including the progressive one.

What this retires: the "browser chunk-ordering — spec-inferred only" unknown
from T003/T007. The mechanism class every option relies on is now
**executed-browser proven** for all three chunk-delivery shapes markless and
frameless targets use (deferred ESM, classic, late-injected progressive).

Honest residue: this proves the **artifact shape**, not markless's actual
emitted output — the real generated bundle should re-run this probe when an
implementation exists. That is an implementation-phase check, no longer a
decision-blocking unknown.

Probe files: job scratch `probe/page.html` + `probe/run.mjs` (transcript in
session log; scratch dir is ephemeral — the table above is the receipt).

## B. Winner internals — source read (npm tarballs, executed)

next-themes@0.4.6 and @nuxtjs/color-mode@4.0.1 fetched via `npm pack` and
read in full. T006's web half was adoption-cited; this is what the code
actually does.

### next-themes@0.4.6 (dist/index.mjs — entire package is one file)

- **The seed script is rendered in-place by the provider, not head-injected.**
  The provider renders `<script dangerouslySetInnerHTML>` as its FIRST CHILD,
  before `children`. This is byte-for-byte the Qwik UI themes shape
  (provider + pre-slot sync script) — the two ecosystems' winners converged on
  the identical injection channel, which T006 could not see from adoption data.
- The inlined script is a serialized function (`(${M.toString()})(${args})`)
  — args JSON-baked per provider props (attribute, storageKey, defaultTheme,
  themes, nonce). Reads `localStorage.getItem(key) || default` in try/catch,
  resolves `system` via matchMedia, sets class/data-attr + `colorScheme` on
  `documentElement`. `suppressHydrationWarning` on the script; nonce emitted
  only during SSR.
- **No landing slot — the runtime re-reads storage independently**:
  `useState(() => localStorage.getItem(key) || default)` duplicates the seed's
  resolution logic in a second implementation inside the same package (script
  fn vs hook init + separate matchMedia helper). Two copies that must be kept
  manually in sync — the exact divergence class a compiler-derived single
  source eliminates.
- **CORRECTION to T007's four-axis claim: next-themes HAS cross-tab sync**
  (`window.addEventListener("storage", ...)` re-setting theme on key change).
  "Sync universally absent" must be softened to "inconsistently present":
  the React winner has it, the Vue winner does not, the corpus (except
  Qwik UI) does not. Keys/consent/flash axes stand unchanged: default
  storageKey `"theme"` unnamespaced; zero consent gating (unconditional read
  in both the seed and the hook initializer).

### @nuxtjs/color-mode@4.0.1

- **The seed is a build-time template — a mini-compiler.** `script.min.js`
  ships with `<%= options.storage %>`-style placeholders; module setup
  substitutes config values (storage driver, storageKey, preference, fallback,
  classPrefix/Suffix, dataValue, globalName) into the script at build
  (module.mjs:127-129) and injects it into `<head>` via a nitro
  `render:html` hook (nitro-plugin.js:4). Statically-known keys/driver/
  fallback baked into the artifact at build — production precedent for
  exactly the compiler-generated-seed thesis.
- **The seed writes a landing slot and the runtime consumes it — our P1
  design, in production at ecosystem scale.** The seed computes value, mutates
  `<html>`, then sets `window.__NUXT_COLOR_MODE__ = {preference, value, ...}`
  (script.min.js); the client plugin initializes its reactive state FROM the
  slot: `let helper = window[globalName]` →
  `useState(... {preference: helper.preference, value: helper.value})`
  (plugin.client.js:4,17-23). No double-read, no duplicated resolution logic —
  the structural fix next-themes lacks.
- Driver is build-selectable (localStorage/sessionStorage/cookie); cookie
  exists so SSR can render the attribute server-side (plugin.server.js:12-17)
  — the one driver a server can read. Default key `"nuxt-color-mode"`
  (namespaced by convention). No consent gate. **No cross-tab sync.**
- Both winners use the identical disable-transition trick (inject `*{transition:none}`
  style, force reflow via getComputedStyle, remove).

### What this does to the "two faces of one contract" amendment

CONFIRMED at source level, sharpened: both winners generate the same artifact
triple — (1) sync seed script that reads driver → resolves system → mutates
root before content paint; (2) a reactive cell initialized from the seeded
result; (3) write-back + root-attr maintenance on change. The faces differ
only in enablement channel (provider-rendered-before-children vs
build-substituted + head-injected) — and each face has a production winner.
The amendment is no longer a synthesis inference; it is an observed fact
about the two ecosystems' winning implementations.

Bonus asymmetry the source read exposed: the build face (Nuxt) achieved the
landing-slot handshake and static key baking; the provider face (next-themes)
did not (double-read, duplicated logic). A compiler owning BOTH faces can give
the provider face the build face's internals — which no library in either
ecosystem can do.

## Updated unknowns ledger (delta from T007 §4)

- ~~Browser chunk-ordering~~ — RETIRED for the artifact shape (executed, all
  chunk classes incl. progressive). Residue: re-run against real markless
  emitted output at implementation time.
- ~~next-themes internals cited-only~~ — RETIRED (source read; corrections
  banked above).
- Key stability across renames/aliases/versions — still open (now with two
  data points: winners ship `"theme"` and `"nuxt-color-mode"` as defaults;
  neither has a stability story beyond "user may override the string").
- SQLite/async-driver lifecycle — still open; Nuxt's cookie driver adds a
  data point (driver choice can change WHERE seeding is even possible:
  cookie = server-side seed, no client script needed for SSR).
- Facade timing — unchanged (cross-repo, fixing-board-gated).
- C3 SSR/hydration path — partially informed (both winners' SSR answers now
  documented: suppressHydrationWarning + client re-read vs cookie +
  server-rendered attr) but unprobed for our stack.

## Misfire self-check

Owner has ratified nothing; this round only converts two inferred evidence
lines into executed/source-read evidence and issues one correction against
our own prior claim (sync axis). The menu ordering from T007 is NOT restated
here as strengthened-by-default — the sync correction cuts slightly AGAINST
the compiler-advantage statement (one of its four axes weakens to
"inconsistent"), and that is recorded rather than smoothed over.
