# T005 — DX Research: implicit vs explicit keys for client-side persistence

**Task:** Evaluate markless's identifier-derived storage key (`storage('light')` ->
`markless:theme`) against how the wider ecosystem handles implicit vs explicit
persistence keys, and return a concrete keep/adjust/replace recommendation plus a
verdict on the rename footgun.

**Method:** Surveyed the current (2025/2026) docs/source of the mainstream
client-persistence libraries and the two build-time-derivation precedents that
actually exist (CSS Modules `localIdentName`, TanStack Query `buster`). Sources
are cited inline and collected at the bottom. This is a read-only research
artifact — no product code was touched.

---

## 1. Ecosystem survey — comparison table

Every widely-used client-persistence primitive I checked **requires an explicit,
author-supplied key**. Not one derives the storage key from the JS binding
identifier. The reason is uniform: **persistence identity must outlive the code
that produced it**, so it is deliberately decoupled from anything a refactor or a
minifier can change.

| Library | Key: explicit or derived? | How it's supplied | Namespaced by default? | Rename-safety |
|---|---|---|---|---|
| **Zustand `persist`** | **Explicit, required** | `persist(fn, { name: 'food-storage' })` — `name` is the only required option, "must be unique" | No (raw `name`) | Safe — key is a string literal unrelated to the store variable; rename the `useBearStore` const and the key is untouched |
| **Jotai `atomWithStorage`** | **Explicit, required** | `atomWithStorage('darkMode', false)` — `key` is param #1, "a unique string" | No | Safe — key decoupled from the `darkModeAtom` binding |
| **VueUse `useStorage`** | **Explicit, required** | `useStorage('my-count', 0)` — key is param #1 | No | Safe — decoupled from the ref variable |
| **nanostores `persistentAtom`** | **Explicit, required** | `persistentAtom('locale', 'en')`; `persistentMap` takes a **key prefix** e.g. `'settings:'` | Optional prefix on `persistentMap` | Safe — decoupled |
| **svelte-persisted-store** | **Explicit, required** | `persisted('preferences', {...})` — key param #1 | No | Safe — decoupled; note maintainers flag that the store shape "no longer feels idiomatic" under Svelte 5 runes (`svelte-persisted-state` is the runes successor, still explicit key) |
| **@solid-primitives/storage `makePersisted`** | **Explicit** (defaults to `"storage"` if omitted) | `makePersisted(createSignal(...), { name: 'testing' })` | No | Safe — `name` decoupled from the signal variable |
| **redux-persist** | **Explicit, required** | `persistConfig = { key: 'root', storage }` | **Yes** — physically stored as `persist:<key>` | Safe — decoupled; `storage` also required or it throws |
| **Legend-State (`syncObservable`)** | **Explicit, required** | `syncObservable(state$, { persist: { name: 'store' } })` | No | Safe — decoupled |
| **TanStack Query `persistQueryClient`** | Key on the persister + **`buster`** version string | `buster: 'MY_APP_v1.2.3'`; stale/`maxAge` discard | n/a (single client blob) | Different problem — solves *migration/invalidation*, not naming; the `buster` idea is directly relevant to markless's migration axis |
| **CSS Modules `localIdentName`** (build-time derivation precedent) | **Derived** from `resourcePath` + `exportName` + content `[hash]` | `[path][name]__[local]--[hash:base64:5]` | Yes (path is in the ident) | Deterministic **only because the compiler owns it**; famously bit people when idents were random across builds (CRA #3972) — fixed by making derivation deterministic |

**Headline finding:** the "identifier becomes the key" ergonomic that markless is
proposing has **zero precedent among runtime libraries** — and that is not an
oversight, it is a deliberate, universal design choice. A runtime library
*cannot* safely derive from the identifier: by the time its function runs, the
variable name may be minified to `a`, and it has no build-time view to bake a
stable literal or diff against the previous build. markless is in a genuinely
different position because it is **compiler-native** — but the ecosystem's
unanimity is a strong signal that identifier-derivation carries a real risk that
must be actively engineered away, not waved off.

The only place derivation-from-code-symbol is done in production is **CSS
Modules**, and it is instructive: it derives from **file path + export name +
content hash**, the compiler owns the whole mapping, and its one historical
scandal was *non-determinism across builds* — exactly the failure markless's
"bake a stable compile-time literal" decision (goal.md #5) is designed to
prevent.

---

## 2. markless `markless:<identifier>` derivation on the 6 DX axes

Scoring the derived-key default (`storage(fallback)` -> `markless:<id>`), with the
explicit escape hatch (`storage('key', fallback)` -> verbatim) available.

### a. Write-time ergonomics — **BEST IN CLASS (this is the whole point)**
`let theme = storage('light')` is the lowest-ceremony persistence primitive in the
survey. Every library above forces you to name the key *and* keep it in sync with
the concept in your head; markless removes that entirely for the common case
(one variable = one preference). This is the differentiator and it is real.
**Verdict: A+ — do not sacrifice this.**

### b. Refactor / rename safety — **WORST AXIS (the core risk)**
This is the exact hazard every other library sidesteps by decoupling. Renaming
`theme` -> `colorScheme` silently moves the key `markless:theme` ->
`markless:colorScheme` and **orphans every existing user's saved value**. It is
silent, it passes tests (fresh state looks fine), and it surfaces only as "why did
everyone's theme reset after the deploy?" in production. Standard IDE rename
refactors and even a linter won't catch it because the code is still valid.
**Verdict: F on its own — this axis is the entire reason the goal.md #6 guard
exists, and it cannot be dropped without a substitute.**

### c. Discoverability / debuggability — **MIXED, leans NEGATIVE**
Positive: the key is human-readable (`markless:theme`, not a hash), so you can eyeball
it in DevTools > Application > Local Storage. Negative: the inverse question —
"what code writes `markless:theme`?" — has **no grep target**, because the string
`"markless:theme"` never appears in source (only `storage('light')` does). In every
explicit-key library, `grep "food-storage"` finds the writer instantly. markless
trades grep-ability for brevity. The compiler-emitted key manifest (below) is what
buys the discoverability back — the manifest *is* the searchable index.
**Verdict: C — recoverable, but only with the manifest.**

### d. Production / minification safety — **SOLVED BY DESIGN (if enforced)**
The naive version of this feature is catastrophic: derive the key from the
runtime identifier and it becomes `markless:a` after Terser mangles `theme` to
`a`, differing per build. goal.md #5 ("bake the derived key as a stable
compile-time literal, never from a mangled name") is precisely the fix, and it is
only possible *because* markless is a compiler. This must be treated as a hard
invariant with a test: a minified build must still produce `markless:theme`.
**Verdict: A — provided the baked-literal rule is enforced by test, which the
goal oracle already requires.**

### e. Collision safety — **GOOD for the derived path, USER'S PROBLEM on the explicit path**
The `markless:` prefix on derived keys namespaces markless's data away from other
libraries and app code sharing the origin — this matches the ecosystem best
practice (redux-persist's `persist:`, nanostores' `settings:` prefix). Weakness:
*within* a markless app, two different components each writing `let theme =
storage(...)` collide on `markless:theme`. That may be intended (shared theme) or
an accident (two unrelated "theme"s). The verbatim explicit-key path
(`storage('theme','light')`) deliberately has **no prefix**, so it can collide
with anything on the origin — but that is the documented escape-hatch tradeoff
for interop, and is fine as long as it's documented.
**Verdict: B+ for derived, intentional-risk for explicit.**

### f. Migration path (change a key without losing data) — **WEAKEST-BY-OMISSION**
Right now there is no first-class "I renamed and want to carry the old data
forward" story. The escape hatch is: pin the old key with the explicit form
(`storage('theme', 'light')`) *before* renaming the variable — but that requires
knowing the footgun exists at exactly the moment you're least thinking about it.
TanStack Query's `buster` and the general "keep a `storageVersion`, migrate on
startup" pattern show the shape of a real answer, but v1 (strings + localStorage)
doesn't need full migration machinery — it needs the **manifest to tell you a
migration is needed**, plus the pin as the manual remedy.
**Verdict: C- — acceptable for v1 only if the manifest makes the need visible.**

**Summary:** identifier-derivation is best-in-class on ergonomics and, given the
two compiler decisions already agreed (stable literal, prefix), it is genuinely
safe on production/minification and collision axes. It is dangerous on exactly one
axis — **rename safety** — and weak-by-omission on migration. Both weak axes are
addressed by the *same* mechanism: the build-time key manifest.

---

## 3. Ranked options for markless

### Option 1 (RECOMMENDED) — Keep identifier-derivation as the default, backed by a build-time key manifest guard
Ship `storage(fallback)` -> `markless:<id>` as-is, plus the compiler-emitted key
manifest (goal.md #6) checked into the repo and diffed build-over-build. When a
previously-emitted derived key disappears (binding renamed/removed), the build
**warns** (not errors) with the old key, the new key, and the one-line remedy
("pin with `storage('theme', ...)` to keep existing users' data").
- **Tradeoff:** highest ergonomics *and* the footgun becomes loud and actionable.
  Costs a small compiler pass (it already visits every `storage()` call) and one
  committed artifact that produces occasional review-time diffs. This is the
  CSS-Modules lesson applied correctly: derivation is safe when the compiler owns
  the mapping and guarantees determinism + drift detection.

### Option 2 — Keep derivation, ship stable-literal only, rely on a documented "pin before you rename" norm (NO manifest)
The goal.md-sanctioned fallback if the manifest proves too heavy for v1.
- **Tradeoff:** cheapest to build; keeps top-tier ergonomics. But it converts a
  silent data-loss bug into a *documentation* norm — and docs fail silently
  exactly when they matter (a junior renames a variable, the reviewer sees a valid
  rename, nobody remembers the persistence coupling). The whole survey shows the
  ecosystem refuses to take this risk even *with* explicit keys. Weakest on the
  one axis that actually hurts users.

### Option 3 — Flip the default: explicit key required, derivation opt-in
Match the entire ecosystem: make `storage('theme', 'light')` the norm, offer
derivation only behind an explicit "I know what this does" form.
- **Tradeoff:** eliminates the footgun by construction and maximizes
  grep-ability/refactor-safety. But it **throws away the differentiator** — the
  reason this feature is interesting is precisely that markless can do what no
  library can. This is the "safe and boring" option; it makes markless's storage
  indistinguishable from Jotai-with-nicer-syntax.

### Option 4 — Derive from file path + export/binding name (CSS-Modules-style), optionally hashed
Make the key `markless:<moduleId>#<id>` or a content hash, so two files' `theme`s
don't collide.
- **Tradeoff:** better *intra-app* collision safety and it aligns with the
  promotion-compatible slot schema already in the codebase (`<moduleId>#<key>`).
  But path-in-the-key means **moving a file also orphans data** — it trades the
  rename footgun for a move footgun, arguably worse because file moves are more
  common and feel more "safe." Hashing kills the human-readable-in-DevTools
  benefit. Not worth it for v1; keep path-scoping internal to the slot/promotion
  layer, not in the user-visible localStorage key.

### Option 5 — Content-hash keys (`markless:<hash>`)
Fully stable against variable rename *and* semantically opaque.
- **Tradeoff:** kills discoverability and no-flash CSS (you can't write
  `html[data-markless-theme]` if the attribute is a hash), and it doesn't actually
  help — a hash of *what*? If it hashes the identifier, renaming still changes it;
  if it hashes a fixed seed, you've just reinvented an explicit key with worse
  ergonomics. Reject.

---

## 4. Concrete recommendation + rename-footgun verdict

**Recommendation: Option 1 — keep `markless:<identifier>` as the default and ship
the build-time key manifest guard. Do not drop it to Option 2.**

Rationale:
1. **The ergonomics are the product.** `let theme = storage('light')` is
   strictly better write-time DX than anything in the survey, and markless is the
   only tool architecturally able to offer it safely. Options 3–5 all surrender
   that advantage; keep it.
2. **The two compiler invariants already neutralize four of the six axes.** The
   baked stable literal (goal.md #5) makes minification safety an A, and the
   `markless:` prefix makes collision safety a B+. Those are not open risks.
3. **Exactly one axis is genuinely dangerous — rename — and it is the one the
   entire ecosystem engineers around.** The universal explicit-key convention is
   the market telling you this coupling bites. markless can't adopt an explicit
   key without losing the point, so it must instead *detect the drift*, which a
   compiler can do and a library cannot.

**Verdict on the rename footgun — the build-time key-manifest guard IS worth it;
"pin before ship" alone is NOT enough.**
- "Pin before ship" (Option 2) is a **convention that fails silently in exactly
  the scenario it's meant to cover.** The failure mode is invisible in code review
  (a valid rename), invisible in tests (fresh state is correct), and only visible
  in production as anonymous user-data loss. A convention that only works when
  everyone remembers an invisible coupling is not a safeguard.
- The manifest is **cheap for a compiler** — the storage pass already enumerates
  every `storage()` call and its baked key, so emitting `{ key, moduleId, binding }`
  rows and diffing against the committed prior manifest is incremental work, not a
  new subsystem. It also **repays the discoverability debt from axis (c)**: the
  manifest is the grep target that the derived key erased ("what writes
  `markless:theme`? — look it up in the manifest").
- Keep the guard a **warning, not a hard error**, with the remedy inline: renames
  are legitimate, and sometimes orphaning old data is intentional (a genuinely new
  preference). The build should say *"`markless:theme` is no longer produced;
  existing users' data will orphan. To carry it forward, pin the old key:
  `storage('theme', ...)`. To intentionally drop it, run `--accept-key-drift`."*
  That turns the pin from a norm-you-must-remember into a **fix the tool hands you
  at the exact moment you need it.**

**One-line owner-facing ask:** approve shipping identifier-derivation as the
default *with* the manifest drift-warning as its safety net (Option 1). The only
thing I'd flag for an explicit owner ruling is manifest **granularity/location** —
per-app committed `storage-keys.json` vs a `.markless/` cache — which is an
implementation detail the Judge/Worker can settle, not a design fork.

---

## Sources checked

- Zustand persist — https://zustand.docs.pmnd.rs/reference/integrations/persisting-store-data (`name` required, "must be unique")
- Jotai `atomWithStorage` — https://jotai.org/docs/utilities/storage and https://jotai.org/docs/guides/persistence (`key` required)
- VueUse `useStorage` — https://vueuse.org/core/usestorage/ (key = param #1)
- nanostores/persistent — https://github.com/nanostores/persistent (`persistentAtom(key,...)`, `persistentMap(prefix,...)`)
- svelte-persisted-store — https://github.com/joshnuss/svelte-persisted-store + Svelte 5 runes discussion #251; successor https://github.com/oMaN-Rod/svelte-persisted-state (`persisted(key,...)`)
- @solid-primitives/storage `makePersisted` — https://github.com/solidjs-community/solid-primitives/blob/main/packages/storage/README.md (`{ name }`)
- redux-persist — https://github.com/rt2zz/redux-persist (`key` + `storage` required; stored as `persist:<key>`)
- Legend-State — https://legendapp.com/open-source/state/v3/sync/persist-sync/ (`persist: { name }`)
- TanStack Query `persistQueryClient` / `buster` — https://tanstack.com/query/latest/docs/framework/react/plugins/persistQueryClient
- CSS Modules `localIdentName` derivation — https://webpack.js.org/loaders/css-loader/ and DeepWiki local-identity-and-hashing; determinism scandal https://github.com/facebook/create-react-app/issues/3972
- localStorage namespacing/versioning best practice — https://medium.com/@emadalam/namespace-localstorage-e2d1d2e68b20 ; Wikimedia key-convention bug T173387
- Minification/mangling context (why runtime derivation is unsafe; terser `reserved`) — https://github.com/babel/minify/issues/369
