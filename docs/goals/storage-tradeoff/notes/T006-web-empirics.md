# T006 (web half) — Empirical adoption data for existing device-state solutions

All EVIDENCE (cited). No suggestions here; the Judge synthesizes. PM-executed
2026-07-21 (night session per owner direction: "empirical data... based on
what's existing; only the best suggestions, no implementation").

## Adoption numbers (the shapes that actually won)

- next-themes: ~24.5M weekly downloads (snyk/npm) — the provider-component +
  injected-head-script + class-on-html shape. An ORDER OF MAGNITUDE above every
  alternative in its category; the dominant React theme-persistence answer.
- zustand: ~9M weekly, with the persist middleware as its built-in
  persistence answer; jotai: ~2M weekly, atomWithStorage (local/session/
  AsyncStorage/URL-hash backends). Combined ~11M/wk for the
  "persisted-cell-on-a-state-library" family.
- use-local-storage-state: ~159k weekly — the bare-hook family exists but is
  niche relative to the two families above.
- Ecosystem shift context: Redux 57%->38% among RN devs 2023-2026; zustand
  ~tripled (pkgpulse/state-of surveys via search digest).

## Framework-blessed instance of the build-config family

- @nuxtjs/color-mode (nuxt-modules/color-mode): registered in nuxt.config
  modules (BUILD-level enablement), injects the head script itself, applies
  `.{mode}-mode` class to <html>, exposes useColorMode() composable, system
  auto-detect + fallback preference config. Nuxt UI auto-registers it.
  Empirically: the "build-registered module + composable read" shape is the
  Vue ecosystem's blessed answer — the build-config family has a
  mass-adopted production instance, not just a design sketch.

## Native-platform empirics (the driver sync/async axis is real)

- Capacitor Preferences: async-only get/set key-value API (await
  Preferences.get({key})) — the async-driver family.
- react-native-mmkv: chosen over AsyncStorage specifically BECAUSE reads are
  synchronous — cited guidance: sync reads matter "when theme, onboarding
  flags, cart, or navigation state need to be available before rendering"
  (~30x faster, memory-mapped). Practitioners split on exactly our axis:
  async-tolerant data vs must-be-sync-before-render device state — and the
  ecosystem's answer for the latter is a SYNC driver, not async gymnastics.

## Sources

snyk.io next-themes; npmjs next-themes; npmtrends comparisons; pkgpulse 2026
guides (zustand/jotai/nanostores; RN storage decision); jotai.org persistence
guide; zustand persist docs; github nuxt-modules/color-mode; nuxt.com module
page; ui.nuxt.com color-mode integration; capacitorjs.com storage guide;
github mrousavy/react-native-mmkv; oneuptime + dev.to MMKV migration guides.

## Mapping to the menu families (observation, not ranking)

- Menu Option 1 (provider/root): next-themes' shape — 24.5M/wk.
- Menu Option 2 (build config): @nuxtjs/color-mode's shape — Vue's blessed answer.
- Menu Option 3 (persisted cell + driver): zustand-persist/jotai-storage shape — ~11M/wk combined.
- Menu Option 4 (app-owned cells): no mass-adopted library instance found in
  this pass — apps hand-roll it; absence-of-a-winner is itself a data point.
- Native driver axis: sync-read-before-render demand is empirically validated
  (MMKV's entire value proposition).
