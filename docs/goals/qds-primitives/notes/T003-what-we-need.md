# T003 — What we need: primitive requirements from the QDS audit

STATUS: SUGGESTIONS ONLY. The owner ratifies; nothing below is decided.
Sources: notes/T001-qds-inventory.md (full cited inventory) +
notes/T002-surface-map.md (current surface timing semantics). Every
requirement traces to audited cases.

## The audit in one sentence

QDS's imperative machinery falls into distinct why-classes, and they map to
exactly ONE true primitive gap, one confirmation of an existing primitive,
two standard-library opportunities, and one non-need — with the owner's two
example expectations corrected by evidence (the carousel script is
measurement-first, not flash-first; the library contains zero
Resize/Intersection observers to generalize from).

## Requirement classes -> verdicts

### R1. Parse-time element work (THE GAP) — carousel script class

Cases: carousel view-navigation script (measure items-per-view at parse time,
correct inert/active, reveal nav triggers CSS hid by default, retry on
load/fonts.ready, land result on window.carouselState for resumed code);
select's label friction where "another script tag" is the documented avoided
alternative (select-root.tsx:173); menu's window-level SYNC key suppression
existing because lazy resume is too late (menu-root.tsx:113); popover's
hidden-until-positioned concealment; the eagerness workarounds (initially-open
popover visible-task with performance warning, autoplay wake, dev prewarm
hack).

Verdict: NOT covered. attach first runs at hydration/resume on SSR content
(T002 timing ladder class 3) — structurally too late for all of these. The
storage() seed reaches parse time but is document-level key/value only.

What QDS hand-built to fill it is a compiler-shaped pipeline: authored
TypeScript (.script.ts) -> build transform strips TS -> oxc-minify with
top-level mangling -> serialized string map -> dangerouslySetInnerHTML after
the slot -> document.currentScript self-location -> window landing slot ->
resumed runtime consumes. That is five moving parts of hand-rolled compiler
FOR ONE SCRIPT — and it is the same architecture our storage seed
probes/POC executed (compute early, land in a slot, runtime consumes without
re-doing work).

SUGGESTED NEED: an element-scoped early script primitive — author a function
next to the element; the compiler serializes/minifies it, emits it as an
inline script adjacent to (after) the element's HTML, provides the element
(currentScript-style) and statically-known inputs, and hands results to the
runtime via a landing slot the framework adapter consumes on wake. Constraint
surfaced by the audit: retry hooks (load/fonts.ready) and CSS-default-hidden
conventions are part of the real pattern, not exotica.

OPEN CHOICE FOR OWNER (options, not a decision):
- (a) A variant of attach (e.g. attach with an early/parse timing tier).
  Pro: one element-behavior mental model, one IR record family
  (BehaviorRecord already has host binding + inputs + cleanup). Con: the
  serialization boundary is brutally different — an early script cannot
  close over runtime state, only serializable/static inputs; same-name-
  different-rules invites the confusion the owner flagged for storage()
  ("no other declaration does stuff on the client").
- (b) A distinct primitive (working name only: early()/script()) that is
  explicitly "compiler-serialized, runs before the framework exists," with
  attach remaining the post-DOM behavior. Pro: the capability boundary is
  the name; mirrors the storage() lesson where the explicit-switch framing
  won every ecosystem. Con: second primitive to teach; overlap with the
  storage seed channel must be reconciled (they should share the landing-
  slot/injection machinery under the hood).
- Either way, the storage() seed becomes an instance of the same underlying
  channel (document-level, key/value) — one generation pipeline, two
  authoring surfaces.

### R2. Observers + lifecycle — attach CONFIRMED as the host, with two riders

Cases: base use-unmount's global body MutationObserver existing solely
because cleanup must follow actual DOM removal (use-unmount.tsx:80) — a
lifecycle hack, not an observation need; resizable's stale-layout gap and
scroll-area's event-driven remeasure substitute (the two places an observer
SHOULD exist but does not); pointer/gesture listeners in three inconsistent
forms (Qwik document hooks, native window listeners, native document
listener in safe-polygon); carousel's leak-suspect anonymous mouseup and
unremoved media-query listener.

Verdict: attach COVERS this class — (node)=>cleanup is exactly observer
setup/teardown shape, and BehaviorRecord cleanup is first-class in the IR
with emitters wiring detach (T002 §1). The entire use-unmount MutationObserver
hack is what a compiler-managed behavior lifecycle deletes. The leak-suspects
are what record-tracked cleanup prevents structurally.

Two riders the audit argues for (SUGGESTIONS):
- Eagerness control on attach: QDS's visible-task workarounds are all "this
  behavior must run without user interaction, now" (autoplay, initially-open
  popover). markless-native gets this free (wake the chunk); compiled Qwik
  output needs the compiler to emit the eager wake. An attach timing hint
  (idle/visible/eager) is an OPTION; the alternative is compiler inference
  from inputs. Not needed for React/Solid targets where mount is eager.
- Re-run semantics: BehaviorRecord is single-run+cleanup today (T002 §5
  flag). Observer-hosting works within that; input-driven re-attach is a
  possible later extension, not demanded by any audited case.

### R3. Reactive measurement — std-lib cell, NOT a language primitive

Cases: 9 component/subsystem measurement cases; 18 getBoundingClientRect
sites; only carousel builds caching/invalidation (transform-manager.ts:52);
resizable recomputes everything per interaction; scroll-area fakes
observation with events.

Verdict: interaction-time measurement inside handlers is plain code over
element handles — already covered. The gap is a LIBRARY one: a reactive
rect/size cell over a handle (compiler/adapter chooses ResizeObserver vs
events per target, owns caching + invalidation) would replace the three
divergent hand-rolls. SUGGESTION: std-lib `size(handle)`-class helper built
ON attach, not a new primitive. Evidence-of-demand is moderate (2 clear
should-have-observer sites); priority below R1/R4.

### R4. Focus/roving-tabindex — std behavior library, biggest duplication

Cases: 12 component families independently implement roving tabIndex +
arrow/Home/End focus; tree + navbar build three separate TreeWalker
routines; 33 .focus() sites. This is the LARGEST duplication surface in the
library and it is not a browser-machinery gap at all — handles + HandleCall
+ attach express it today.

Verdict: covered by primitives; screaming for ONE std focus-group behavior
(roving group + walker) that components declare instead of re-implement.
SUGGESTION: standard library, not language. (Same shape as the storage
finding: the seed everyone re-invents is the product.)

### R5. Animation/WAAPI + gesture math — NO primitive need

Carousel's WAAPI engine, rAF progress loop, safe-polygon tracker, OTP
selection choreography: sophisticated library code over element handles.
Verdict: no primitive gap; motion package territory (QDS motion is
explicitly WIP/empty). Out of scope.

## What we need — summary for the owner

1. NEW (the only true primitive gap): the early element script channel (R1)
   — decide attach-variant vs distinct primitive; either shares the storage
   seed's generation/landing-slot machinery.
2. CONFIRMED: attach as the observer/listener/lifecycle host (R2) — its
   cleanup-tracked, record-based design deletes QDS's worst hacks; decide
   whether eagerness is an explicit hint or compiler-inferred.
3. STD-LIB, HIGH VALUE: focus-group behavior (R4).
4. STD-LIB, MODERATE: reactive size/rect cell (R3).
5. NOTHING NEEDED: animation/gesture math (R5).

## Misfire self-check

Owner ratifies; options in R1/R2 are deliberately open. The carousel
recollection was corrected (measurement-first), the observer expectation was
corrected (zero instances exist — the need is inferred from two stale-layout
gaps, and that inference is labeled). Static-read limits from T001 §F carry
(no runtime profiling, no streaming-SSR paint proof for parse-time scripts
beyond our storage-round evidence).
