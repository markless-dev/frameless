# T001 — Banked evidence from the 2026-07-20 design conversation

Everything here is EVIDENCE or CANDIDATE material. Nothing is ratified. The
owner corrected two premature ratifications the same evening; this note exists
so evidence survives without becoming decisions by osmosis.

## EVIDENCE 1 — Consent law: storage-access timing belongs to the app

ePrivacy Directive Art. 5(3) is technology-neutral: "storing of information, or
gaining access to information already stored, in the terminal equipment" —
applied by compliance guidance to localStorage/sessionStorage exactly like
cookies. Functional prefs (theme/language) often qualify for the
strictly-necessary exemption, but THAT CLASSIFICATION IS THE APP'S LEGAL CALL —
a component library cannot make it. Consequence carried into every candidate:
whether/when device storage is touched pre-consent must be app-controllable.
Citations: clym.io (cookies vs localStorage legal perspective), iubenda
(GDPR cookie requirements), kukie.io (local/session storage cookie-law rules),
gdprverify.com (2026 consent guide).

## EVIDENCE 2 — Ecosystem pattern: execution-boundary changes are explicit syntax

React "use client"/"use server": directives exist to "express the client/server
boundary within the module system... without losing sight of the network gap"
(overreacted.io "What does use client do", react.dev/reference/rsc/use-client).
Astro client:* directives: same shape. No mainstream system silently infers an
execution-boundary change from leaf code; the boundary is always visible where
it happens. Consequence: any candidate whose page-level behavior is invisible
at both the declaration site AND the app level runs against the one pattern the
ecosystem agrees on.

## EVIDENCE 3 — Production prior art of this exact feature: next-themes

Consumer code is inert (useTheme() does nothing page-level). The app-level
opt-in is a VISIBLE COMPONENT the app renders: <ThemeProvider> injects the
pre-hydration script (React.createElement('script'...)), accepts a nonce prop
for CSP, silent try/catch body. The capability/enablement split is not a
compromise — it is the shape that survived mass production use. React 19 warns
on component-rendered script tags (shadcn-ui/ui#10104) — a known friction, not
a defeat. Citations: github.com/pacocoursey/next-themes, npmjs.com/package/
next-themes, nextjs.org preventing-flash guide.

## EVIDENCE 4 — Repo/corpus facts (executed earlier, locations of proof)

- Qwik build/v2 local checkout: restore is lazy by design (serialization.md:
  "we lazily restore the roots... proxy deserializes properties on demand");
  `<script type="qwik/state">` + native state-PATCH-script mechanism
  (process-segment-state.ts, experimental/suspense-gated).
- Pinned markless core exports resumeFromPayloadScripts /
  ResumePayloadScriptsInput — script-fed state is native to the language runtime.
- state() has NO options bag on the pin; shared(create, options?) does.
- T004b (composition goal): notification-atomic store transaction contract,
  probe-executed (writes sync in authored order; single post-method notify;
  version-cached snapshots).
- MDN: the storage event never fires in the writing tab; sessionStorage's event
  reaches only same-tab iframes.

## EVIDENCE 5 — The declaration-inertness asymmetry (owner-raised, analysis)

state/shared/computed have coherent runtime-only readings (markless core ships
runtime implementations; a pure-runtime reading of the source is truthful).
A storage() whose SEMANTIC is "correct at first paint" would be the first
primitive whose promise no runtime function can keep — the guarantee would come
from an artifact the function cannot produce. Owner's sharper follow-up: no
other declaration causes client-side page behavior at all; an API doing so
invisibly means "people have no idea what is happening" — plus the consent
weight from Evidence 1.

## CANDIDATE SKETCHES (from the conversation — steelman targets for T002)

- C-REFRAME: storage()'s runtime semantic = plain persisted reactive cell
  (flash possible, graceful); pre-paint correctness = a compiled UPGRADE the
  toolchain guarantees on compiled targets — not part of the function's
  meaning. (Analogy: state() doesn't MEAN fine-grained DOM ops; the compiler
  makes it so.)
- C-SPLIT: "library declares capability; app enables behavior" — declaration
  inert; the seed/no-flash path is an explicit, visible app-level enablement
  (provider-like construct / build option / explicit include). Matches
  Evidence 1+2+3 independently.
- C-PLAIN-V1: ship only the persisted reactive cell in v1; the pre-paint seed
  is a later explicit feature.
- C-MODULE-SCOPE: storage() restricted to module scope (like shared()) so it
  reads as a declaration of a static fact, not a call inside render.
- C-FILECONV: router-style file/manifest convention — build-time facts live in
  build-facing files, component files stay purely runtime-meaningful.
- C-DIRECTIVE: explicit marker syntax at the declaration ("use client"-family)
  making the boundary visible in source.
- Cross-cutting owner constraints in force: frameless consumers never import
  markless-branded packages; device-state-not-data scope; "too much magic
  isn't great"; separate-package direction (@markless/storage,
  driver/repository) is a LEANING, not ratified.

## STATUS ANNOTATION (by reference)

docs/goals/frameless-composition-v1/notes/T013-persistence-api.md: sections
after "EVIDENCE PASS" (the two "OWNER AMENDMENT" sections, "FINAL SURFACE",
"RESOLUTION", "OWNER DESIGN SESSION" framing, "Amendment 3") are UNSETTLED
exploration the owner explicitly declined to ratify. Cite them as candidate
material only. That file is not edited by this goal.
