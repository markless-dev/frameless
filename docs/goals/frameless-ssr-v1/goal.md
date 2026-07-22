# frameless-ssr-v1 — SSR behavioral proof + @frameless.md/core

## Original ask

Owner (2026-07-21): run the SSR tranche next while a separate agent adds the
`storage()` API to markless. Owner redirected the SSR approach away from the
v0 sketch's HTML-normalization phase: "don't we just need to make sure the
behavior still works? Maybe using my witness package in markless?" — confirmed
direction after PM assessment. Owner then added via /goalbuddy: "@frameless.md/core
package — small unit: a real package re-exporting the authoring API so the
README's hero import runs as written" and "Solid 2 / Qwik — both explicitly
gated... Not now. Add these two as well" (as tracked gated items).

## Interpreted outcome

1. SSR is proven **behaviorally** for both targets: each framework's emitted
   output server-renders the right initial content, hydrates with a clean
   console, passes the existing scripted scenarios post-hydration, and the two
   frameworks match — verified through `@async/witness` boxes with receipts.
2. `@frameless.md/core` exists as a real workspace package re-exporting the
   authoring API, so the README hero `import { state } from '@frameless.md/core'`
   resolves as written. (npm publishing itself stays out of scope.)
3. Solid 2 and Qwik live on the board as **blocked** items carrying their exact
   gate triggers, so they are tracked without being startable.

Input shape: existing_plan (owner-approved reframing this session + the v0
sketch `docs/goals/frameless-product-v0/notes/ssr-tranche-sketch.md`).

## Goal oracle

A documented command (extending `pnpm e2e` or a sibling `pnpm e2e:ssr`) that:
server-renders both frameworks' emitted demo apps, asserts the scenarios'
initial-state expectations against the pre-hydration DOM, hydrates, asserts a
clean console (no hydration-mismatch warnings or errors — witness client
witness), re-runs the scripted scenarios, and compares behavior cross-target.
Witness receipts land under `.witness/receipts/`. Boxes are calibrated against
intentionally broken hydration first (they must be able to fail). Final audit
(T999) runs from a fresh clone and records `full_outcome_complete`.

## Existing plan facts (preserve; validate, don't rediscover)

- **No HTML normalizer.** The v0 sketch's Phase 1 (normalized HTML string
  comparison) is DELETED by owner direction — it is textual verification, the
  thing this project criticizes. Pre-hydration correctness is asserted with the
  scenarios' existing initial-state expectations (dom-text / dom-present /
  dom-path) evaluated against the SSR'd DOM.
- **Witness carries the instrumentation.** `@async/witness` 0.7.0 (owner's own
  published package; markless is consumer #1, frameless becomes #2). It runs
  the real Vite pipeline, and its three witnesses (pipeline / client / driver)
  plus contested verdicts cover exactly what the sketch planned to hand-build
  (console capture, hydration-mismatch assertion). Pin 0.7.0 with recorded
  re-evaluation triggers, same discipline as the yuku pins.
- **Witness needs apps, not library mounts**: small per-framework SSR demo apps
  (Vite React 19 SSR entry with `renderToString`/`hydrateRoot`; Solid lane
  compiled `generate: 'ssr'` + `hydrate` from solid-js/web on the 1.x pin).
  Demo apps must consume CLI-built emitted output — no bypassing the pipeline.
- Sketch preconditions still valid: Solid SSR compile mode is a new vite lane;
  frameless-build-receipts schema grows an SSR entry via a deliberate version
  bump; the solid2-blocker (`packages/frameworks/solid/test/solid2-blocker.test.ts`) applies to SSR (beta
  drops `./web`) — SSR stays on the 1.x pin under the same overturn trigger.
- **Activation-model neutrality (owner directive, 2026-07-21).** Hydration is
  an implementation detail of React/Solid, not the contract. Qwik resumes (no
  hydrate step; state serialized into HTML, woken lazily) and markless resumes
  too. The lane's four behavioral claims must be phrased and encoded
  framework-neutrally: (1) correct pre-interactive content, (2) clean
  ACTIVATION — hydrate for React/Solid today, resume for future targets — with
  zero console errors/mismatch warnings, (3) post-activation scenarios pass,
  (4) cross-framework equality. The receipts-schema entry, box naming, and
  the documented command must not encode hydration-only fields (e.g. an
  `activation: hydrate | resume` discriminant, not a `hydration:` object).
  T003's lock must include a resumability fitness check: show on paper how
  each box claim maps onto a resuming target before the schema is frozen. No
  Qwik implementation in this tranche (T901 stays gated) — only the contract
  must already fit it.
- **Qwik is v2 ONLY (owner directive, 2026-07-21).** All Qwik facts cited on
  this board come from Qwik v2: the QwikDev/qwik main branch and the
  `@qwik.dev/core` 2.0.0-beta line (beta.38 at directive time). Qwik v1
  (`@builder.io/qwik`) is not a supported target and must not be the source of
  any resume-model claim — v2 changed serialization/resume internals, so v1
  facts are actively misleading here.
- **Solid version policy (owner directive, 2026-07-21).** Solid v1 (current
  1.x pin) remains the DEFAULT Solid target. Solid 2 will ADDITIONALLY be
  supported, but only as experimental behind an explicit flag, once the
  solid2-blocker toolchain-under-test overturns. It never silently replaces
  v1 as default in this plan. This tranche's Solid SSR lane targets v1.
- **Boundary:** this tranche executes against the TARGET frameworks' own SSR
  (React/Solid). Markless itself resumes, it does not hydrate; no conflation
  with markless resume semantics in the tests — but the contract above must
  remain reusable when resumable targets arrive.
- `@frameless.md/core`: re-export the authoring API surface (`state`, `shared`,
  `element`, ...) so the README import specifier is real. Prerequisite for any
  future npm publish under the scope; publishing itself is NOT in this tranche.

## Hard constraints

- The markless repo (`/Users/jacksm5pro/dev/open-source/markless`) is
  **read-only and off-limits**: a separate agent is actively working there
  (storage() goal). Consume `@async/witness` only as a published npm dep.
- `poc/**` read-only evidence. F8 byte-stability control untouched.
- No persistence work — gated on markless `storage()` landing (see
  `docs/goals/frameless-composition-v1/notes/persistence-design-input.md`).
- No cross-file composition work — gated on the vendor refresh.
- Push to main only on explicit owner directive per changeset (AGENTS.md).
- Behavioral-not-structural remains the cross-target principle: frameworks are
  not forced to produce identical markup, only identical behavior; SSR
  assertions use scenario expectations, not tree equality.

## Likely misfire

Building the HTML normalizer anyway; testing SSR through library mounts in
vitest browser mode instead of witness-driven real apps; demo apps that import
authored sources instead of CLI-built emitted output; witness boxes that
cannot fail (no broken-hydration calibration); **a hydration-only proof
surface** — schema fields, box contracts, or command semantics that assume a
hydrate step exists, locking out resumable targets (Qwik, markless); touching
the markless repo; scope creep into persistence, cross-file composition, or
actually publishing to npm; treating Solid2/Qwik gated cards as startable work
(the neutrality requirement is a contract constraint, not permission to build
Qwik).

## Enough for this tranche

Oracle green from a fresh clone; core package import real; gated cards
recorded with triggers; docs honest (README's "not yet SSR" updated only to
what is actually proven).
