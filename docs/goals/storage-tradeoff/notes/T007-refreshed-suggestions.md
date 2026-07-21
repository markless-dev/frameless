# T007 — Refreshed best suggestions (empirics folded in)

STATUS: Everything below is SUGGESTION or EVIDENCE. Nothing is ratified. The owner decides; this note only makes the decision easier.

## 1. What existing systems converged on

The empirical question was: what do people actually ship for device state, and which shapes won?

**The winners, per ecosystem (web survey, cited):**
- React: **next-themes, ~24.5M downloads/week** — a provider component that injects a synchronous head script, applies a class to `<html>` before paint, then maintains a reactive value. An order of magnitude above every alternative in its category.
- Vue: **@nuxtjs/color-mode** — the same underlying artifact (injected head script + `.{mode}-mode` class + composable read), but enabled at the **build level** in `nuxt.config`. Mass-adopted, framework-blessed.
- State-library world: **zustand persist + jotai atomWithStorage, ~11M/week combined** — the "persisted reactive cell" as a middleware/atom, no first-paint story of its own.
- **App-owned cells: no mass-adopted instance exists.** Apps hand-roll it. The absence of a winner is itself a data point.
- Native: **MMKV chosen over AsyncStorage specifically because reads are synchronous** — practitioner guidance names exactly our axis: theme/onboarding/before-render state wants a sync driver, not async gymnastics.

**The local corpus (executed, read-only):** 9 of 10 checkouts contain first-party device-state code. Six independently authored theme-persistence families exist across 9 physical copies — including 3 byte-identical copies of the goalbuddy board settings code and a hand-rolled reader duplicated across two Astro layouts. Notably, the owner's own **Qwik UI themes package independently converged on the winning shape**: a provider that renders a synchronous script before its `<Slot>`, mutating `<html>` from storage with a configurable key and CSP nonce — and it does **not** use `useVisibleTask$` for the initial read. Fumadocs chose not to hand-roll at all and delegates to next-themes.

**Where every observed system fails identically — this is the load-bearing finding:**
- **Keys:** mostly hardcoded and unnamespaced (`theme`, `darkMode`, `vueuse-color-scheme` shared by two unrelated systems, a caller-provided `groupId` with no namespace). Duplicated key strings drift between files.
- **Consent:** **zero consent gating observed anywhere** — not in the 24.5M/week winner, not in any of the 15+ corpus systems. Every initial read is unconditional (at best wrapped in try/catch). Yet ePrivacy 5(3) is technology-neutral: the app must own storage-access timing. No library in the survey even offers the hook.
- **Cross-tab sync:** almost universally absent. The only first-party `storage` event listener in the entire corpus is Qwik UI's provider.
- **Flash:** systems that read after async or late execution flash their defaults — the frameless goalbuddy boards apply theme only after an awaited settings request over a light CSS default; DSM reads at body-end after the visible shell (both flash statements are inferences from execution order, not measurements).

These shared failures matter because they are precisely the class of problem a compiler can fix and a library cannot: libraries cannot know all keys statically, cannot own app-level consent timing, and cannot guarantee their seed script matches their component code.

## 2. Refreshed best suggestions (the four T004 menu families, re-weighed)

**Option 1 — provider/root switch (C1). STRENGTHENED. Still the leading suggestion.**
Evidence: next-themes' 24.5M/week makes this the dominant production shape in the frameless-target ecosystem; the corpus adds that the owner's own Qwik UI arrived at the identical shape independently — provider + pre-slot sync script, no visible-task for the initial read — in a resumability-first framework. T004 scored C1 "STRONG frameless / GOOD markless"; the empirics confirm the frameless column and soften the markless objection ("provider is framework ceremony") since Qwik, the most markless-adjacent framework surveyed, shipped exactly this ceremony and it works. SUGGESTION: remains the headline.

**Option 2 — build-config enablement (C2). STRENGTHENED from sketch to production-proven family; rises relative to Option 4.**
Evidence: @nuxtjs/color-mode is a mass-adopted instance of exactly this family — T004 could only score it as a design; it now has an ecosystem-winning precedent. The relevant analogy: Nuxt owns its build the way markless owns its compiler, and in that position the build-module shape won. Caveat: no corpus author hand-rolled this shape; local authors reached for rendered scripts, not build config. T004's asymmetry (markless-stronger, frameless-mixed) stands. SUGGESTION: a real second, no longer speculative.

**Option 3 — plain persisted cell now, no-flash later (C3). Semantic strengthened; standalone-v1 endpoint weakened.**
Evidence: ~11M/week validates the persisted-cell semantic as the reactive layer people want. But the corpus shows what happens when that is ALL you ship: every one of the six local families hand-rolled a pre-paint seed script around their cell, with the identical bug set above. Shipping only C3 predictably reproduces that fragmentation inside markless/frameless apps. SUGGESTION: unchanged as safe staging, but the empirics raise the price of stopping there — the seed is not a luxury; it is the part everyone re-invents.

**Option 4 — app-owned cells, libraries receive a capability (C8). WEAKENED. Demoted suggestion.**
Evidence: no mass-adopted instance found, and the corpus IS the natural experiment — the hand-rolled systems are what app-owned persistence looks like in practice: hardcoded keys, zero consent gates, no sync, byte-identical duplication. The principles C8 champions (consent ownership, key ownership) were realized in none of the observed app-owned code. Those principles are better delivered as compiler defaults than as app obligations. SUGGESTION: keep on the menu for its principle rows, but it is no longer a peer of Options 1-3.

**Ordering change, explicit:** T004 treated the four as roughly peer options with a recommendation on top. The empirics change the ordering in two ways: Option 4 drops from peer to demoted (no winner exists, and its failure mode is empirically documented in the owner's own repos), and Option 2 rises from sketch to proven family. Options 1 and 2 now BOTH carry mass-adopted winners — one per ecosystem — which suggests the 1-vs-2 choice may be ecosystem idiom rather than correctness.

**The T004 recommendation-synthesis, re-assessed:** T004 recommended Option 1 (provider/root switch) with Option 3's honest semantic as the stated contract ("storage() means a persisted cell that may briefly show its fallback; the root switch upgrades to no-flash"), with Option 3 alone as staging. The empirics STRENGTHEN this synthesis on every leg: the provider shape is the proven winner (next-themes, Qwik UI); the persisted-cell semantic is the proven reactive layer (zustand/jotai); and the "upgrade, not semantic" framing (C4/P3) matches observed practice — every hand-rolled seed script exists solely to buy no-flash, exactly what P3 proved pre-paint buys. One AMENDMENT worth adding as a suggestion, not a change of recommendation: the Nuxt precedent shows the enablement switch can live at build level where the tool owns the build — so the provider switch (frameless targets) and a build-level switch (markless native) could be two faces of one contract, since both ecosystems' winners generate the same artifact underneath (pre-content sync script + root class/attr + reactive cell). SUGGESTION only.

## 3. The compiler-advantage statement

Every observed system — including the 24.5M/week category winner — fails on the same four axes, and each failure is structural to being a library rather than a compiler. Markless/frameless can do what none of them can: **statically known keys with automatic namespacing** (versus the hardcoded, colliding, drift-prone keys observed in every corpus family); **consent gating as a first-class app switch** (zero systems observed gate storage access, yet ePrivacy 5(3) requires the app to own that timing — a compiler-generated, app-enabled artifact is the one construct that can satisfy both law and DX); **derived first-paint membership** (the seed script's contents computed from reachability analysis rather than hand-maintained — the corpus shows duplicated and even unwired hand-written seeds); and **identical semantics across markless-native, compiled React/Solid, and future native targets** (the MMKV finding shows the sync-driver demand extends to native). The seed channel is proven viable in all current modes: markless payload seed executed (P1), React 19 StrictMode-safe and Solid seed-first commits executed (P2/P3), cost budget ~0.006-0.094ms for 1-50 keys (P4). Honesty requires the counter-option stated: fumadocs demonstrates that delegating to next-themes is a viable non-ownership path — the owner's decision is whether the four compiler-only fixes justify owning the primitive.

## 4. Honest residual unknowns (carried forward, priced)

- Browser chunk-ordering for the markless seed — P1 was Node-executed; UNPROVABLE-WITHOUT-BROWSER stands. Price: one real-browser probe round.
- Key stability across renames/aliases/multiple package versions — unprobed for every candidate; the corpus's key drift makes this more important, not less. Price: identity-policy design plus a probe.
- SQLite/async-driver lifecycle — async cannot run inside a blocking seed; barrier/snapshot/patch menu designed but unexecuted. MMKV suggests the native answer may be "require a sync driver for seed-tier state." Price: native-path probe.
- Facade mechanism timing — P5: @frameless/authoring rejected on today's pin (MARKLESS_FRAMEWORK_IMPORT_REQUIRED); import-rewrite now; accepted-import-sources is markless-side (fixing board). Price: cross-repo coordination before the branding constraint is cleanly satisfiable.
- next-themes internals — cited, not executed (source not in corpus); script/consent/CSP behavior adoption-inferred.
- C3 SSR/hydration path unprobed; flash perceptibility inference-only.

## 5. Misfire self-check

Nothing above is ratified; the owner ratifies or nothing does. At-risk sentences named: (1) "recommendation STRENGTHENED" is evidence-weighing, not convergence; (2) "Option 4 demoted" is a Judge ranking, not a kill; (3) the "two faces of one contract" amendment is a NEW synthesis the owner has not seen — highest risk of decision-reading; (4) the compiler-advantage paragraph argues one side; the fumadocs delegate-don't-own counter-path is stated so the owner sees both.
