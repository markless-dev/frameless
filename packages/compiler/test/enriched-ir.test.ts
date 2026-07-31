import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { basename } from 'pathe';
import { describe, expect, test } from 'vitest';
import {
	buildEnrichedIr,
	collectGraphReads,
	isDomBooleanContentAttribute,
	isLanePortableBooleanAttribute,
} from '../src/build';
import { dumpEnrichedIr } from '../src/dump';
import type { EnrichedIR, SerializableAstNode, TemplateHost, TemplateNode } from '../src/schema';

const FIXTURES = [
	's1-render-once.tsrx',
	's2-keyed-todo.tsrx',
	's3-event-form.tsrx',
	's4-nested-list.tsrx',
	's5-branch-teardown.tsrx',
	's6-whitespace-text.tsrx',
	's7-form-controls.tsrx',
	's8-async-handlers.tsrx',
	's9-boolean-attributes.tsrx',
	's10-todomvc.tsrx',
	's11-todomvc-advanced.tsrx',
	's12-codex-clone.tsrx',
	's13-hn-front.tsrx',
	's14-hn-item.tsrx',
	's15-habit-tracker.tsrx',
	's16-task-board.tsrx',
	's17-contacts.tsrx',
] as const;

const EXPECTED_HOSTS: Record<(typeof FIXTURES)[number], Array<[string, string]>> = {
	's1-render-once.tsrx': [
		['div', 'data-s1-root'],
		['p', 'data-branch'],
		['section', 'data-scenario'],
		['output', 'data-value'],
		['button', 'data-action'],
	],
	's2-keyed-todo.tsrx': [
		['section', 'data-scenario'],
		['p', 'data-count'],
		['input', 'data-action'],
		['button', 'data-action'],
		['p', 'data-empty'],
		['ul', ''],
		['li', 'data-oracle-row-key'],
		['input', 'data-edit'],
		['input', 'data-toggle'],
		['button', 'data-remove'],
		['button', 'data-action'],
		['button', 'data-action'],
	],
	's3-event-form.tsrx': [
		['form', 'data-scenario'],
		['input', 'data-action'],
		['input', 'data-action'],
		['button', 'data-action'],
		['button', 'data-action'],
		['output', 'data-writes'],
		['span', 'data-callback-marker'],
		['details', 'data-cancel'],
		['summary', 'data-action'],
		['details', 'data-cancel'],
		['summary', 'data-action'],
	],
	// S4's inner rows carry `data-oracle-cell-key`, NOT `data-oracle-row-key`.
	// The three-way contract's `measureRowKeys` matches the latter globally, so a
	// nested list keyed with the same attribute would silently join the outer
	// list's observation string. The two attributes are what keep S4's outer keys
	// and inner keys separately measurable. See T034.
	's4-nested-list.tsrx': [
		['section', 'data-scenario'],
		['output', 'data-selection'],
		['p', 'data-count'],
		['button', 'data-action'],
		['button', 'data-action'],
		['ul', 'data-groups'],
		['li', 'data-oracle-group-key'],
		['ul', 'data-rows'],
		['li', 'data-oracle-cell-key'],
		['button', 'data-select'],
		['span', 'data-cell-on'],
		['span', 'data-cell-off'],
		['details', 'data-cell-open'],
		['summary', 'data-open-cell'],
	],
	// S5's rows carry `data-oracle-branch-key`, a THIRD key attribute, for the
	// same reason S4 introduced `data-oracle-cell-key`: S2's `measureRowKeys`
	// matches `data-oracle-row-key` globally and S4's `measureCellKeys` matches
	// `data-oracle-cell-key`, so a scenario reusing either would silently join
	// that scenario's observation string.
	//
	// The two `div data-arm` hosts are the branch arms, and there are TWO of them
	// on purpose: this is the first scenario in the corpus whose branch has a
	// POPULATED arm on both sides. Each arm re-projects the same `ticks` and
	// `seen` state, which is what makes "the state survived the teardown"
	// observable at all.
	//
	// Each arm projects it through its OWN marker (`data-live-ticks` /
	// `data-idle-ticks`) rather than a shared one, and that is a measured
	// constraint rather than a naming preference: the Solid dossier gate's
	// `show-two-arm` policy (T003 ruling 5) rejects any element subtree that
	// appears verbatim in both arms of a `<Show>`, telling the author to hoist
	// shared content out of the branch. Hoisting is exactly what this scenario
	// must NOT do — the projections have to live inside the subtree that gets
	// destroyed — so the arms differ instead.
	's5-branch-teardown.tsrx': [
		['section', 'data-scenario'],
		['p', 'data-count'],
		['button', 'data-action'],
		['div', 'data-arm'],
		['output', 'data-live-ticks'],
		['p', 'data-live-seen'],
		['button', 'data-action'],
		['ul', 'data-branch-rows'],
		['li', 'data-oracle-branch-key'],
		['button', 'data-pick'],
		['div', 'data-arm'],
		['output', 'data-idle-ticks'],
		['p', 'data-idle-seen'],
		['button', 'data-action'],
	],
	// S6's rows carry `data-oracle-text-key`, a FOURTH key attribute, for the same
	// reason S4 introduced the second and S5 the third: every key reader in
	// `three-way-contract.ts` matches its own attribute, so a scenario reusing one
	// would silently join that scenario's observation string.
	//
	// EVERY text node in this fixture is `trim()`-stable, and that is a MEASURED
	// constraint rather than a style choice. The Angular emitter's `escapeText`
	// throws on any template text whose own edges are whitespace, and the Vue
	// gate's `condense-stable-text` rejects the emitted result for the same shape.
	// So the only whitespace this scenario can put in the TEMPLATE is interior —
	// `one two three` — and every space that has to sit next to an interpolation
	// is carried by the DATA instead (`label`, and the `joiner` state). See the
	// T027 note for the divergence that constraint is guarding against, and for
	// the part of it the two gates do NOT guard.
	's6-whitespace-text.tsrx': [
		['section', 'data-scenario'],
		['p', 'data-ratio'],
		['p', 'data-glue'],
		['p', 'data-wrap'],
		['p', 'data-mixed'],
		['b', 'data-emph'],
		['p', 'data-static'],
		['ul', 'data-lines'],
		['li', 'data-oracle-text-key'],
		['span', 'data-pair'],
		['button', 'data-widen'],
		['button', 'data-action'],
		['button', 'data-action'],
	],
	// S7's rows carry `data-oracle-form-key`, a FIFTH key attribute, for the reason
	// the second, third and fourth exist: every key reader in
	// `three-way-contract.ts` matches its own attribute globally, so a scenario
	// reusing one would silently join that scenario's observation string.
	//
	// THE TWO AXES THIS FIXTURE FOLDS TOGETHER, and why they share a host.
	//
	// FORM CONTROLS. The corpus had exactly two control types before S7 - a text
	// `input` and a checkbox `input`, both in S3 - so `value`/`checked`
	// projection had never been observed on a `select`, a `textarea`, a radio
	// group or a keyed group of checkboxes. All four are here, and all four
	// lower to `kind: 'property'` bindings, which is the half of the divergence
	// that matters: `value` and `checked` are DOM properties, and whether a
	// property binding reaches the SERVED attribute is decided by each lane's own
	// renderer rather than by this IR.
	//
	// BOOLEAN AND DYNAMIC ATTRIBUTES. `data-size`, `data-notes`, `data-tag`,
	// `data-lock`, `disabled` and `aria-disabled` all lower to
	// `kind: 'attribute'`, and `data-lock`/`aria-disabled` are bound to values
	// that are `null` in one state and a string in the other - the
	// present-versus-absent axis, measured live in all six lanes.
	//
	// `disabled` is the third state, `="false"`, and it is deliberately in the
	// fixture rather than left to a comment: Angular lowers an `attribute`-kind
	// binding to `[attr.disabled]`, whose runtime removes the attribute only for
	// `null`/`undefined` and otherwise writes `renderStringify(value)`. See the
	// T030 note for what the six lanes actually did with it.
	's7-form-controls.tsrx': [
		['form', 'data-scenario'],
		['select', 'data-control'],
		['option', 'value'],
		['option', 'value'],
		['option', 'value'],
		['textarea', 'data-control'],
		['input', 'data-pick'],
		['input', 'data-pick'],
		['p', 'data-picked'],
		['p', 'data-chosen'],
		['ul', 'data-tags'],
		['li', 'data-oracle-form-key'],
		['input', 'data-tag'],
		['button', 'data-action'],
		['button', 'data-action'],
		['button', 'data-guard'],
	],
	// S8 is the ASYNC scenario, and it is the first fixture in this corpus whose
	// handlers contain `await` at all. T031 measured that S8 had NO six-lane
	// spelling on the emitters of the time and wrote nothing; T043 refuted the
	// impossibility proof and re-specified the authoring as `await` on a
	// promise-VALUED prop - no call and no free global, which is what clears
	// Angular's globals rule and Qwik's callback-statement rule simultaneously.
	// The two handlers below are T043's A7 and A8 verbatim in shape: A7 writes
	// state either side of the boundary, A8 opens with `event.preventDefault()`
	// so the Qwik lane has to split the handler into `sync$()` + `$(async)`.
	//
	// THE BUTTONS CARRY TEXT CHILDREN, and that is a MEASURED constraint rather
	// than a style choice. T002 of frameless-async-and-defects-v1 ran the probe
	// through all six emitters for the first time - it had only ever been run
	// through react - and the SVELTE EMITTER REFUSES a self-closing
	// `<button ... />`: "did not compile warning-free:
	// a11y_consider_explicit_label". With a label all six lanes emit cleanly.
	//
	// WHY `phase` IS WRITTEN ON BOTH SIDES OF THE `await` AND `ticks` ONLY AFTER
	// IT. Those are the two mechanisms `docs/DEFECTS.md` 12.2 records, and each
	// one needs its own shape to be observable at all:
	//
	//   (b) the DROPPED PRE-AWAIT WRITE needs a cell written on BOTH sides, so
	//       that a lowering retaining only the final sync per cell loses the
	//       first write. Its only observable is a render taken WHILE the handler
	//       is suspended, which is why the scenario has to be able to hold the
	//       promise open - see the /s8 page in each demo.
	//   (a) the STALE RENDER-CLOSURE READ needs a post-await read of a cell
	//       written after the boundary, driven by two dispatches that OVERLAP at
	//       the `await`: one dispatch, or a final-state trace, passes under both
	//       lowerings. T001 measured that.
	//
	// `cancels` is A8's, and it is a third cell rather than a reuse of `ticks`
	// on purpose: the cancellation arm must be observable without disturbing the
	// counter the overlap claim is read off.
	's8-async-handlers.tsrx': [
		['form', 'data-scenario'],
		['p', 'data-async'],
		['p', 'data-async'],
		['p', 'data-async'],
		['button', 'data-action'],
		['button', 'data-action'],
	],
	// S9's rows carry `data-oracle-attr-key`, a SIXTH key attribute, for the reason
	// the second through fifth exist: every key reader in `three-way-contract.ts`
	// matches its own attribute globally, so a scenario reusing one would silently
	// join that scenario's observation string.
	//
	// WHY THIS FIXTURE EXISTS, and why it is not a second S7.
	//
	// T041 ruled the dynamic HTML boolean attribute MIS-LOWERED rather than
	// unspellable and T049 shipped the lowering, but the repair was proven at the
	// compiler and at the emitter and IN NO SERVED PAYLOAD - so the repo shipped a
	// compiler capability with ZERO corpus instances, which is the "a rule with no
	// instances is folklore" condition this board applied to Angular's ruling 3d.
	// `docs/DEFECTS.md` entry 10 names a corpus card as its own close trigger, and
	// this is that card.
	//
	// S7 SUBSTITUTED `aria-disabled` because a dynamic `disabled` had no portable
	// spelling THEN. This fixture binds the real thing: `disabled` on the gate
	// button and on a button INSIDE the keyed repeat, plus `required` on an
	// `<input>` - all three lower to `kind: 'property'`, so a correct lane serves
	// NO attribute at all until the lock click and grows `disabled=""` afterwards.
	// `data-stage` rides the SAME element as the gate's `disabled` and stays
	// `kind: 'attribute'`, which is what makes one host show the two kinds behaving
	// differently: Angular emits `[disabled]="locked"` beside
	// `[attr.data-stage]="stage"` in one start tag.
	//
	// Every boolean here starts FALSE, and that is a MEASURED constraint rather
	// than a tidiness preference. The whole claim is that the attribute is ABSENT
	// until state says otherwise; a fixture that served one initially could not
	// distinguish "the lowering works" from "the attribute is always there".
	//
	// FOUR of the fourteen names `build.ts` admits are deliberately NOT bound here,
	// each excluded on a MEASUREMENT rather than on taste:
	//
	//   readonly, autofocus, autoplay  react-dom 19.2.3 serves nothing in BOTH
	//                                  states and raises `Invalid DOM property`,
	//                                  because React's canonical props are
	//                                  readOnly/autoFocus/autoPlay and no emitter
	//                                  here carries a casing map. It would also
	//                                  trip `runScenario`'s `consoleErrors: 0`.
	//   hidden                         MEASURED RED IN THE QWIK LANE BY THIS CARD:
	//                                  five lanes serve `hidden=""` after the lock
	//                                  click and qwik serves `hidden="true"`.
	//                                  @qwik.dev/core's own `isBooleanAttr` table
	//                                  lists 21 names INCLUDING `disabled` and
	//                                  EXCLUDING `hidden`, so it minimizes one and
	//                                  stringifies the other. The element is still
	//                                  hidden, so this is a SERIALIZATION
	//                                  divergence and not a behavioural one - the
	//                                  T041 §2.3 class - and it is NOT an upstream
	//                                  matter, because this repo's oracle asserts
	//                                  bytes and Qwik's table is its own.
	//
	// `disabled` and `required` are in the portable set, and both were measured:
	// react-dom and the domino build Angular serializes from agree on every value,
	// and `required` is present in qwik's, vue's and svelte's boolean tables too.
	's9-boolean-attributes.tsrx': [
		['section', 'data-scenario'],
		['button', 'data-gate'],
		['input', 'data-note'],
		['p', 'data-sealed'],
		['p', 'data-steps'],
		['ul', 'data-fields'],
		['li', 'data-oracle-attr-key'],
		['button', 'data-field'],
		['button', 'data-seal'],
		['button', 'data-action'],
		['button', 'data-action'],
	],
	// THE FIRST APPLICATION IN THE CORPUS, and the only entry here whose name is
	// not `s<n>-`. That naming is load-bearing in two places rather than
	// decorative: every per-lane emitter suite derives its freshness table from
	// `/^s\d+-[\w-]+\.json$/` against `/^S\d+\.tsx$/`, and `scripts/e2e.mjs` pins
	// `threeWayScenarios` to the literal `['s1'..'s9']`. So `todomvc.json` and
	// `TodoMvc.tsx` are INVISIBLE to both - the app rides the same emitters
	// without joining the 6 x 9 three-way contract, which is exactly the
	// separation the goal asked for: browsable first, e2e wiring only once a lane
	// is proven.
	//
	// Two `form` hosts, and both are measured rather than chosen. Enter cannot be
	// authored as `onKeyDown`, because the react emitter's `eventProp` prints
	// `onKeydown` and react-dom 19.2.3 drops it with "Invalid event handler
	// property" - measured in a real DOM, see the T002 note. Implicit form
	// submission is the portable spelling, and the Svelte emitter then requires
	// each of those forms to carry a CLICK handler too: it prefixes
	// `<!-- svelte-ignore -->` to any `<form>` with an event and its two-sided
	// assertion rejects the suppression as an over-fire when only `submit` is
	// bound.
	's10-todomvc.tsrx': [
		['section', 'class'],
		['header', 'class'],
		['h1', ''],
		['form', 'class'],
		['input', 'class'],
		['main', 'class'],
		['input', 'id'],
		['label', 'for'],
		['ul', 'class'],
		['li', 'class'],
		['form', 'class'],
		['input', 'class'],
		['button', 'type'],
		['div', 'class'],
		['input', 'class'],
		['button', 'type'],
		['button', 'type'],
		['footer', 'class'],
		['span', 'class'],
		['strong', ''],
		['ul', 'class'],
		['li', ''],
		['a', 'href'],
		['li', ''],
		['a', 'href'],
		['li', ''],
		['a', 'href'],
		['button', 'type'],
	],
	// THE SECOND APPLICATION IN THE CORPUS, and the first fixture whose defining
	// mechanism is ASYNCHRONOUS rather than an isolated axis. It rides the ORDINAL
	// slot for the reason S10's entry records: every per-lane suite derives its
	// `generated/` inventory from `/^s(\d+)-[\w-]+\.json$/` and asserts it
	// EXACTLY, so a differently-named artifact is rejected by construction in
	// ten-plus suites at once. `scripts/e2e.mjs` still pins `threeWayScenarios` to
	// the literal `['s1'..'s9']`, so S11 does NOT join the 6 x 9 three-way
	// contract either.
	//
	// IT IS THE FIRST FIXTURE THAT DOES NOT EMIT IN SIX LANES. The Angular emitter
	// refuses it - verbatim, read off THIS module and not off a probe: `Angular
	// emitter cannot resolve the identifier "Promise" in a transplanted body`. The
	// artificial delay the owner accepted as a stand-in for a real remote is
	// `new Promise` + `setTimeout`, and Angular resolves every Identifier in a
	// transplanted body against scope plus declared members. That refusal is
	// SYNCHRONOUS in origin - `probes/async-door` PC reproduces it with no async
	// in the module at all - so it is a global-identifier ban and not an async
	// limit. There is therefore no `generated/S11.ts` in the angular lane, and
	// that lane's inventory suites subtract this scenario BY NAME.
	//
	// THREE HOSTS CARRY NO ATTRIBUTE NAME BELOW (`h1`, two `strong`) because they
	// carry neither a static attribute nor a dynamic binding; the assertion treats
	// an empty name as "match on the tag alone" and still consumes the host, so
	// the list stays a complete multiset rather than a filter.
	's11-todomvc-advanced.tsrx': [
		['section', 'class'],
		['header', 'class'],
		['h1', ''],
		['form', 'class'],
		['input', 'class'],
		['div', 'class'],
		['form', 'class'],
		['input', 'class'],
		['button', 'type'],
		['p', 'class'],
		['strong', ''],
		['p', 'class'],
		['p', 'class'],
		['strong', ''],
		['input', 'id'],
		['label', 'for'],
		['p', 'class'],
		['main', 'class'],
		['input', 'id'],
		['label', 'for'],
		['ul', 'class'],
		['li', 'class'],
		['form', 'class'],
		['input', 'class'],
		['button', 'type'],
		['div', 'class'],
		['input', 'class'],
		['button', 'type'],
		['span', 'class'],
		['button', 'type'],
		['footer', 'class'],
		['span', 'class'],
		['strong', ''],
		['ul', 'class'],
		['li', ''],
		['a', 'href'],
		['li', ''],
		['a', 'href'],
		['li', ''],
		['a', 'href'],
		['button', 'type'],
	],
	// THE THIRD APPLICATION IN THE CORPUS - the CODEX CLONE - and the largest
	// template here at FIFTY-THREE hosts. It rides the ORDINAL slot for the
	// reason S10's and S11's entries record: every per-lane suite derives its
	// `generated/` inventory from `/^s(\d+)-[\w-]+\.json$/` and asserts it
	// EXACTLY. `scripts/e2e.mjs` still pins `threeWayScenarios` to the literal
	// `['s1'..'s9']`, so S12 does NOT join the 6 x 9 three-way contract.
	//
	// It is the SECOND fixture the Angular emitter refuses, on the same
	// global-identifier ban and with the same verbatim opening - `Angular emitter
	// cannot resolve the identifier "Promise" in a transplanted body` - because
	// the streamed answer's three unrolled chunks are separated by `new Promise` +
	// `setTimeout`. There is no `generated/S12.ts`, and that lane's four inventory
	// suites subtract this scenario BY NAME through `test/unbuilt-scenarios.ts`.
	//
	// FOUR TAGS ARRIVE IN THE CORPUS HERE FOR THE FIRST TIME - `aside`, `h2`,
	// `h3`, `ol` - and one OLD tag arrives in a NEW shape: `textarea` has been in
	// the corpus since S7, but S7 binds `data-notes` and this is the first
	// `value`-bound textarea any lane has been asked to print. TWO `strong` hosts
	// carry no attribute name below because they carry neither a static attribute
	// nor a dynamic binding; the assertion treats an empty name as "match on the
	// tag alone" and still consumes the host, so the list stays a complete
	// multiset rather than a filter.
	's12-codex-clone.tsrx': [
		['section', 'class'],
		['aside', 'class'],
		['div', 'class'],
		['span', 'class'],
		['span', 'class'],
		['button', 'type'],
		['p', 'class'],
		['ul', 'class'],
		['li', 'class'],
		['button', 'type'],
		['main', 'class'],
		['header', 'class'],
		['h2', 'class'],
		['p', 'class'],
		['strong', ''],
		['div', 'class'],
		['h3', 'class'],
		['p', 'class'],
		['ol', 'class'],
		['li', 'class'],
		['p', 'class'],
		['p', 'class'],
		['p', 'class'],
		['span', 'class'],
		['form', 'class'],
		['textarea', 'class'],
		['div', 'class'],
		['p', 'class'],
		['button', 'type'],
		['aside', 'class'],
		['div', 'class'],
		['button', 'type'],
		['button', 'type'],
		['div', 'class'],
		['p', 'class'],
		['strong', ''],
		['p', 'class'],
		['p', 'class'],
		['div', 'class'],
		['p', 'class'],
		['p', 'class'],
		['p', 'class'],
		['section', 'class'],
		['div', 'class'],
		['button', 'type'],
		['button', 'type'],
		['div', 'class'],
		['p', 'class'],
		['p', 'class'],
		['p', 'class'],
		['div', 'class'],
		['p', 'class'],
		['p', 'class'],
	],
	// THE FOURTH APPLICATION IN THE CORPUS - the HACKER NEWS FRONT PAGE - at
	// SIXTY hosts, seven more than S12's fifty-three and the largest template
	// here. It rides the ORDINAL slot for the reason the three rows above
	// record: every per-lane suite derives its `generated/` inventory from
	// `/^s(\\d+)-[\\w-]+\\.json$/` and asserts it EXACTLY, and `scripts/e2e.mjs`
	// still pins `threeWayScenarios` to the literal `['s1'..'s9']`, so S13 does
	// NOT join the 6 x 9 three-way contract.
	//
	// THE SHAPE OF THIS LIST IS ITSELF THE MEASUREMENT. TWENTY-SIX of the sixty
	// hosts are `span class` and TWENTY-ONE are `a class` - both counted off
	// this list, not estimated - and SIXTEEN of those twenty-six spans carry
	// nothing but a `|`. That is not decoration: news.ycombinator.com separates
	// its links with LITERAL `" | "` TEXT NODES, and a template text node whose
	// own edges are whitespace is refused outright by the Angular emitter
	// (`escapeText`) and rejected by the Vue gate. Every separator therefore has
	// to become its own `<span class="hn-bar">|</span>` host with its spacing in
	// the stylesheet. The reference's markup is unauthorable in this corpus and
	// the host census is where that shows up.
	//
	// TWO TAGS ARRIVE IN THE CORPUS HERE FOR THE FIRST TIME - `header` and
	// `footer` - and `label` arrives in a NEW shape: S10 and S11 ship a
	// `<label for>` beside a checkbox, and this is the first one bound to a
	// TEXT input. The `input id` row is also the corpus's first host whose
	// FIRST printed attribute is `id` rather than `class` or `type`, because
	// the search field has to carry the id its label points at.
	's13-hn-front.tsrx': [
		['section', 'class'],
		['div', 'class'],
		['header', 'class'],
		['a', 'class'],
		['span', 'class'],
		['a', 'class'],
		['span', 'class'],
		['a', 'class'],
		['span', 'class'],
		['a', 'class'],
		['span', 'class'],
		['a', 'class'],
		['span', 'class'],
		['a', 'class'],
		['span', 'class'],
		['a', 'class'],
		['span', 'class'],
		['a', 'class'],
		['span', 'class'],
		['a', 'class'],
		['a', 'class'],
		['main', 'class'],
		['ul', 'class'],
		['li', 'class'],
		['span', 'class'],
		['span', 'class'],
		['button', 'type'],
		['span', 'class'],
		['span', 'class'],
		['a', 'class'],
		['span', 'class'],
		['span', 'class'],
		['span', 'class'],
		['span', 'class'],
		['span', 'class'],
		['span', 'class'],
		['button', 'type'],
		['span', 'class'],
		['button', 'type'],
		['span', 'class'],
		['a', 'class'],
		['a', 'class'],
		['footer', 'class'],
		['span', 'class'],
		['a', 'class'],
		['span', 'class'],
		['a', 'class'],
		['span', 'class'],
		['a', 'class'],
		['span', 'class'],
		['a', 'class'],
		['span', 'class'],
		['a', 'class'],
		['span', 'class'],
		['a', 'class'],
		['span', 'class'],
		['a', 'class'],
		['span', 'class'],
		['a', 'class'],
		['form', 'class'],
		['label', 'class'],
		['input', 'id'],
	],
	// THIRTY-NINE HOSTS, and the census is worth reading against S13's sixty-two:
	// this page is SMALLER in source and UNBOUNDED on screen. Every host below the
	// `['ul', 'class']` row is authored ONCE and rendered once per comment per
	// level, because `HnItem` names itself inside its own repeat. The three
	// `['div', 'class']` rows at the tail are `.hn-ctext`, `.hn-creply` and
	// `.hn-cnest` - and `.hn-cnest` is the one that HOLDS THE RECURSIVE INSTANCE,
	// which is why collapse hides it rather than hiding the comment body alone.
	's14-hn-item.tsrx': [
		['div', 'class'],
		['div', 'class'],
		['header', 'class'],
		['a', 'class'],
		['span', 'class'],
		['a', 'class'],
		['a', 'class'],
		['div', 'class'],
		['span', 'class'],
		['button', 'type'],
		['a', 'class'],
		['span', 'class'],
		['span', 'class'],
		['span', 'class'],
		['span', 'class'],
		['span', 'class'],
		['span', 'class'],
		['a', 'class'],
		['span', 'class'],
		['a', 'class'],
		['span', 'class'],
		['a', 'class'],
		['span', 'class'],
		['span', 'class'],
		['ul', 'class'],
		['li', 'class'],
		['div', 'class'],
		['div', 'class'],
		['button', 'type'],
		['span', 'class'],
		['span', 'class'],
		['button', 'type'],
		['button', 'type'],
		['span', 'class'],
		['div', 'class'],
		['span', 'class'],
		['div', 'class'],
		['a', 'class'],
		['div', 'class'],
	],
	// THE SIXTH APPLICATION IN THE CORPUS - the HABIT TRACKER - at EIGHTY-ONE
	// hosts, nineteen more than S13's sixty-two and the largest template here by
	// a third. It rides the ORDINAL slot for the reason every row above records.
	//
	// THE SHAPE OF THIS LIST IS THE MEASUREMENT, AND IT IS A DIFFERENT SHAPE THAN
	// S13'S. FORTY-FIVE of the eighty-one hosts are `span class` and FIFTEEN are
	// `div class` - both counted off this list, not estimated - against S13's
	// twenty-six spans and twenty-one anchors. The spans are not separators here:
	// S13's sixteen `<span class="hn-bar">|</span>` exist because
	// news.ycombinator.com writes literal `" | "` text nodes that constraint (8)
	// forbids, whereas THESE spans are text runs that had to be un-inlined for
	// constraint (9) - no element carrying a handler may sit beside text, and
	// every emoji, label, count and glyph on this page shares a parent with a
	// `<button>` or an `<a>`. TWENTY-ONE ANCHORS BECAME TWO, because this page
	// has no link bar; the five `button type` rows are the sidebar add, the
	// sidebar toggle, `New habit`, the theme toggle and the per-habit TOGGLE -
	// and that last one is the only host in the corpus whose single click is
	// asserted to move EIGHT other hosts.
	//
	// ONE ROW HERE IS NOT LIKE THE OTHERS AND IT IS THE PROGRESS BAR:
	// `['span', 'data-ht']` is the only host in this list whose FIRST name is not
	// `class`, because its `class` is a DYNAMIC binding (`{fillClass}`) and the
	// static `data-ht` therefore prints ahead of it. That is the fan-out target
	// with no text of its own - constraint (13) - so the census is where the
	// class-name-as-width decision becomes visible.
	//
	// `aside` and `nav` ARRIVE IN THE CORPUS HERE FOR THE FIRST TIME.
	's15-habit-tracker.tsrx': [
		['section', 'class'],
		['div', 'class'],
		['aside', 'class'],
		['div', 'class'],
		['span', 'class'],
		['span', 'class'],
		['nav', 'class'],
		['a', 'class'],
		['span', 'class'],
		['span', 'class'],
		['span', 'class'],
		['a', 'class'],
		['span', 'class'],
		['span', 'class'],
		['div', 'class'],
		['span', 'class'],
		['button', 'type'],
		['span', 'class'],
		['ul', 'class'],
		['li', 'class'],
		['span', 'class'],
		['span', 'class'],
		['span', 'class'],
		['span', 'class'],
		['div', 'class'],
		['span', 'class'],
		['span', 'class'],
		['div', 'class'],
		['header', 'class'],
		['button', 'type'],
		['span', 'class'],
		['span', 'class'],
		['span', 'class'],
		['button', 'type'],
		['span', 'class'],
		['span', 'class'],
		['button', 'type'],
		['span', 'class'],
		['main', 'class'],
		['div', 'class'],
		['div', 'class'],
		['span', 'class'],
		['h1', 'class'],
		['p', 'class'],
		['span', 'class'],
		['span', 'class'],
		['div', 'class'],
		['p', 'class'],
		['span', 'class'],
		['span', 'class'],
		['span', 'class'],
		['div', 'class'],
		['span', 'data-ht'],
		['div', 'class'],
		['span', 'class'],
		['span', 'class'],
		['div', 'class'],
		['div', 'class'],
		['span', 'class'],
		['span', 'class'],
		['span', 'class'],
		['span', 'class'],
		['span', 'class'],
		['ul', 'class'],
		['li', 'class'],
		['button', 'type'],
		['span', 'class'],
		['span', 'class'],
		['div', 'class'],
		['div', 'class'],
		['span', 'class'],
		['span', 'class'],
		['span', 'class'],
		['span', 'class'],
		['div', 'class'],
		['span', 'class'],
		['span', 'class'],
		['span', 'class'],
		['span', 'class'],
		['span', 'class'],
		['p', 'class'],
	],
	// THE SEVENTH APPLICATION - the TASK BOARD - and the DRAG card, at EIGHTY-NINE
	// hosts: eight more than S15's eighty-one and now the largest template in this
	// corpus. It rides the ORDINAL slot for the reason every row above records.
	//
	// THE SHAPE OF THIS LIST IS WHERE THE AXIS BECOMES VISIBLE, BY WHAT IS ABSENT.
	// There is exactly ONE `['ul', 'class']` and ONE `['li', 'class']` in it, and
	// they are the drop zone and the draggable card of a board that HAS NEITHER.
	// Both tags were chosen off a MEASUREMENT rather than for semantics: the svelte
	// emitted-form gate refuses ANY drag handler on a `<div>` or a `<span>`
	// ("a11y_no_static_element_interactions") and takes the identical handlers on
	// `<ul>` and `<li>` without complaint, so this is the one host pairing in the
	// corpus that would have carried the drag had the TYPE BASELINE allowed it -
	// see the fixture header for why it does not.
	//
	// FIFTY-THREE of the eighty-nine are `span class` and NINE are `button type`,
	// against S15's forty-five and five. The span share is constraint (9) again -
	// no element carrying a handler may sit beside text, and this page has more
	// text runs sharing a parent with a control than any before it - but the BUTTON
	// count is the row that moved most, and it moved for a reason the fixture
	// records: SEVEN of the nine are INERT (the sidebar toggle, Share, Filter,
	// Sort, Request task, the column `+` and `Add task`), mirroring a reference
	// whose own Filter and Add task do nothing, and only TWO do anything at all.
	// Those two are the `◀` and `▶` arrows, and they are the entire interaction
	// surface of this application.
	//
	// `ul`, `li` and `h1` all appear exactly once, and `h1` is the page title
	// rather than a card title: the reference renders its card titles as `<h3>`
	// inside a board that already has an `<h1>`, and a lone `<h3>` under no `<h2>`
	// is a heading-order defect this page declines to reproduce, so every card
	// title is a `span`. That is the second place this module is deliberately more
	// correct than the thing it reproduces.
	's16-task-board.tsrx': [
		['section', 'class'],
		['div', 'class'],
		['aside', 'class'],
		['div', 'class'],
		['span', 'class'],
		['span', 'class'],
		['nav', 'class'],
		['a', 'class'],
		['span', 'class'],
		['span', 'class'],
		['a', 'class'],
		['span', 'class'],
		['span', 'class'],
		['span', 'class'],
		['a', 'class'],
		['span', 'class'],
		['span', 'class'],
		['div', 'class'],
		['span', 'class'],
		['span', 'class'],
		['div', 'class'],
		['header', 'class'],
		['button', 'type'],
		['span', 'class'],
		['h1', 'class'],
		['span', 'class'],
		['span', 'class'],
		['button', 'type'],
		['span', 'class'],
		['span', 'class'],
		['div', 'class'],
		['button', 'type'],
		['span', 'class'],
		['span', 'class'],
		['button', 'type'],
		['span', 'class'],
		['span', 'class'],
		['span', 'class'],
		['span', 'class'],
		['button', 'type'],
		['span', 'class'],
		['span', 'class'],
		['div', 'class'],
		['p', 'class'],
		['span', 'class'],
		['span', 'class'],
		['p', 'class'],
		['span', 'class'],
		['span', 'class'],
		['p', 'class'],
		['span', 'class'],
		['span', 'class'],
		['main', 'class'],
		['div', 'class'],
		['div', 'class'],
		['span', 'class'],
		['span', 'class'],
		['span', 'class'],
		['span', 'class'],
		['button', 'type'],
		['span', 'class'],
		['ul', 'class'],
		['li', 'class'],
		['div', 'class'],
		['span', 'class'],
		['span', 'class'],
		['p', 'class'],
		['div', 'class'],
		['span', 'class'],
		['div', 'class'],
		['span', 'class'],
		['span', 'class'],
		['span', 'class'],
		['span', 'class'],
		['span', 'class'],
		['span', 'class'],
		['span', 'class'],
		['span', 'class'],
		['span', 'class'],
		['span', 'class'],
		['button', 'type'],
		['span', 'class'],
		['button', 'type'],
		['span', 'class'],
		['p', 'class'],
		['span', 'class'],
		['button', 'type'],
		['span', 'class'],
		['span', 'class'],
	],
	// THE EIGHTH APPLICATION - CONTACTS - and THE FORMS CARD. TWO HUNDRED AND
	// TWELVE hosts, which takes the largest-template title off S16's eighty-nine
	// by a factor of 2.4, and the census below says WHY rather than merely how
	// many: FIFTEEN `input`s, TWO `select`s, FIVE `option`s, ONE `textarea` and
	// SIXTEEN `label`s. A form control is never one host - it is a `div` wrapper,
	// a `label`, a `span` carrying the label text (constraint 9) and the control
	// itself, so thirteen control kinds cost four hosts apiece before one of them
	// is bound.
	//
	// `textarea` appears ONCE and it is the reason it is here at all: the
	// reference's own Notes field is a single-line `<input>` - measured live with
	// its dialog open, SEVEN inputs, TWO selects, ZERO textareas - and this page
	// declines to reproduce that.
	//
	// `h1` appears once and `h2` THREE times, which is the second place this
	// module is deliberately more correct than the thing it reproduces:
	// `document.querySelectorAll('h1,h2,h3,h4')` returns ZERO on the whole
	// reference document.
	//
	// `article` appears once - inside the keyed repeat, so it is nine cards on
	// screen - and the preview card is a `div` with the same internal shape, which
	// is what lets one stylesheet rule serve both.
	's17-contacts.tsrx': [
		['section', 'class'],
		['div', 'class'],
		['aside', 'class'],
		['div', 'class'],
		['span', 'class'],
		['span', 'class'],
		['button', 'type'],
		['span', 'class'],
		['span', 'class'],
		['nav', 'class'],
		['a', 'class'],
		['span', 'class'],
		['span', 'class'],
		['span', 'class'],
		['a', 'class'],
		['span', 'class'],
		['span', 'class'],
		['a', 'class'],
		['span', 'class'],
		['span', 'class'],
		['a', 'class'],
		['span', 'class'],
		['span', 'class'],
		['h2', 'class'],
		['div', 'class'],
		['a', 'class'],
		['span', 'class'],
		['span', 'class'],
		['span', 'class'],
		['h2', 'class'],
		['div', 'class'],
		['button', 'type'],
		['span', 'class'],
		['button', 'type'],
		['span', 'class'],
		['div', 'class'],
		['span', 'class'],
		['span', 'class'],
		['div', 'class'],
		['header', 'class'],
		['button', 'type'],
		['span', 'class'],
		['h1', 'class'],
		['input', 'type'],
		['select', 'class'],
		['option', 'value'],
		['option', 'value'],
		['option', 'value'],
		['option', 'value'],
		['span', 'class'],
		['button', 'type'],
		['span', 'class'],
		['button', 'type'],
		['span', 'class'],
		['button', 'type'],
		['span', 'class'],
		['div', 'class'],
		['p', 'class'],
		['span', 'class'],
		['span', 'class'],
		['p', 'class'],
		['span', 'class'],
		['span', 'class'],
		['p', 'class'],
		['span', 'class'],
		['span', 'class'],
		['main', 'class'],
		['div', 'class'],
		['article', 'class'],
		['div', 'class'],
		['span', 'class'],
		['span', 'class'],
		['span', 'class'],
		['span', 'class'],
		['span', 'class'],
		['div', 'class'],
		['span', 'class'],
		['span', 'class'],
		['span', 'class'],
		['span', 'class'],
		['span', 'class'],
		['span', 'class'],
		['span', 'class'],
		['span', 'class'],
		['span', 'class'],
		['span', 'class'],
		['span', 'class'],
		['div', 'class'],
		['span', 'class'],
		['span', 'class'],
		['span', 'class'],
		['p', 'class'],
		['span', 'class'],
		['form', 'class'],
		['h2', 'class'],
		['div', 'class'],
		['div', 'class'],
		['label', 'class'],
		['span', 'class'],
		['input', 'type'],
		['div', 'class'],
		['label', 'class'],
		['span', 'class'],
		['input', 'type'],
		['div', 'class'],
		['label', 'class'],
		['span', 'class'],
		['input', 'type'],
		['div', 'class'],
		['div', 'class'],
		['label', 'class'],
		['span', 'class'],
		['input', 'type'],
		['div', 'class'],
		['label', 'class'],
		['span', 'class'],
		['input', 'type'],
		['div', 'class'],
		['label', 'class'],
		['span', 'class'],
		['input', 'type'],
		['div', 'class'],
		['div', 'class'],
		['label', 'class'],
		['span', 'class'],
		['select', 'class'],
		['option', 'value'],
		['div', 'class'],
		['label', 'class'],
		['span', 'class'],
		['input', 'type'],
		['div', 'class'],
		['div', 'class'],
		['label', 'class'],
		['span', 'class'],
		['input', 'type'],
		['div', 'class'],
		['label', 'class'],
		['span', 'class'],
		['input', 'type'],
		['div', 'class'],
		['label', 'class'],
		['span', 'class'],
		['input', 'type'],
		['div', 'class'],
		['span', 'class'],
		['span', 'class'],
		['div', 'class'],
		['label', 'class'],
		['input', 'type'],
		['span', 'class'],
		['label', 'class'],
		['input', 'type'],
		['span', 'class'],
		['label', 'class'],
		['input', 'type'],
		['span', 'class'],
		['div', 'class'],
		['span', 'class'],
		['span', 'class'],
		['div', 'class'],
		['label', 'class'],
		['input', 'type'],
		['span', 'class'],
		['div', 'class'],
		['label', 'class'],
		['span', 'class'],
		['textarea', 'class'],
		['div', 'class'],
		['div', 'class'],
		['span', 'data-preview'],
		['span', 'class'],
		['span', 'class'],
		['span', 'class'],
		['div', 'class'],
		['span', 'class'],
		['span', 'class'],
		['span', 'class'],
		['span', 'class'],
		['span', 'class'],
		['span', 'class'],
		['span', 'class'],
		['span', 'class'],
		['span', 'class'],
		['span', 'class'],
		['span', 'class'],
		['span', 'class'],
		['span', 'class'],
		['span', 'class'],
		['span', 'class'],
		['span', 'class'],
		['span', 'class'],
		['span', 'class'],
		['span', 'class'],
		['span', 'class'],
		['span', 'class'],
		['span', 'class'],
		['span', 'class'],
		['span', 'data-preview'],
		['span', 'class'],
		['span', 'class'],
		['span', 'class'],
		['div', 'class'],
		['span', 'class'],
		['span', 'class'],
		['span', 'data-preview'],
		['div', 'class'],
		['span', 'class'],
		['span', 'class'],
		['span', 'class'],
		['button', 'type'],
		['span', 'class'],
	],
};

async function fixtureIr(file: (typeof FIXTURES)[number]): Promise<EnrichedIR> {
	const source = readFileSync(new URL(`./fixtures/${file}`, import.meta.url), 'utf8');
	return buildEnrichedIr({ filename: `src/fixtures/${file}`, source });
}

async function compileOnlyFixtureIr(file: string): Promise<EnrichedIR> {
	const source = readFileSync(new URL(`./fixtures/${file}`, import.meta.url), 'utf8');
	return buildEnrichedIr({ filename: `src/fixtures/${file}`, source });
}

/**
 * One `.tsrx` module carrying `text` as the sole child of a host element, so a
 * probe measures template text and nothing else. Shared by the S6 suite and by
 * the interior-whitespace v-limit suite, which are two halves of one finding.
 */
function whitespaceProbeSource(text: string): string {
	return `import { state } from '@markless/core';

export function Probe({ seed }) @{
	let a = state(seed);

	<p data-probe={a}>${text}</p>
}
`;
}

async function probeTexts(text: string): Promise<string[]> {
	const ir = await buildEnrichedIr({
		filename: 'probe.tsrx',
		source: whitespaceProbeSource(text),
	});
	return allTemplateNodes(ir)
		.filter((node) => node.kind === 'text')
		.map((node) => (node.kind === 'text' ? node.value : ''));
}

/**
 * The RED half of the v-limit's two-sided calibration. Returns the refusal
 * message, and fails loudly if the construct compiled - a guard that cannot be
 * shown to fire is theatre, so "it did not throw" must never read as a pass.
 */
async function probeRefusal(text: string): Promise<string> {
	try {
		await buildEnrichedIr({ filename: 'probe.tsrx', source: whitespaceProbeSource(text) });
	} catch (error) {
		return error instanceof Error ? error.message : String(error);
	}
	throw new Error(
		`Expected the interior-whitespace v-limit to refuse ${JSON.stringify(text)}, but it compiled.`,
	);
}

function walkTemplate(nodes: readonly TemplateNode[]): TemplateNode[] {
	const found: TemplateNode[] = [];
	for (const node of nodes) {
		found.push(node);
		if (node.kind === 'host' || node.kind === 'fragment' || node.kind === 'component-reference')
			found.push(...walkTemplate(node.children));
		if (node.kind === 'branch') {
			for (const arm of node.arms) found.push(...walkTemplate(arm.children));
		}
		if (node.kind === 'keyed-repeat') {
			found.push(...walkTemplate(node.row), ...walkTemplate(node.empty));
		}
	}
	return found;
}

function allTemplateNodes(ir: EnrichedIR): TemplateNode[] {
	return ir.components.flatMap((component) => [
		...component.guards.flatMap((guard) =>
			guard.whenTrue.kind === 'template' ? walkTemplate(guard.whenTrue.children) : [],
		),
		...walkTemplate(component.template),
	]);
}

function hosts(ir: EnrichedIR): TemplateHost[] {
	return allTemplateNodes(ir).filter((node): node is TemplateHost => node.kind === 'host');
}

function astNodes(root: SerializableAstNode): SerializableAstNode[] {
	const found: SerializableAstNode[] = [];
	const visit = (value: unknown): void => {
		if (!value || typeof value !== 'object') return;
		if (Array.isArray(value)) {
			for (const child of value) visit(child);
			return;
		}
		const candidate = value as SerializableAstNode;
		if (typeof candidate.type === 'string') found.push(candidate);
		for (const child of Object.values(candidate)) visit(child);
	};
	visit(root);
	return found;
}

function callbackNames(ast: SerializableAstNode): string[] {
	return astNodes(ast)
		.filter(
			(node) =>
				node.type === 'CallExpression' &&
				(node.callee as SerializableAstNode | undefined)?.type === 'Identifier' &&
				(node.callee as { name?: string }).name === 'onTrace',
		)
		.map((node) => {
			const first = (node.arguments as SerializableAstNode[] | undefined)?.[0];
			return first?.type === 'Literal' ? String(first.value) : '';
		})
		.filter(Boolean);
}

describe('fixture-family sufficiency', () => {
	for (const file of FIXTURES) {
		test(`${file}: every dynamic DOM site has an AST and closed graph reads`, async () => {
			const ir = await fixtureIr(file);
			const graphIds = new Set(ir.records.bindings.map((binding) => binding.id));
			const nodes = allTemplateNodes(ir);
			const sites: Array<{
				expression: SerializableAstNode;
				reads: readonly { graphNodeId: string }[];
			}> = [];
			for (const node of nodes) {
				if (node.kind === 'dynamic-text') sites.push(node);
				if (node.kind === 'host') sites.push(...node.dynamicBindings);
				if (node.kind === 'branch') sites.push(node);
				if (node.kind === 'keyed-repeat') sites.push(node.collection, node.key);
			}
			expect(sites.length).toBeGreaterThan(0);
			for (const site of sites) {
				expect(typeof site.expression.type).toBe('string');
				expect(site.reads.length).toBeGreaterThan(0);
				for (const read of site.reads) expect(graphIds.has(read.graphNodeId)).toBe(true);
			}
		});
	}

	test('S1 carries ordered locals, setup AST, and the root branch site', async () => {
		const ir = await fixtureIr('s1-render-once.tsrx');
		const component = ir.components[0]!;
		expect(component.locals.flatMap((local) => local.names)).toEqual([
			'setup',
			'count',
			'prefix',
			'derived',
		]);
		expect(
			component.locals.find((local) => local.names.includes('prefix'))?.reads,
		).toContainEqual({ graphNodeId: 'prop:props', path: ['label'], via: 'alias' });
		const derived = ir.records.bindings.find((binding) => binding.id === 'computed:derived')!;
		expect(derived.computed?.reads).toContainEqual({
			graphNodeId: 'prop:props',
			path: ['label'],
			via: 'local',
		});
		expect(derived.reads).toContainEqual({
			componentId: component.id,
			graphNodeId: 'prop:props',
			path: ['label'],
		});
		expect(component.evaluation).toEqual({
			ordinaryLocals: 'once-per-instance',
			computedBindings: 'reactive',
		});
		expect(ir.module.exports).toEqual([
			{ kind: 'named', componentName: 'RenderOnce', exportedName: 'RenderOnce' },
		]);
		expect(callbackNames(component.locals[0]!.initializer!)).toEqual(['setup']);
		expect(component.guards).toHaveLength(0);
		// Root-level branches silently compile to an empty CSR artifact in
		// markless 0.1.1 (recorded finding), so S1 wraps the branch in a stable
		// root element; the branch is the root's only child.
		const rootHost = component.template.find((node) => node.kind === 'host');
		expect(rootHost?.kind).toBe('host');
		if (rootHost?.kind !== 'host') throw new Error('missing S1 root host');
		expect(rootHost.tag).toBe('div');
		const branch = rootHost.children.find((node) => node.kind === 'branch');
		expect(branch?.kind).toBe('branch');
		if (branch?.kind !== 'branch') throw new Error('missing S1 root branch');
		expect(branch.id).toBe('branch-site:0');
		expect(branch.arms.map((arm) => arm.kind)).toEqual(['then', 'else']);
		expect(
			branch.arms.map((arm) =>
				walkTemplate(arm.children)
					.filter((node) => node.kind === 'host')
					.map((node) => node.tag),
			),
		).toEqual([['p'], ['section', 'output', 'button']]);
		expect(hosts(ir).map((host) => host.tag)).toEqual([
			'div',
			'p',
			'section',
			'output',
			'button',
		]);
	});

	test('compile-only alias fixture preserves aliased prop destructuring and alias-record reads', async () => {
		const ir = await compileOnlyFixtureIr('alias-coverage.tsrx');
		const component = ir.components[0]!;
		expect(component.props.entries).toContainEqual(
			expect.objectContaining({
				sourceName: 'label',
				localName: 'displayLabel',
				alias: true,
				graphNodeId: 'prop:props',
				path: ['label'],
			}),
		);
		expect(ir.records.aliases.find((alias) => alias.name === 'displayLabel')).toEqual(
			expect.objectContaining({
				target: 'props.label',
				graphNodeId: 'prop:props',
				path: ['label'],
			}),
		);
		expect(
			component.locals.find((local) => local.names.includes('prefix'))?.reads,
		).toContainEqual({ graphNodeId: 'prop:props', path: ['label'], via: 'alias' });
		const derived = ir.records.bindings.find((binding) => binding.id === 'computed:derived')!;
		expect(derived.computed?.reads).toContainEqual({
			graphNodeId: 'prop:props',
			path: ['label'],
			via: 'local',
		});
		expect(derived.reads).toContainEqual({
			componentId: component.id,
			graphNodeId: 'prop:props',
			path: ['label'],
		});
	});

	// IR-8 SUPPLY. `PropDestructuringEntry.type`, sourced from the annotation
	// `@tsrx/core` already parses onto the props parameter.
	//
	// THE CONTROL ARM IS THE HALF THAT MATTERS. Before this field existed, no
	// `.tsrx` in the corpus carried a prop type at all, so a suite that only
	// asserted "S1 has types" would pass identically if the builder hard-coded
	// them. The absence cases below - unannotated scenarios, a bare type
	// reference, a rest element - are what prove the value came from the source.
	describe('IR-8: authored prop types', () => {
		test('S1, the one annotated corpus module, supplies a type per prop keyed by source name', async () => {
			const ir = await fixtureIr('s1-render-once.tsrx');
			const entries = ir.components[0]!.props.entries;
			expect(
				Object.fromEntries(
					entries.map((entry) => [entry.sourceName, entry.type?.type]),
				),
			).toEqual({
				label: 'TSStringKeyword',
				multiplier: 'TSNumberKeyword',
				visible: 'TSBooleanKeyword',
				onTrace: 'TSFunctionType',
			});
		});

		test('the CALLBACK prop keeps its whole signature, not just the fact that it is a function', async () => {
			// T002 recorded as MISSING EVIDENCE that "whether a function type
			// survives @tsrx/core -> IR" was unmeasured. This is the supply half of
			// that measurement: parameters, their annotations and the return type
			// all arrive as walkable syntax. Whether six emitters can PRINT it is a
			// later step's risk, but it can no longer be lost here silently.
			const ir = await fixtureIr('s1-render-once.tsrx');
			const onTrace = ir.components[0]!.props.entries.find(
				(entry) => entry.sourceName === 'onTrace',
			)!;
			const signature = onTrace.type!;
			expect(signature.type).toBe('TSFunctionType');
			const parameters = signature.parameters as SerializableAstNode[];
			expect(parameters.map((parameter) => parameter.name)).toEqual(['name', 'detail']);
			expect(
				parameters.map(
					(parameter) =>
						(parameter.typeAnnotation as SerializableAstNode).typeAnnotation,
				),
			).toMatchObject([{ type: 'TSStringKeyword' }, { type: 'TSTypeReference' }]);
			expect((signature.typeAnnotation as SerializableAstNode).typeAnnotation).toMatchObject({
				type: 'TSVoidKeyword',
			});
		});

		/**
		 * The annotated set is NAMED, and the control arm is what is left over.
		 *
		 * S8 joined S1 here when the async scenario landed, and the row is written
		 * this way rather than as `filter(name !== 's1')` because that spelling
		 * would have had to be widened by one filter clause per new annotated
		 * fixture until the control arm was empty and nobody noticed. `ANNOTATED` is
		 * asserted to be non-empty AND a strict subset, so both halves stay real: a
		 * corpus that annotated everything, or nothing, fails here rather than
		 * reporting a green over a vacuous loop.
		 */
		const ANNOTATED: readonly (typeof FIXTURES)[number][] = [
			's1-render-once.tsrx',
			's8-async-handlers.tsrx',
			's10-todomvc.tsrx',
			's11-todomvc-advanced.tsrx',
			's12-codex-clone.tsrx',
			's13-hn-front.tsrx',
			's14-hn-item.tsrx',
			's15-habit-tracker.tsrx',
			's16-task-board.tsrx',
			's17-contacts.tsrx',
		];

		test('CONTROL: every UNannotated corpus scenario carries NO type, and both sets are non-empty', async () => {
			const control = FIXTURES.filter((name) => !ANNOTATED.includes(name));
			expect(ANNOTATED.length).toBeGreaterThan(0);
			expect(control.length).toBeGreaterThan(0);
			for (const file of control) {
				const ir = await fixtureIr(file);
				const typed = ir.components
					.flatMap((component) => component.props.entries)
					.filter((entry) => entry.type !== undefined);
				expect(typed, `${file} should carry no authored prop type`).toEqual([]);
			}
			// The other side: every named module really does supply a type for EVERY
			// prop it declares, so `ANNOTATED` cannot drift into a skip list.
			for (const file of ANNOTATED) {
				const ir = await fixtureIr(file);
				const entries = ir.components.flatMap((component) => component.props.entries);
				expect(entries.length, file).toBeGreaterThan(0);
				expect(
					entries.filter((entry) => entry.type === undefined),
					`${file} should carry an authored type for every prop`,
				).toEqual([]);
			}
		});

		test('S8 supplies the PROMISE type its `await` depends on, as walkable syntax', async () => {
			// The async axis's own supply check. `await ready` on an unannotated prop
			// is an `await` of `any`, which is indistinguishable from awaiting a
			// number; this is the field that makes the emitted output say what T043's
			// re-specification claims.
			const ir = await fixtureIr('s8-async-handlers.tsrx');
			const ready = ir.components[0]!.props.entries.find(
				(entry) => entry.sourceName === 'ready',
			)!;
			expect(ready.type?.type).toBe('TSTypeReference');
			expect((ready.type!.typeName as SerializableAstNode).name).toBe('Promise');
			expect(
				(ready.type!.typeArguments as SerializableAstNode).params as SerializableAstNode[],
			).toMatchObject([{ type: 'TSStringKeyword' }]);
		});

		test('an ALIASED prop keys on the SOURCE name the annotation uses, not the local one', async () => {
			// `alias-coverage.tsrx` renames `label` to `displayLabel`. An annotation
			// names the property as the CALLER spells it, so keying on the local
			// name would supply nothing for exactly the props most likely to break.
			const ir = await buildEnrichedIr({
				filename: 'probe.tsrx',
				source: `import { computed } from '@markless/core';

export function Probe({ label: displayLabel }: { label: string }) @{
	const derived = computed(() => \`\${displayLabel}\`);

	<output data-probe="">{derived}</output>
}
`,
			});
			expect(ir.components[0]!.props.entries[0]).toMatchObject({
				sourceName: 'label',
				localName: 'displayLabel',
				alias: true,
				type: { type: 'TSStringKeyword' },
			});
		});

		test('CONTROL: a bare type REFERENCE supplies nothing - frameless does not resolve it', async () => {
			// THE BOUNDARY OF THE SUPPLY CHANNEL, ENCODED. `({ label }: Props)` has
			// its members in another declaration, possibly another module. Reading
			// them is cross-module inference, which is the "new source" this phase
			// is forbidden to invent - so the field is ABSENT rather than guessed.
			const ir = await buildEnrichedIr({
				filename: 'probe.tsrx',
				source: `import { computed } from '@markless/core';

type Props = { label: string };

export function Probe({ label }: Props) @{
	const derived = computed(() => \`\${label}\`);

	<output data-probe="">{derived}</output>
}
`,
			});
			expect(ir.components[0]!.props.entries[0]!.sourceName).toBe('label');
			expect(ir.components[0]!.props.entries[0]!.type).toBeUndefined();
		});

		test('CONTROL: a REST element gets no type - there is no single member to name it', async () => {
			const ir = await buildEnrichedIr({
				filename: 'probe.tsrx',
				source: `import { computed } from '@markless/core';

export function Probe({ label, ...rest }: { label: string }) @{
	const derived = computed(() => \`\${label}\`);

	<output data-probe="" data-rest={rest}>{derived}</output>
}
`,
			});
			const entries = ir.components[0]!.props.entries;
			expect(entries.find((entry) => entry.sourceName === 'label')?.type).toMatchObject({
				type: 'TSStringKeyword',
			});
			expect(entries.find((entry) => entry.sourceName === '*')?.type).toBeUndefined();
		});

		// IR-8 REQUIREDNESS. `optional`, read from the SAME type-literal member as
		// `type`. Before this, `propTypeMembers` serialized only
		// `member.typeAnnotation.typeAnnotation` and never looked at
		// `member.optional`, so a fact the source states outright was parsed,
		// reached, and dropped at serialization.
		test('every prop reports its authored requiredness, and the corpus fixture is all-required', async () => {
			const ir = await fixtureIr('s1-render-once.tsrx');
			expect(
				Object.fromEntries(
					ir.components[0]!.props.entries.map((entry) => [
						entry.sourceName,
						entry.optional,
					]),
				),
			).toEqual({ label: false, multiplier: false, visible: false, onTrace: false });
		});

		test('an OPTIONAL member reports optional: true - the flag tracks the `?`', async () => {
			// THE ARM THAT MAKES THE ONE ABOVE MEAN SOMETHING. All four corpus props
			// are non-optional, so `optional: false` everywhere is equally
			// consistent with a builder that hard-codes `false`. This is the only
			// input in the suite where the two hypotheses disagree.
			const ir = await buildEnrichedIr({
				filename: 'probe.tsrx',
				source: `import { computed } from '@markless/core';

export function Probe({ required, optional }: { required: string; optional?: string }) @{
	const derived = computed(() => \`\${required}\${optional}\`);

	<output data-probe="">{derived}</output>
}
`,
			});
			expect(
				ir.components[0]!.props.entries.map((entry) => [entry.sourceName, entry.optional]),
			).toEqual([
				['required', false],
				['optional', true],
			]);
		});

		test('CONTROL: requiredness is ABSENT wherever the type is absent, never defaulted', async () => {
			// ABSENCE MUST NOT READ AS "OPTIONAL". An unannotated prop has no
			// authored requiredness at all, and a consumer that saw `optional:
			// false` here would print a contract the author never wrote. The two
			// fields are supplied together or not at all, and every emitter
			// validator rejects the mismatched pairing.
			for (const file of FIXTURES.filter((name) => !ANNOTATED.includes(name))) {
				const ir = await fixtureIr(file);
				const withFlag = ir.components
					.flatMap((component) => component.props.entries)
					.filter((entry) => entry.optional !== undefined);
				expect(withFlag, `${file} should carry no authored requiredness`).toEqual([]);
			}
			// And the coupling holds in the annotated direction too, in every
			// annotated module rather than only in the first one.
			for (const file of ANNOTATED) {
				const annotated = await fixtureIr(file);
				for (const entry of annotated.components[0]!.props.entries)
					expect(entry.type === undefined, `${file} ${entry.sourceName}`).toBe(
						entry.optional === undefined,
					);
			}
		});

		test('CONTROL: an implicit-any member (`{ a }`) supplies NEITHER type nor requiredness', async () => {
			// `{ a }` inside a type literal is legal TS meaning `a: any`. There is no
			// member type to read, so there is no authored requiredness to report
			// either - the pair stays absent rather than half-supplied.
			const ir = await buildEnrichedIr({
				filename: 'probe.tsrx',
				source: `import { computed } from '@markless/core';

export function Probe({ label }: { label }) @{
	const derived = computed(() => \`\${label}\`);

	<output data-probe="">{derived}</output>
}
`,
			});
			expect(ir.components[0]!.props.entries[0]).toMatchObject({ sourceName: 'label' });
			expect(ir.components[0]!.props.entries[0]!.type).toBeUndefined();
			expect(ir.components[0]!.props.entries[0]!.optional).toBeUndefined();
		});
	});

	test('S2 carries complete branch and keyed-row subtrees plus structural computed dependencies', async () => {
		const ir = await fixtureIr('s2-keyed-todo.tsrx');
		const nodes = allTemplateNodes(ir);
		const branch = nodes.find((node) => node.kind === 'branch');
		const repeat = nodes.find((node) => node.kind === 'keyed-repeat');
		expect(branch?.kind).toBe('branch');
		if (branch?.kind !== 'branch') throw new Error('missing S2 branch');
		expect(branch.arms).toHaveLength(2);
		expect(
			walkTemplate(branch.arms[0]!.children).some(
				(node) => node.kind === 'host' && node.tag === 'p',
			),
		).toBe(true);
		expect(branch.arms[1]).toEqual({ kind: 'else', children: [] });
		expect(repeat?.kind).toBe('keyed-repeat');
		if (repeat?.kind !== 'keyed-repeat') throw new Error('missing S2 repeat');
		expect(repeat.key.expression.type).toBe('MemberExpression');
		expect(
			walkTemplate(repeat.row)
				.filter((node) => node.kind === 'host')
				.map((node) => (node as TemplateHost).tag),
		).toEqual(['li', 'input', 'input', 'button']);
		const summarize = (node: TemplateNode): unknown =>
			node.kind === 'host'
				? {
						tag: node.tag,
						staticAttributes: node.staticAttributes,
						dynamicBindings: node.dynamicBindings.map(({ kind, name, reads }) => ({
							kind,
							name,
							valuePath: reads.map(
								(read) => `${read.graphNodeId}/${read.path.join('/')}/${read.via}`,
							),
						})),
						children: node.children.map(summarize),
					}
				: node.kind === 'text'
					? { kind: 'text', value: node.value }
					: { kind: node.kind };
		expect(repeat.row.map(summarize)).toEqual([
			{
				tag: 'li',
				staticAttributes: [],
				dynamicBindings: [
					{
						kind: 'attribute',
						name: 'data-oracle-row-key',
						valuePath: ['state:todos/id/repeat-item'],
					},
				],
				children: [
					{
						tag: 'input',
						staticAttributes: [],
						dynamicBindings: [
							{
								kind: 'attribute',
								name: 'data-edit',
								valuePath: ['state:todos/id/repeat-item'],
							},
							{
								kind: 'property',
								name: 'value',
								valuePath: ['state:todos/title/repeat-item'],
							},
						],
						children: [],
					},
					{
						tag: 'input',
						staticAttributes: [{ name: 'type', value: 'checkbox' }],
						dynamicBindings: [
							{
								kind: 'attribute',
								name: 'data-toggle',
								valuePath: ['state:todos/id/repeat-item'],
							},
							{
								kind: 'property',
								name: 'checked',
								valuePath: ['state:todos/done/repeat-item'],
							},
						],
						children: [],
					},
					{
						tag: 'button',
						staticAttributes: [],
						dynamicBindings: [
							{
								kind: 'attribute',
								name: 'data-remove',
								valuePath: ['state:todos/id/repeat-item'],
							},
						],
						children: [{ kind: 'text', value: 'remove' }],
					},
				],
			},
		]);

		const complete = ir.records.bindings.find((binding) => binding.name === 'complete')!;
		expect(complete.computed?.expression.type).toBe('ArrowFunctionExpression');
		const fromSerializedAst = collectGraphReads(
			complete.computed!.expression,
			ir.records.bindings,
		);
		expect(fromSerializedAst.map((read) => read.graphNodeId)).toEqual(['state:todos']);
		expect(complete.computed?.reads.map((read) => read.graphNodeId)).toEqual(['state:todos']);
		expect(
			complete.computed?.reads.some((read) =>
				read.path.some((part) => part.includes('filter(')),
			),
		).toBe(false);
	});

	test('collectGraphReads fails closed when alpha-count and beta-count share the name count', () => {
		expect(() =>
			collectGraphReads({ type: 'Identifier', name: 'count' }, [
				{ id: 'alpha-count', name: 'count' },
				{ id: 'beta-count', name: 'count' },
			]),
		).toThrow(
			'GraphRead binding name collision for "count" between "alpha-count" and "beta-count"; component ownership is required.',
		);
	});

	test('S2 event effects are exact and temporary receiver mutation is not a graph write', async () => {
		const ir = await fixtureIr('s2-keyed-todo.tsrx');
		const effects = ir.records.events.map((event) => ({
			id: event.id,
			eventName: event.eventName,
			reads: event.handlers[0]!.reads.map(
				(read) => `${read.graphNodeId}/${read.path.join('/')}/${read.via}`,
			),
			writes: event.handlers[0]!.writes.map(
				(write) =>
					`${write.graphNodeId}/${write.path.join('/')}/${write.operation}/${write.via}`,
			),
		}));
		expect(effects).toEqual([
			{
				id: 'event:0',
				eventName: 'input',
				reads: [],
				writes: ['state:draft//assign/direct'],
			},
			{
				id: 'event:1',
				eventName: 'click',
				reads: [
					'prop:props/onTrace/alias',
					'state:draft//direct',
					'state:next//direct',
					'state:todos//direct',
				],
				writes: [
					'state:draft//assign/direct',
					'state:next//update/direct',
					'state:todos//assign/direct',
				],
			},
			{
				id: 'event:2',
				eventName: 'input',
				reads: [
					'prop:props/onTrace/alias',
					'state:todos//direct',
					'state:todos/id/repeat-item',
				],
				writes: [
					'state:todos//assign/direct',
					'state:todos/*/title/assign/handler-local-alias',
				],
			},
			{
				id: 'event:3',
				eventName: 'change',
				reads: [
					'prop:props/onTrace/alias',
					'state:todos//direct',
					'state:todos/id/repeat-item',
				],
				writes: [
					'state:todos//assign/direct',
					'state:todos/*/done/assign/handler-local-alias',
				],
			},
			{
				id: 'event:4',
				eventName: 'click',
				reads: [
					'prop:props/onTrace/alias',
					'state:todos//direct',
					'state:todos/id/repeat-item',
				],
				writes: ['state:todos//assign/direct'],
			},
			{
				id: 'event:5',
				eventName: 'click',
				reads: ['prop:props/onTrace/alias', 'state:todos//direct'],
				writes: ['state:todos//assign/direct'],
			},
			{
				id: 'event:6',
				eventName: 'click',
				reads: ['prop:props/onTrace/alias', 'state:todos/length/direct'],
				writes: ['state:todos//assign/direct'],
			},
		]);
		expect(ir.records.stateWrites.some((write) => write.method === 'reverse')).toBe(false);
	});

	test('every scripted callback is present in a setup initializer or real event-handler AST', async () => {
		const expected: Record<(typeof FIXTURES)[number], string[]> = {
			's1-render-once.tsrx': ['setup', 'change'],
			's2-keyed-todo.tsrx': ['add', 'edit', 'toggle', 'reorder', 'remove', 'clear'],
			's3-event-form.tsrx': ['text', 'checked', 'submit', 'bubble'],
			's4-nested-list.tsrx': ['flip', 'reorder', 'select'],
			's5-branch-teardown.tsrx': ['toggle', 'tick', 'pick', 'drop'],
			's6-whitespace-text.tsrx': ['widen', 'tick', 'pad'],
			's7-form-controls.tsrx': ['size', 'notes', 'pick', 'tag', 'resize', 'lock'],
			's8-async-handlers.tsrx': ['run', 'cancel'],
			's9-boolean-attributes.tsrx': ['seal', 'lock', 'unlock'],
			's10-todomvc.tsrx': [
				'add',
				'clear-completed',
				'commit',
				'destroy',
				'edit',
				'filter',
				'press',
				'revert',
				'toggle',
				'toggle-all',
			],
			// S10's ten names plus `remote-search`, which is the only NEW observation
			// channel the advanced app opens: it is the one handler whose trace fires
			// AFTER an `await`, so a lane that dropped the post-suspension tail would
			// lose exactly this name and no other.
			's11-todomvc-advanced.tsrx': [
				'add',
				'clear-completed',
				'commit',
				'destroy',
				'edit',
				'filter',
				'press',
				'remote-search',
				'revert',
				'toggle',
				'toggle-all',
			],
			// SIX NAMES, and only ONE of them - `press` - is shared with the two
			// TodoMVC fixtures. `send` is the only trace in the corpus that fires
			// after THREE awaits rather than one, so a lane that dropped any part of
			// the post-suspension tail would lose exactly this name; `open`,
			// `right-tab` and `bottom-tab` are the NAVIGATION channel the streaming
			// axis is measured against, which is what makes "streaming while the app
			// is navigated" observable in the trace rather than only on screen.
			's12-codex-clone.tsrx': [
				'bottom-tab',
				'new-chat',
				'open',
				'press',
				'right-tab',
				'send',
			],
			// NINE NAMES, and only ONE - `press` - is shared with the three earlier
			// applications. `press` is here for a MEASURED reason rather than for
			// symmetry: the Svelte emitter suppresses
			// [a11y_click_events_have_key_events,
			// a11y_no_noninteractive_element_interactions] at every `<form>` that
			// carries an event, and `assertCompilesClean` then proves the
			// suppression fires in BOTH directions. A footer search form with a
			// `submit` handler and no `click` handler makes that suppression
			// redundant, and this lane REFUSES the module outright: "Emitted Svelte
			// module HnFront.svelte suppresses [a11y_click_events_have_key_events,
			// a11y_no_noninteractive_element_interactions] but without those
			// annotations Svelte reports []. A suppression that changes nothing is a
			// silent over-fire." S10, S11 and S12 all happen to carry a `press`
			// trace on their forms, which is why no earlier fixture ever exposed it.
			// `vote` and `unvote` are the pair that makes a row's
			// DERIVED text observable: both write `points` and `pointsLabel` in one
			// unconditional top-level write, so a lane that re-rendered the row
			// without recomputing the label would keep the trace and lose the
			// screen. `nav` is the widest channel here at SIXTEEN inert sites
			// (logo, brand, seven header links, login, eight footer links), which is
			// what records that this app has NO page routing rather than hiding it:
			// `.tsrx` has no routing construct, so every one of them is
			// preventDefault + trace and nothing else.
			's13-hn-front.tsrx': [
				'comments',
				'hide',
				'more',
				'nav',
				'open',
				'press',
				'search',
				'unvote',
				'vote',
			],
			// ZERO NAMES, AND S14 IS THE ONLY FIXTURE IN THIS TABLE WITH AN EMPTY
			// LIST. That is a MEASUREMENT, not an omission, and it is the reason the
			// row is worth reading: a recursive component must forward every
			// required prop TO ITSELF, and the qwik emitter cannot forward a
			// FUNCTION prop across a component boundary in any spelling - it
			// declares and reads `onTrace$` and prints `onTrace` at the call site,
			// which that lane's own emitted-output typecheck rejects. Authoring the
			// prop as `onTrace$` only produces `onTrace$$`. Nothing in the corpus
			// had reached it because the composition fixtures forward only DATA
			// props and every scenario before this one is a single component. See
			// the fixture's constraint (18). THE ORACLE MOVED TO THE DOM INSTEAD:
			// collapse, expand and the comment upvote are the three recorded events,
			// and each of them changes what is on screen and what `[hidden]`
			// reports, which is a stronger observation than a callback. The
			// non-vacuity guard for this table is the CONTROL below, which requires
			// both the annotated and the unannotated sets to be non-empty across the
			// corpus - not every fixture to trace.
			's14-hn-item.tsrx': [],
			// TWO NAMES, AND THAT IS THE SMALLEST NON-EMPTY ROW IN THIS TABLE.
			// It is a MEASUREMENT of where this app's oracle lives, not a sign of a
			// thin app: S15 has EIGHTY-ONE hosts, more than any other fixture here,
			// and only two trace channels. `toggle` is the one interaction the card
			// exists to measure, and it is authored ONCE inside a keyed repeat, so
			// the six seeded habits share a single handler; `press` covers the four
			// INERT controls (the sidebar add, the sidebar toggle, `New habit` and
			// the theme toggle) whose only job is to record that this page has no
			// routing construct rather than to hide it. `nav` covers the two
			// sidebar links for the same reason.
			// THE REST OF THE PAGE IS DERIVED AND HAS NO CHANNEL AT ALL, which is
			// the point. The eight observables one `toggle` moves - the fill, two
			// strikethroughs in two different subtrees, the counter, the badge, the
			// progress class, the encouragement pair and today's dot - are every one
			// of them a `computed` or a `class`/`hidden` binding off the single
			// `habits` cell, so a lane that fired the trace and repainted only the
			// clicked row would be INDISTINGUISHABLE HERE and is caught in the DOM
			// instead. S14's row records the same move for a different reason.
			's15-habit-tracker.tsrx': ['nav', 'press', 'toggle'],
			// THREE NAMES, AND THE INTERESTING ONE IS THE NAME THAT IS NOT HERE.
			// S16 is the DRAG card, and there is no `drag`, `drop` or `pointer`
			// channel in this row because no two-word DOM event ships on that page -
			// see the fixture header for the measurement that decided it. `move` is
			// the interaction that replaced it and it is authored TWICE, once per
			// arrow, which is the only interaction in this corpus whose two handlers
			// differ by a single identifier (`prevId` against `nextId`); the pair is
			// deliberate, because a single handler taking a direction would have
			// needed either a second argument channel or an `if`, and DEFECTS.md 8.1
			// closes the second door. `press` covers the SEVEN inert controls and
			// `nav` the three sidebar links, exactly as S15's row does.
			// THE REST OF THE PAGE IS DERIVED AND HAS NO CHANNEL AT ALL: the two
			// column counts, the shipped counter, the total, the summary sentence and
			// its emoji, the empty placeholder and the two arrows' own `hidden` are
			// every one of them a `computed` or a binding off the single `columns`
			// cell, so a lane that fired `move` and repainted only the clicked column
			// would be INDISTINGUISHABLE HERE and is caught in the DOM instead.
			's16-task-board.tsrx': ['move', 'nav', 'press'],
			// EIGHT NAMES, THE MOST OF ANY FIXTURE HERE, AND SEVEN OF THEM EXIST
			// BECAUSE THE AXIS IS FORM INPUT TYPES. `field` is authored FOURTEEN
			// times - once per control on the new-contact form - and carries the
			// control's own name in its detail rather than being split into fourteen
			// channels, because what this card measures is whether each TYPE lowers
			// and fires, not whether fourteen distinct trace names can be spelled.
			// `search` and `statusfilter` are separate names for the two controls
			// that write the VIEW rather than the draft, and they are separate from
			// `tagfilter` because the three reach the same three observables - every
			// card's `hidden`, the shown counter and the summary pair - by three
			// different routes, which is what distinguishes a page that re-derives
			// from one that repaints. `add` is the `<form>`'s submit channel and
			// `reset` the sidebar button that writes FOURTEEN cells at once, the only
			// multi-cell write in the corpus. `press` covers the six inert controls
			// (the sidebar toggle, the two view-mode buttons, the theme toggle) plus
			// the `<form>`'s own click trace, which constraint (16) requires: a form
			// with a submit handler and no click handler makes the Svelte emitter's
			// a11y suppression redundant and the module is refused. `nav` covers the
			// four sidebar links and the five company links.
			's17-contacts.tsrx': [
				'add',
				'field',
				'nav',
				'press',
				'reset',
				'search',
				'statusfilter',
				'tagfilter',
			],
		};
		for (const file of FIXTURES) {
			const ir = await fixtureIr(file);
			const names = [
				...ir.components.flatMap((component) =>
					component.locals.flatMap((local) =>
						local.initializer ? callbackNames(local.initializer) : [],
					),
				),
				...ir.records.events.flatMap((event) =>
					event.handlers.flatMap((handler) => callbackNames(handler.expression)),
				),
			];
			expect([...new Set(names)].sort()).toEqual([...expected[file]].sort());
			for (const event of ir.records.events) {
				expect(event.handlers).toHaveLength(1);
				expect(event.handlers[0]!.expression.type).toBe('ArrowFunctionExpression');
				// A handler must do something the IR records. Usually that is a graph read
				// or write; S3's cancel-submit handler does neither — its whole body is
				// `event.preventDefault()`, so its only recorded effect is the syncPolicy.
				// Cancellation is an observable effect, so it satisfies the same intent.
				const handler = event.handlers[0]!;
				expect(
					handler.reads.length + handler.writes.length > 0 ||
						(event.syncPolicy?.actions.length ?? 0) > 0,
				).toBe(true);
			}
		}
	});

	test('S3 exposes live property sites, cancellation, bubbling, and both submit writes', async () => {
		const ir = await fixtureIr('s3-event-form.tsrx');
		const properties = hosts(ir).flatMap((host) =>
			host.dynamicBindings
				.filter((binding) => binding.kind === 'property')
				.map((binding) => binding.name),
		);
		expect(properties.sort()).toEqual(['checked', 'value']);
		const submit = ir.records.events.find(
			(event) =>
				event.syncPolicy && callbackNames(event.handlers[0]!.expression).includes('submit'),
		)!;
		expect(submit.syncPolicy).toEqual({
			when: { type: 'constant-truthy', value: true },
			actions: ['preventDefault'],
		});
		expect(submit.handlers[0]!.writes.map((write) => write.graphNodeId)).toEqual([
			'state:writes',
			'state:writes',
		]);
		const formBubble = ir.records.events.find((event) => event.hostNodeId === 'h0')!;
		expect(callbackNames(formBubble.handlers[0]!.expression)).toEqual(['bubble']);
	});
});

describe('nested repeats sourced from the enclosing repeat item', () => {
	/**
	 * T033. `@markless/compiler` 0.1.1 leaves `collectionGraphNodeId` unset when a
	 * nested repeat's collection is a member of the ENCLOSING repeat item
	 * (`group.rows`). `build.ts` used to guard on that field and skip registering
	 * the inner loop variable, so every read off `row` silently lowered to
	 * `reads: []` — and FIVE of six emitters printed correct-LOOKING output over
	 * that IR because they walk the template rather than the reads.
	 *
	 * This test is the instrument. Before the repair it reported seven zero-read
	 * sites: `repeat:1 key` plus every dynamic binding inside the nested row.
	 */
	function dynamicSites(ir: EnrichedIR): Array<{
		readonly label: string;
		readonly reads: readonly { graphNodeId: string }[];
	}> {
		const sites: Array<{ label: string; reads: readonly { graphNodeId: string }[] }> = [];
		for (const node of allTemplateNodes(ir)) {
			if (node.kind === 'dynamic-text') sites.push({ label: `${node.id} text`, ...node });
			if (node.kind === 'host')
				for (const binding of node.dynamicBindings)
					sites.push({ label: `host ${node.id} ${binding.name}`, reads: binding.reads });
			if (node.kind === 'branch') sites.push({ label: `${node.id} branch`, ...node });
			if (node.kind === 'keyed-repeat') {
				sites.push({ label: `${node.id} collection`, reads: node.collection.reads });
				sites.push({ label: `${node.id} key`, reads: node.key.reads });
			}
		}
		return sites;
	}

	test('S4: no dynamic site inside the nested row lowers to reads: []', async () => {
		const ir = await compileOnlyFixtureIr('s4-nested-list.tsrx');
		const sites = dynamicSites(ir);
		expect(sites.length).toBe(16);
		expect(sites.filter((site) => site.reads.length === 0).map((site) => site.label)).toEqual(
			[],
		);
		const graphIds = new Set(ir.records.bindings.map((binding) => binding.id));
		for (const site of sites)
			for (const read of site.reads) expect(graphIds.has(read.graphNodeId)).toBe(true);
	});

	test('S4: the inner repeat resolves against the outer item, key included', async () => {
		const ir = await compileOnlyFixtureIr('s4-nested-list.tsrx');
		const repeats = allTemplateNodes(ir).filter((node) => node.kind === 'keyed-repeat');
		expect(repeats.map((node) => (node.kind === 'keyed-repeat' ? node.item : ''))).toEqual([
			'group',
			'row',
		]);
		const inner = repeats[1]!;
		if (inner.kind !== 'keyed-repeat') throw new Error('missing S4 inner repeat');
		expect(inner.collection.reads).toEqual([
			{ graphNodeId: 'state:groups', path: ['rows'], via: 'repeat-item' },
		]);
		expect(inner.key.reads).toEqual([
			{ graphNodeId: 'state:groups', path: ['rows', 'id'], via: 'repeat-item' },
		]);
		// The handler inside the inner row reads BOTH loop variables.
		const select = ir.records.events.find((event) => event.hostNodeId === 'h9')!;
		expect(
			select.handlers[0]!.reads.map(
				(read) => `${read.graphNodeId}/${read.path.join('/')}/${read.via}`,
			),
		).toEqual([
			'prop:props/onTrace/alias',
			'state:groups/id/repeat-item',
			'state:groups/rows/id/repeat-item',
		]);
	});

	test('an unresolvable nested collection fails closed LOUDLY, never into reads: []', async () => {
		const source = `import { state } from '@markless/core';

export function Indexed({ seed }) @{
	let groups = state(seed);
	let rowsByGroup = state({});

	<ul data-indexed="true">
		@for (const group of groups; key group.id) {
			<li data-group={group.id}>
				@for (const row of rowsByGroup[group.id]; key row.id) {
					<span data-row={row.id}>x</span>
				}
			</li>
		}
	</ul>
}
`;
		await expect(buildEnrichedIr({ filename: 'indexed.tsrx', source })).rejects.toThrow(
			/Keyed repeat repeat:1 collection cannot be resolved to a single graph location/,
		);
	});
});

describe('a branch that tears a POPULATED arm down at runtime', () => {
	/**
	 * T026. Deliberately its own walker rather than a reuse of the nested-repeat
	 * describe's `dynamicSites`: S5's claim is about branch ARMS, and a shared
	 * helper would make S5's measurement depend on a function S4 also drives. The
	 * same reason `measureCellKeys` is not a refactor of `measureRowKeys`.
	 */
	function armSites(ir: EnrichedIR): Array<{ label: string; reads: readonly unknown[] }> {
		const sites: Array<{ label: string; reads: readonly unknown[] }> = [];
		for (const node of allTemplateNodes(ir)) {
			if (node.kind === 'dynamic-text') sites.push({ label: `${node.id} text`, reads: node.reads });
			if (node.kind === 'host')
				for (const binding of node.dynamicBindings)
					sites.push({ label: `host ${node.id} ${binding.name}`, reads: binding.reads });
			if (node.kind === 'branch') sites.push({ label: `${node.id} branch`, reads: node.reads });
			if (node.kind === 'keyed-repeat') {
				sites.push({ label: `${node.id} collection`, reads: node.collection.reads });
				sites.push({ label: `${node.id} key`, reads: node.key.reads });
			}
		}
		return sites;
	}

	test('S5: no dynamic site in either arm lowers to reads: []', async () => {
		const ir = await compileOnlyFixtureIr('s5-branch-teardown.tsrx');
		const sites = armSites(ir);
		expect(sites.length).toBe(10);
		expect(sites.filter((site) => site.reads.length === 0).map((site) => site.label)).toEqual([]);
	});

	test('S5: the branch is guarded by STATE and both arms are populated', async () => {
		const ir = await compileOnlyFixtureIr('s5-branch-teardown.tsrx');
		const branches = allTemplateNodes(ir).filter((node) => node.kind === 'branch');
		expect(branches).toHaveLength(1);
		const branch = branches[0]!;
		if (branch.kind !== 'branch') throw new Error('missing S5 branch');
		// The whole point of the scenario. s1's branch is selected by a STATIC
		// prop and s2's `@else` arm is EMPTY, so before S5 no branch in the corpus
		// could tear a populated subtree down at runtime.
		expect(branch.reads.map((read) => read.graphNodeId)).toEqual(['state:phase']);
		expect(branch.arms).toHaveLength(2);
		for (const arm of branch.arms) expect(arm.children.length).toBeGreaterThan(0);
	});

	test('S5: a handler and a keyed list live INSIDE the arm that gets torn down', async () => {
		const ir = await compileOnlyFixtureIr('s5-branch-teardown.tsrx');
		const branch = allTemplateNodes(ir).find((node) => node.kind === 'branch');
		if (branch?.kind !== 'branch') throw new Error('missing S5 branch');
		const inArm = (index: number): TemplateNode[] => walkTemplate(branch.arms[index]!.children);
		const repeats = inArm(0).filter((node) => node.kind === 'keyed-repeat');
		expect(repeats).toHaveLength(1);
		const hostIdsInLiveArm = new Set(inArm(0).map((node) => node.id));
		const hostIdsInIdleArm = new Set(inArm(1).map((node) => node.id));
		const handlersIn = (ids: Set<string>) =>
			ir.records.events.filter((event) => ids.has(event.hostNodeId)).length;
		// Two in the live arm (`tick` on the arm itself, `pick` inside the keyed
		// list) and one in the idle arm (`drop`). Every one of them is destroyed
		// and rebuilt by the flip.
		expect(handlersIn(hostIdsInLiveArm)).toBe(2);
		expect(handlersIn(hostIdsInIdleArm)).toBe(1);
	});
});

describe('text nodes whose exact characters are the observable', () => {
	/**
	 * T027. Its own walker again, for the reason `armSites` gives: S6's claim is
	 * about the CHARACTERS of static text and about what sits either side of it,
	 * and a shared helper would make S6's measurement depend on a function S4 and
	 * S5 also drive.
	 */
	function textSites(ir: EnrichedIR): Array<{ label: string; reads: readonly unknown[] }> {
		const sites: Array<{ label: string; reads: readonly unknown[] }> = [];
		for (const node of allTemplateNodes(ir)) {
			if (node.kind === 'dynamic-text') sites.push({ label: `${node.id} text`, reads: node.reads });
			if (node.kind === 'host')
				for (const binding of node.dynamicBindings)
					sites.push({ label: `host ${node.id} ${binding.name}`, reads: binding.reads });
			if (node.kind === 'branch') sites.push({ label: `${node.id} branch`, reads: node.reads });
			if (node.kind === 'keyed-repeat') {
				sites.push({ label: `${node.id} collection`, reads: node.collection.reads });
				sites.push({ label: `${node.id} key`, reads: node.key.reads });
			}
		}
		return sites;
	}

	function staticTexts(ir: EnrichedIR): string[] {
		return allTemplateNodes(ir)
			.filter((node) => node.kind === 'text')
			.map((node) => (node.kind === 'text' ? node.value : ''));
	}

	test('S6: no dynamic site lowers to reads: []', async () => {
		const ir = await compileOnlyFixtureIr('s6-whitespace-text.tsrx');
		const sites = textSites(ir);
		expect(sites.length).toBe(14);
		expect(sites.filter((site) => site.reads.length === 0).map((site) => site.label)).toEqual([]);
	});

	/**
	 * THE CONSTRAINT THE FIXTURE IS AUTHORED UNDER, asserted rather than left as a
	 * comment. `escapeText` in the Angular emitter throws on any template text
	 * whose own edges are whitespace, and the Vue gate rejects the same shape after
	 * condense. A future edit that adds `<p>{a} of {b}</p>` to this fixture would
	 * otherwise be discovered as a THROW three lanes downstream.
	 */
	test('S6: every static text node is trim-stable and non-empty', async () => {
		const ir = await compileOnlyFixtureIr('s6-whitespace-text.tsrx');
		const texts = staticTexts(ir);
		expect(texts.length).toBeGreaterThan(0);
		expect(texts.filter((value) => value !== value.trim() || value.length === 0)).toEqual([]);
	});

	/**
	 * THE INPUT SIDE OF THE WHITESPACE FINDING. MEASURED at `@markless/compiler`
	 * 0.1.1, not assumed:
	 *
	 *   `tab\there`    -> `tab here`      a TAB becomes exactly one space
	 *   `x\ny`         -> `x y`           a NEWLINE becomes exactly one space
	 *   `tab\t\there`  -> `tab  here`     one space PER tab, NOT condensed
	 *
	 * So an emitter can never be handed a tab or a newline inside template text
	 * from a `.tsrx` source, and the lanes' divergent treatment of those two
	 * characters is unreachable from this toolchain.
	 *
	 * AMENDED BY T039. This test used to assert that `two  spaces` and `a   b`
	 * survive into the IR verbatim - which they still do, mechanically, inside
	 * `normalizeJsxText`. They no longer survive into an IR anyone can obtain: the
	 * interior-whitespace v-limit refuses them one line later. The third row above
	 * is the reason the limit had to sit at the compiler rather than in a gate -
	 * the tab mapping is a 1:1 character map, so `normalizeJsxText` MANUFACTURES a
	 * space run out of a tab run. That half of the measurement is asserted in the
	 * v-limit's own suite below, read out of the refusal message, which is now the
	 * only place the produced value is observable.
	 */
	test('S6: the IR maps tabs and newlines to one space each', async () => {
		const ir = await compileOnlyFixtureIr('s6-whitespace-text.tsrx');
		expect(staticTexts(ir)).toContain('one two three');
		expect(await probeTexts('tab\there')).toEqual(['tab here']);
		expect(await probeTexts('x\ny')).toEqual(['x y']);
		expect(await probeTexts('one two three')).toEqual(['one two three']);
	});

	/**
	 * The three adjacencies the scenario exists to measure, each of which a
	 * pretty-printer could break across lines and silently widen:
	 * interpolation/text/interpolation, text/interpolation/interpolation/text and
	 * three interpolations with nothing at all between them.
	 */
	test('S6: the corpus gains runs of adjacent dynamic text with no whitespace', async () => {
		const ir = await compileOnlyFixtureIr('s6-whitespace-text.tsrx');
		const runs = allTemplateNodes(ir)
			.filter((node) => node.kind === 'host')
			.map((node) =>
				node.kind === 'host'
					? node.children
							.map((child) =>
								child.kind === 'text'
									? JSON.stringify(child.value)
									: child.kind === 'dynamic-text'
										? '{}'
										: `<${child.kind}>`,
							)
							.join('')
					: '',
			);
		expect(runs).toContain('{}"/"{}');
		expect(runs).toContain('"start"{}{}"end"');
		expect(runs).toContain('{}{}{}');
	});
});

/**
 * T039, implementing the T038 ruling. `docs/DEFECTS.md` entry 7.
 *
 * The compiler refuses a static text node whose value contains two adjacent
 * whitespace characters, or any whitespace character that is not U+0020. This
 * suite is the instrument that makes that refusal real, and it has to do two
 * separate jobs, because the rule fires on NOTHING that exists:
 *
 *   1. CALIBRATION. Planted violations must go RED, and the legal neighbours of
 *      each one must stay GREEN. A guard measured at zero violations across the
 *      whole live corpus is unfalsifiable until it is shown failing on purpose.
 *   2. THE LIFT TRIGGER. The cross-lane matrix records what each lane's own
 *      compiler does to a space run and to a single U+00A0. If ANY single lane
 *      moves in EITHER direction, that test goes red and the ruling is re-opened
 *      on evidence rather than on memory - including the good direction, because
 *      a lane that STARTS preserving is what would let the v-limit be lifted.
 */
describe('the interior-whitespace v-limit', () => {
	const SPACE = String.fromCharCode(0x20);
	const NBSP = String.fromCharCode(0x00a0);
	const THIN = String.fromCharCode(0x2009);
	const IDEOGRAPHIC = String.fromCharCode(0x3000);
	const ZWSP = String.fromCharCode(0x200b);

	/**
	 * RED, half one: a run of ordinary spaces. This is the 3-3 row - react, qwik
	 * and svelte serve it verbatim; solid, vue and angular each condense it.
	 */
	test('a planted run of U+0020 is REFUSED, at any length', async () => {
		expect(await probeRefusal('two' + SPACE + SPACE + 'spaces')).toContain(
			JSON.stringify('two  spaces'),
		);
		expect(await probeRefusal('a' + SPACE.repeat(3) + 'b')).toContain(JSON.stringify('a   b'));
	});

	/**
	 * RED, half two, and the half that disqualifies normalisation. On a whitespace
	 * character that is not U+0020 the matrix is 5-1, not 3-3: solid alone rewrites
	 * the character's IDENTITY. Refusing a SINGLE such character - no run at all -
	 * is therefore not over-reach, it is the tighter of the two halves.
	 */
	test('a single non-U+0020 whitespace character is REFUSED, with no run at all', async () => {
		for (const character of [NBSP, THIN, IDEOGRAPHIC]) {
			const message = await probeRefusal('one' + character + 'two');
			expect(message).toContain(
				`U+${character.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}`,
			);
		}
	});

	/**
	 * The compiler is the right layer because it is one of the two things PRODUCING
	 * the construct. `normalizeJsxText` maps `\t` to one space PER TAB - a 1:1
	 * character map, not a condense - so a tab run becomes a space run that the
	 * author never typed. The produced value is no longer observable in any IR, so
	 * it is read back out of the refusal message; this is the surviving half of the
	 * measurement the S6 suite above used to make directly.
	 */
	test('a TAB RUN is manufactured by normalizeJsxText and then caught by the v-limit', async () => {
		expect(await probeRefusal('tab\t\there')).toContain(JSON.stringify('tab  here'));
		expect(await probeRefusal('one\t\t\ttwo')).toContain(JSON.stringify('one   two'));
	});

	/**
	 * GREEN, and the reason the refusal is a reduction in SPELLING rather than in
	 * capability. Whitespace carried as a VALUE is preserved by all six lanes, and
	 * `demos/react-official/three-way-contract.ts` already asserts it equal across
	 * six as `[ wide  load ]`. S6's own fixture is spelled `<p data-wrap>[{note}]</p>`
	 * for exactly this reason.
	 */
	test('the portable spelling - whitespace carried as an interpolated VALUE - still compiles', async () => {
		expect(await probeTexts('[{a}]')).toEqual(['[', ']']);
		expect(await probeTexts('one two three')).toEqual(['one two three']);
		expect(await probeTexts('single spaces are fine')).toEqual(['single spaces are fine']);
	});

	/**
	 * TEXT-NODE EDGES ARE OUT OF SCOPE, asserted rather than left to a comment,
	 * because the edge form of this same predicate is the tempting widening and it
	 * would break four live demo texts (`" open"` in the two `TaskList.tsrx`,
	 * `" seats"` in the two `PricingCard.tsrx`). Those shapes are guarded downstream
	 * in the two lanes that cannot express them; they are not the compiler's to
	 * refuse, and this test is what stops a later reader "completing" the rule.
	 */
	test('a whitespace EDGE is deliberately NOT refused', async () => {
		expect(await probeTexts('{a} open')).toEqual([' open']);
		expect(await probeTexts('{a} seats')).toEqual([' seats']);
	});

	/**
	 * ZWSP is not whitespace under `\s`, and every lane passes it through. It is in
	 * the suite as the negative control for the `[^\S ]` half: that half must select
	 * whitespace, not "unusual character".
	 */
	test('U+200B is not whitespace and is NOT refused', async () => {
		expect(await probeTexts('one' + ZWSP + 'two')).toEqual(['one' + ZWSP + 'two']);
	});

	/**
	 * The message is load-bearing - it is the permanent record of the finding at the
	 * point of use, and the ONLY thing an author who trips this will read. Two of
	 * its claims are asserted because getting either wrong makes the refusal worse
	 * than useless: it must point at the interpolated spelling, and it must NOT
	 * point at a non-breaking space, which is the advice a reader would otherwise
	 * reach for and which is WRONG in solid - the one lane it would be meant for.
	 */
	test('the refusal names the value, the split, and the portable spelling - and never suggests NBSP', async () => {
		const message = await probeRefusal('two' + SPACE + SPACE + 'spaces');
		expect(message).toContain(JSON.stringify('two  spaces'));
		expect(message).toContain('probe.tsrx');
		expect(message).toContain('THREE OF SIX LANES REWRITE IT');
		expect(message).toContain('INTERPOLATED VALUE');
		expect(message).toContain('[ wide  load ]');
		expect(message).not.toMatch(/&nbsp;|&#160;|&#xa0;/i);
		expect(message).not.toMatch(/[^\S ]| /);
	});

	/**
	 * THE GUARD'S MEASURED ZERO, locked in. Every shipped compiler fixture satisfies
	 * the predicate today; the wider scan over every live `.tsrx` in `demos/`,
	 * `packages/` and `poc/` found 0 interior violations in 108 static text nodes,
	 * re-derived by T039. This asserts the half of that scan this package owns, so
	 * that a fixture edit which trips the limit is reported HERE as a fixture
	 * problem rather than as six mysterious downstream failures.
	 */
	test('every shipped fixture is already free of interior whitespace', async () => {
		for (const file of FIXTURES) {
			const ir = await fixtureIr(file);
			const offenders = allTemplateNodes(ir)
				.filter((node) => node.kind === 'text')
				.map((node) => (node.kind === 'text' ? node.value : ''))
				.filter((value) => /\s\s/.test(value) || /[^\S ]/.test(value));
			expect({ file, offenders }).toEqual({ file, offenders: [] });
		}
	});
});

/**
 * THE LIFT TRIGGER, and the only test in this repo that runs all six lanes' own
 * template compilers side by side.
 *
 * WHAT IS ASSERTED AND WHAT IS MERELY RECORDED, stated deliberately. The
 * BEHAVIOUR is asserted strictly: if any single lane's answer moves in either
 * direction this goes red. The VERSIONS are recorded and attached to the failure
 * output rather than asserted, because three of the six lanes are pinned with a
 * caret (`svelte ^5.56.1`, `@vue/compiler-sfc ^3.5.40`, `@angular/compiler
 * ^22.0.8`) and asserting exact versions would produce a red on every unrelated
 * patch bump - a red that is expected is a red nobody reads. The ruling's trigger
 * is "a version bump that MOVES a lane", which is exactly the behaviour assertion.
 *
 * MEASURED BY T039 on 2026-07-27, at: react-dom 19.2.3, @qwik.dev/optimizer
 * 2.1.0-beta.5 (loaded by @qwik.dev/core 2.0.0-beta.38), svelte 5.56.8,
 * babel-preset-solid 1.9.12, @vue/compiler-sfc 3.5.40, @angular/compiler 22.0.8.
 *
 * THE QWIK CELL WAS THE HOLE THIS TEST EXISTS TO CLOSE. T038 could not measure
 * Qwik on non-ASCII whitespace: `@qwik.dev/core`'s `./optimizer` subpath exports
 * only `qwikVite` and `qwikRollup`, no callable transform. The callable one is
 * `createOptimizer()` in `@qwik.dev/optimizer`, which core loads internally and
 * which resolves from core's OWN node_modules - reached below without hard-coding
 * a store path. MEASURED: Qwik PRESERVES the space run AND the U+00A0, putting it
 * on the preserving side of the 5-1 split and confirming that solid is alone.
 */
describe('the six-lane whitespace matrix', () => {
	const REPO_ROOT = new URL('../../../', import.meta.url);
	const laneRequire = (lane: string) =>
		createRequire(fileURLToPath(new URL(`packages/frameworks/${lane}/package.json`, REPO_ROOT)));
	const laneImport = async (lane: string, specifier: string): Promise<Record<string, unknown>> => {
		const resolved = pathToFileURL(laneRequire(lane).resolve(specifier)).href;
		return (await import(/* @vite-ignore */ resolved)) as Record<string, unknown>;
	};
	// Several of these resolve to CJS under the `require` condition, so the callable
	// surface arrives on `default` rather than as a named export.
	const interop = <T>(module: Record<string, unknown>, key: string): T => {
		const direct = module[key];
		if (direct !== undefined) return direct as T;
		const fallback = (module.default as Record<string, unknown> | undefined)?.[key];
		if (fallback === undefined) throw new Error(`No export ${key} on the resolved module.`);
		return fallback as T;
	};
	const laneVersion = (lane: string, name: string): string =>
		(laneRequire(lane)(`${name}/package.json`) as { version: string }).version;

	const SPACE_RUN = 'one' + String.fromCharCode(0x20, 0x20) + 'two';
	const NBSP_ONE = 'one' + String.fromCharCode(0x00a0) + 'two';

	// Every lane below emits the probe text between the two anchors `one` and
	// `two`, so one extractor reads all of them. Deliberately non-greedy: it takes
	// the FIRST such span, which is the template text and not a later re-emission.
	const between = (haystack: string): string => haystack.match(/one[\s\S]*?two/)?.[0] ?? '(absent)';

	async function measureLanes(text: string): Promise<Record<string, string>> {
		const react = await laneImport('react', 'react');
		const reactServer = await laneImport('react', 'react-dom/server.node');
		const createElement = interop<(tag: string, props: null, child: string) => unknown>(
			react,
			'createElement',
		);
		const renderToStaticMarkup = interop<(element: unknown) => string>(
			reactServer,
			'renderToStaticMarkup',
		);

		const svelte = await laneImport('svelte', 'svelte/compiler');
		const compileSvelte = interop<
			(source: string, options: { generate: string }) => { js: { code: string } }
		>(svelte, 'compile');

		const babel = await laneImport('solid', '@babel/core');
		const transformSync = interop<(source: string, options: unknown) => { code: string }>(
			babel,
			'transformSync',
		);
		const solidPreset = laneRequire('solid').resolve('babel-preset-solid');

		const vue = await laneImport('vue', '@vue/compiler-sfc');
		const parseSfc = interop<
			(source: string, options: { filename: string }) => { descriptor: { template: SfcTemplate } }
		>(vue, 'parse');

		const angular = await laneImport('angular', '@angular/compiler');
		const parseTemplate = interop<
			(template: string, url: string) => { nodes: readonly AngularNode[] }
		>(angular, 'parseTemplate');

		// `@qwik.dev/core`'s ./optimizer subpath exposes only bundler plugins. The
		// callable transform lives in `@qwik.dev/optimizer`, which core loads itself
		// and which is linked into core's own node_modules - so it is resolved THROUGH
		// core rather than as a bare specifier or a hard-coded store path.
		const coreRequire = createRequire(laneRequire('qwik').resolve('@qwik.dev/core/package.json'));
		const optimizerManifest = coreRequire('@qwik.dev/optimizer/package.json') as {
			exports: { '.': { import: string } };
		};
		const optimizerEntry = new URL(
			optimizerManifest.exports['.'].import,
			pathToFileURL(coreRequire.resolve('@qwik.dev/optimizer/package.json')),
		).href;
		const { createOptimizer } = (await import(/* @vite-ignore */ optimizerEntry)) as {
			createOptimizer: () => Promise<QwikOptimizer>;
		};
		const optimizer = await createOptimizer();
		const qwikModules = await optimizer.transformModules({
			srcDir: '/src',
			input: [{ path: 'probe.tsx', code: `export const C = () => <p>${text}</p>;\n` }],
			sourceMaps: false,
			minify: 'none',
			transpileTs: true,
			transpileJsx: true,
			mode: 'lib',
		});

		const vueText = parseSfc(`<template><p>${text}</p></template>`, {
			filename: 'probe.vue',
		}).descriptor.template.ast.children.find((child) => child.tag === 'p')?.children[0]?.content;

		const angularText = parseTemplate(`<p>${text}</p>`, 'probe.html')
			.nodes.find((node) => node.name === 'p')
			?.children.find((child) => typeof child.value === 'string')?.value;

		return {
			react: renderToStaticMarkup(createElement('p', null, text))
				.replace(/^<p>/, '')
				.replace(/<\/p>$/, ''),
			qwik: between(qwikModules.modules.map((module) => module.code).join('\n')),
			svelte: between(compileSvelte(`<p>${text}</p>`, { generate: 'server' }).js.code),
			solid: between(
				transformSync(`const C = () => <p>${text}</p>;`, {
					presets: [[solidPreset, { generate: 'ssr', hydratable: false }]],
					filename: 'probe.jsx',
					babelrc: false,
					configFile: false,
				}).code,
			),
			vue: vueText ?? '(absent)',
			angular: angularText ?? '(absent)',
		};
	}

	const codePoints = (value: string): string =>
		[...value]
			.map((character) => character.codePointAt(0)!.toString(16).padStart(4, '0'))
			.join(' ');

	const versions = (): Record<string, string> => ({
		react: laneVersion('react', 'react-dom'),
		qwik: laneVersion('qwik', '@qwik.dev/core'),
		svelte: laneVersion('svelte', 'svelte'),
		solid: laneVersion('solid', 'babel-preset-solid'),
		vue: laneVersion('vue', '@vue/compiler-sfc'),
		angular: laneVersion('angular', '@angular/compiler'),
	});

	/**
	 * A RUN OF U+0020 SPLITS THE SIX 3-3. This is the row the whole finding started
	 * from, and the row that makes the construct non-neutral.
	 */
	test('a run of U+0020: react, qwik and svelte PRESERVE; solid, vue and angular CONDENSE', async () => {
		const measured = await measureLanes(SPACE_RUN);
		expect(mapValues(measured, codePoints), `measured at ${JSON.stringify(versions())}`).toEqual({
			react: '006f 006e 0065 0020 0020 0074 0077 006f',
			qwik: '006f 006e 0065 0020 0020 0074 0077 006f',
			svelte: '006f 006e 0065 0020 0020 0074 0077 006f',
			solid: '006f 006e 0065 0020 0074 0077 006f',
			vue: '006f 006e 0065 0020 0074 0077 006f',
			angular: '006f 006e 0065 0020 0074 0077 006f',
		});
	});

	/**
	 * A SINGLE U+00A0 SPLITS THE SIX 5-1, AND SOLID IS ALONE. This is the row T027
	 * did not have and the row that disqualifies normalisation: the two lanes that
	 * DO condense space runs, vue and angular, both preserve U+00A0 byte-for-byte.
	 * Making all six agree would therefore mean normalising FIVE lanes down to
	 * solid's floor and deleting non-breaking-space semantics product-wide.
	 *
	 * The qwik cell here is the one T038 recorded as unmeasured. It is PRESERVE.
	 */
	test('a single U+00A0: only solid rewrites it, and it rewrites it to U+0020', async () => {
		const measured = await measureLanes(NBSP_ONE);
		expect(mapValues(measured, codePoints), `measured at ${JSON.stringify(versions())}`).toEqual({
			react: '006f 006e 0065 00a0 0074 0077 006f',
			qwik: '006f 006e 0065 00a0 0074 0077 006f',
			svelte: '006f 006e 0065 00a0 0074 0077 006f',
			solid: '006f 006e 0065 0020 0074 0077 006f',
			vue: '006f 006e 0065 00a0 0074 0077 006f',
			angular: '006f 006e 0065 00a0 0074 0077 006f',
		});
	});
});

/**
 * T049, implementing the T041 ruling. `docs/DEFECTS.md` entry 10.
 *
 * THE DEFECT. `@markless/compiler` classifies a dynamic binding as a DOM
 * property for exactly three names - `value`, `checked`, `selected` - so a
 * dynamic `disabled` arrived as `kind: 'attribute'`, Angular emitted
 * `[attr.disabled]`, and `disabled={false}` served `disabled="false"`, which
 * DISABLES the control, where the other five lanes served nothing. `checked`
 * did not invert in S7 and `disabled` did, and the three-name list is why.
 *
 * WHAT THIS SUITE IS FOR. The corpus cannot catch this: no fixture binds a
 * boolean content attribute, so there is nothing for the mutation budget to
 * mutate, and registering one would enlist every lane's derived inventories at
 * once. So the instrument is a probe source plus this registered matrix, on the
 * T039 precedent.
 *
 * IT IS TWO-SIDED ON PURPOSE. Every row asserts a kind, and the excluded rows
 * carry the reason they are excluded. NARROWING the set goes red (an included
 * name falls back to `attribute`) and WIDENING it goes red too (an excluded name
 * becomes `property`) - so neither a careless deletion nor a careless addition
 * can pass, and the admission rule in `build.ts` has an enforcer rather than a
 * doc comment.
 *
 * THE RULE IS NAME-BASED, NOT TAG-BASED, which is why every row below sits on
 * the same `<span>`. The IR classifies `disabled` the same way wherever it is
 * written; whether the author put it on an element that HAS that property is
 * Angular's dev-mode `isPropertyValid` check to make, downstream, and is one of
 * the named costs of this repair.
 */
describe('the boolean-attribute lowering matrix', () => {
	/**
	 * Each row is `[attribute name, expected IR kind, why]`. The `why` is not
	 * decoration: it is the admission-rule clause the name passed or failed, and
	 * it is what a future reader needs in order to add a name without re-deriving
	 * the whole table.
	 */
	const MATRIX: ReadonlyArray<readonly [string, 'property' | 'attribute', string]> = [
		// ADMITTED - boolean content attribute, lowercase spelling reaches the
		// browser property (or Angular maps it), and domino reflects it.
		['async', 'property', 'HTMLScriptElement.async'],
		['autofocus', 'property', 'HTMLOrSVGElement.autofocus'],
		['autoplay', 'property', 'HTMLMediaElement.autoplay'],
		['controls', 'property', 'HTMLMediaElement.controls'],
		['default', 'property', 'HTMLTrackElement.default'],
		['defer', 'property', 'HTMLScriptElement.defer'],
		['disabled', 'property', 'the reported defect - HTMLButtonElement.disabled'],
		['hidden', 'property', 'HTMLElement.hidden; costs `hidden="until-found"`'],
		['loop', 'property', 'HTMLMediaElement.loop'],
		['multiple', 'property', 'HTMLInputElement/HTMLSelectElement.multiple'],
		['open', 'property', 'HTMLDetailsElement.open'],
		['readonly', 'property', "the sole member Angular's mapPropName maps: readonly -> readOnly"],
		['required', 'property', 'HTMLInputElement.required'],
		['reversed', 'property', 'HTMLOListElement.reversed'],

		// ALREADY PROPERTY, from the vendored classifier's three-name allowlist.
		// Listed so that a change THERE shows up HERE rather than silently, and
		// deliberately NOT repeated in `build.ts`, which would fork one fact.
		['value', 'property', '@markless/compiler classifies it; not a boolean attribute at all'],
		['checked', 'property', '@markless/compiler classifies it - this is why S7 did not invert'],
		['selected', 'property', '@markless/compiler classifies it'],

		// REFUSED, clause 3 - the browser property is camelCase and the lowercase
		// attribute spelling does not reach it. Angular's mapPropName maps only
		// class, for, formaction, innerHtml, readonly and tabindex.
		['allowfullscreen', 'attribute', 'the property is allowFullscreen'],
		['formnovalidate', 'attribute', 'the property is formNoValidate'],
		['ismap', 'attribute', 'the property is isMap'],
		['novalidate', 'attribute', 'the property is noValidate'],
		['playsinline', 'attribute', 'the property is playsInline'],
		['disablepictureinpicture', 'attribute', 'the property is disablePictureInPicture'],
		['disableremoteplayback', 'attribute', 'the property is disableRemotePlayback'],
		// The same clause, and the sharpest pair in the table: domino REFLECTS both
		// of these, so measuring only Angular's server DOM would have admitted them.
		// Neither is a browser property - `noModule` is the real spelling, and
		// `seamless` was removed from HTML - and `isPropertyValid` returns true when
		// `Node` is undefined, so admitting them would have passed SSR and thrown in
		// the browser. This pair is why clause 3 and clause 4 are both required.
		['nomodule', 'attribute', 'domino reflects it; the browser property is noModule'],
		['seamless', 'attribute', 'domino reflects it; removed from HTML, no property at all'],

		// REFUSED, clause 4 - real browser properties that Angular's own server DOM
		// (domino, bundled in @angular/platform-server 22.0.8) does not implement,
		// so SSR would omit an attribute the client then sets.
		['inert', 'attribute', 'HTMLElement.inert exists; domino drops it'],
		['webkitdirectory', 'attribute', 'HTMLInputElement.webkitdirectory exists; domino drops it'],
		[
			'muted',
			'attribute',
			'domino drops it, AND the muted content attribute reflects defaultMuted, not muted',
		],

		// REFUSED, clause 1 - not content attributes, so they have no serialized
		// form for a boolean lowering to get right.
		['indeterminate', 'attribute', 'a property with no content attribute'],
		['itemscope', 'attribute', 'the property is itemScope'],

		// CONTROLS. `aria-disabled` is S7's ratified substitute for the construct
		// this repair fixes; it must stay an attribute, because ARIA states are
		// attributes and their `"false"` value is MEANINGFUL rather than removing.
		['aria-disabled', 'attribute', "S7's ratified substitute - ARIA states are attributes"],
		['data-guard', 'attribute', 'the corpus shape that must not move'],
	];

	/**
	 * One `.tsrx` module binding every matrix name on its own host, so a single
	 * compile measures the whole table. Uniform `<span>` hosts, because the rule
	 * under test is keyed on the NAME and nothing else.
	 */
	function booleanProbeSource(names: readonly string[]): string {
		const hosts = names.map((name) => `\t\t<span ${name}={a}></span>`).join('\n');
		return `import { state } from '@markless/core';

export function Probe({ seed }) @{
	let a = state(seed);

	<div data-probe>
${hosts}
	</div>
}
`;
	}

	async function probeKinds(names: readonly string[]): Promise<Record<string, string>> {
		const ir = await buildEnrichedIr({
			filename: 'probe.tsrx',
			source: booleanProbeSource(names),
		});
		const measured: Record<string, string> = {};
		for (const host of hosts(ir))
			for (const binding of host.dynamicBindings) measured[binding.name] = binding.kind;
		return measured;
	}

	test('every registered name lowers to the kind the admission rule gives it', async () => {
		const measured = await probeKinds(MATRIX.map(([name]) => name));
		const expected = Object.fromEntries(MATRIX.map(([name, kind]) => [name, kind]));
		expect(measured).toEqual(expected);
	});

	/**
	 * CALIBRATION, and the reason the table above is an instrument rather than a
	 * transcript. The two assertions below are the two directions a future edit to
	 * `DOM_BOOLEAN_CONTENT_ATTRIBUTES` can go, asserted as SETS so that a name
	 * added to or removed from `build.ts` without a matching row here cannot pass.
	 */
	test('CALIBRATION: the matrix is exactly the set build.ts admits, in both directions', async () => {
		const registered = MATRIX.filter(([, kind]) => kind === 'property').map(([name]) => name);
		const admitted = registered.filter((name) => isDomBooleanContentAttribute(name));
		// `value`, `checked` and `selected` reach `property` through the VENDORED
		// classifier, so they are property rows that build.ts must NOT list. If a
		// future edit adds them there, this goes red - the fork is the defect.
		expect(admitted).toEqual(
			registered.filter((name) => !['value', 'checked', 'selected'].includes(name)),
		);
		const refused = MATRIX.filter(([, kind]) => kind === 'attribute').map(([name]) => name);
		expect(refused.filter((name) => isDomBooleanContentAttribute(name))).toEqual([]);
	});

	/**
	 * THE VALUE AXIS, EXECUTED rather than recalled - and the row that shows the
	 * defect is in the LOWERING and not in the frameworks.
	 *
	 * react-dom is the one lane whose serializer is callable from this package
	 * without a browser, so it is the one lane measured here; the other five are
	 * measured behaviourally by the e2e half, which is a separate card. What it
	 * pins is that a property-shaped boolean OMITS on `false` and on nullish, and
	 * that the string `"false"` - the exact byte sequence Angular's attribute path
	 * produced from `false` - serves the attribute PRESENT, i.e. inverts.
	 *
	 * Angular's own server DOM agrees on every row (measured at
	 * @angular/platform-server 22.0.8's bundled domino, not asserted here because
	 * platform-server is a demo dependency and not resolvable from this package):
	 *   .disabled = true/'false'/'x'/1 -> disabled=""   .disabled = false/null/undefined/''/0 -> absent
	 *   setAttribute('disabled','false') -> disabled="false", and .disabled === true
	 */
	test('react-dom omits a false boolean prop and PRESENTS the string "false"', async () => {
		const REPO_ROOT = new URL('../../../', import.meta.url);
		const reactRequire = createRequire(
			fileURLToPath(new URL('packages/frameworks/react/package.json', REPO_ROOT)),
		);
		const server = (await import(
			/* @vite-ignore */ pathToFileURL(reactRequire.resolve('react-dom/server.node')).href
		)) as Record<string, unknown>;
		const react = (await import(
			/* @vite-ignore */ pathToFileURL(reactRequire.resolve('react')).href
		)) as Record<string, unknown>;
		const createElement = ((react.createElement ??
			(react.default as Record<string, unknown>).createElement) as (
			tag: string,
			props: Record<string, unknown>,
		) => unknown)!;
		const renderToStaticMarkup = ((server.renderToStaticMarkup ??
			(server.default as Record<string, unknown>).renderToStaticMarkup) as (
			element: unknown,
		) => string)!;
		const version = (reactRequire('react-dom/package.json') as { version: string }).version;

		const measured = Object.fromEntries(
			([true, false, null, undefined, '', 'false'] as const).map((value) => [
				JSON.stringify(value) ?? 'undefined',
				renderToStaticMarkup(createElement('button', { disabled: value })),
			]),
		);
		expect(measured, `measured at react-dom ${version}`).toEqual({
			true: '<button disabled=""></button>',
			false: '<button></button>',
			null: '<button></button>',
			undefined: '<button></button>',
			'""': '<button></button>',
			'"false"': '<button disabled=""></button>',
		});
	});
});

/**
 * T051, CLAUSE 5. `docs/DEFECTS.md` entry 13.
 *
 * THE HOLE THIS CLOSES, stated as the shape rather than as four names. T049's
 * clauses 1-4 all ask what the BROWSER DOM accepts, verified against
 * `lib.dom.d.ts` and Angular's server DOM. They caught `nomodule` and `seamless`
 * by asking whether the DOM would take them. NOBODY EVER ASKED WHETHER EACH LANE
 * WOULD. Four of the fourteen admitted names pass every one of clauses 1-4, lower
 * to `kind: 'property'` correctly, emit valid-LOOKING output in all six lanes,
 * and are then dropped or mis-serialized by one specific lane's serializer.
 *
 * THE READING COMPARED IS THE ORACLE'S READING - `getAttribute(name)` on the live
 * DOM, `""` or `null`. `measureBooleans` in the three-way contract says in as
 * many words that the claim is "about the state the six lanes end up in, not
 * about which API each one used to get there". That matters here: react and
 * svelte serve `disabled=""` while solid and vue serve a BARE `disabled`, and
 * that 2-2 byte split is NOT a portability failure, because every one of them
 * reads `""`. Comparing raw bytes instead would report ten false divergences and
 * bury the four real ones.
 *
 * FOUR OF THE SIX LANES ARE EXECUTED HERE, which is four more than before: T049
 * recorded that "react-dom is the one lane whose serializer is callable from this
 * package", and that turned out to be inherited rather than measured. solid's
 * `ssrAttribute`, vue's `@vue/server-renderer` and svelte's `attr()` are all
 * reachable through the lane packages by the same `laneRequire` route the
 * whitespace matrix already uses.
 *
 * THE TWO THAT ARE NOT, and exactly why:
 *   qwik    - its standalone SSR renderer refuses to run without a real client
 *             build manifest, and hand-rolling one is the precise trap this repo
 *             has already lost a goal to. So qwik is measured at its DECIDING
 *             FUNCTION instead, read out of its own shipped bundle: core.mjs's
 *             `isBooleanAttr`, which its client patch consults to choose between
 *             `element[key] = parseBoolean(...)` and `directSetAttribute(...)`.
 *             That is the code that produces the divergence, not a model of it.
 *   angular - the domino it serializes through is bundled inside
 *             `@angular/platform-server`, a DEMO dependency. What IS reachable is
 *             better for this question: `DomElementSchemaRegistry`, Angular's own
 *             public registry of which property names bind on which element, plus
 *             `getMappedPropName`. Angular's row is additionally covered
 *             behaviourally by S9 in `pnpm e2e`.
 */
describe('clause 5: the six-lane boolean serializer matrix', () => {
	const REPO_ROOT = new URL('../../../', import.meta.url);
	const laneRequire = (lane: string) =>
		createRequire(fileURLToPath(new URL(`packages/frameworks/${lane}/package.json`, REPO_ROOT)));
	const laneImport = async (lane: string, specifier: string): Promise<Record<string, unknown>> =>
		(await import(
			/* @vite-ignore */ pathToFileURL(laneRequire(lane).resolve(specifier)).href
		)) as Record<string, unknown>;
	const interop = <T,>(module: Record<string, unknown>, key: string): T => {
		const direct = module[key];
		if (direct !== undefined) return direct as T;
		const fallback = (module.default as Record<string, unknown> | undefined)?.[key];
		if (fallback === undefined) throw new Error(`No export ${key} on the resolved module.`);
		return fallback as T;
	};

	/**
	 * Each name on the element that DEFINES it. This is NOT the uniform `<span>`
	 * the lowering matrix above uses, and the difference is load-bearing: the
	 * lowering rule is keyed on the name alone, but two lanes' SERIALIZERS are
	 * element-sensitive - qwik gates on `key in element`, and Angular's schema
	 * rejects `[disabled]` on a `<span>` outright. A uniform host would measure a
	 * property that is not there and report six lanes agreeing on nothing.
	 */
	const HOST: Readonly<Record<string, string>> = {
		async: 'script',
		autofocus: 'input',
		autoplay: 'video',
		controls: 'video',
		default: 'track',
		defer: 'script',
		disabled: 'button',
		hidden: 'div',
		loop: 'video',
		multiple: 'select',
		open: 'details',
		readonly: 'input',
		required: 'input',
		reversed: 'ol',
	};
	const NAMES = Object.keys(HOST);

	/** `getAttribute(name)` for the bytes a lane produced: `""`, a value, or null. */
	function liveReading(html: string, name: string): string | null {
		const startTag = /<[A-Za-z][^>]*>/.exec(html)?.[0] ?? '';
		const tokens = [...startTag.matchAll(/([A-Za-z_:][-A-Za-z0-9_:.]*)(?:="([^"]*)")?/g)].slice(1);
		const hit = tokens.find((token) => token[1]!.toLowerCase() === name.toLowerCase());
		if (!hit) return null;
		return hit[2] ?? '';
	}

	const both = (rows: Record<string, string | null>): string =>
		`${JSON.stringify(rows.true)} / ${JSON.stringify(rows.false)}`;

	async function measureReact(): Promise<Record<string, string>> {
		const react = await laneImport('react', 'react');
		const server = await laneImport('react', 'react-dom/server.node');
		const createElement = interop<(tag: string, props: Record<string, unknown>) => unknown>(
			react,
			'createElement',
		);
		const render = interop<(element: unknown) => string>(server, 'renderToStaticMarkup');
		const out: Record<string, string> = {};
		for (const name of NAMES)
			out[name] = both({
				true: liveReading(render(createElement(HOST[name]!, { [name]: true })), name),
				false: liveReading(render(createElement(HOST[name]!, { [name]: false })), name),
			});
		return out;
	}

	async function measureSolid(): Promise<Record<string, string>> {
		const babel = await laneImport('solid', '@babel/core');
		const transformSync = interop<(source: string, options: unknown) => { code: string }>(
			babel,
			'transformSync',
		);
		const preset = laneRequire('solid').resolve('babel-preset-solid');
		const web = JSON.stringify(pathToFileURL(laneRequire('solid').resolve('solid-js/web')).href);
		const render = async (name: string, value: boolean): Promise<string> => {
			const code = transformSync(`export const R = () => <${HOST[name]!} ${name}={${value}}/>;`, {
				presets: [[preset, { generate: 'ssr', hydratable: false }]],
				filename: 'probe.jsx',
				babelrc: false,
				configFile: false,
			}).code.replaceAll('"solid-js/web"', web);
			const module = (await import(
				/* @vite-ignore */ `data:text/javascript,${encodeURIComponent(
					`${code}\nimport { resolveSSRNode as _r } from ${web};\nexport const html = _r(R());\n`,
				)}`
			)) as { html: string };
			return module.html;
		};
		const out: Record<string, string> = {};
		for (const name of NAMES)
			out[name] = both({
				true: liveReading(await render(name, true), name),
				false: liveReading(await render(name, false), name),
			});
		return out;
	}

	async function measureVue(): Promise<Record<string, string>> {
		const vue = await laneImport('vue', 'vue');
		const ssr = await laneImport('vue', 'vue/server-renderer');
		const createSSRApp = interop<(options: unknown) => unknown>(vue, 'createSSRApp');
		const h = interop<(tag: string, props: Record<string, unknown>) => unknown>(vue, 'h');
		const render = interop<(app: unknown) => Promise<string>>(ssr, 'renderToString');
		const out: Record<string, string> = {};
		for (const name of NAMES)
			out[name] = both({
				true: liveReading(
					await render(createSSRApp({ render: () => h(HOST[name]!, { [name]: true }) })),
					name,
				),
				false: liveReading(
					await render(createSSRApp({ render: () => h(HOST[name]!, { [name]: false }) })),
					name,
				),
			});
		return out;
	}

	async function measureSvelte(): Promise<Record<string, string>> {
		const compiler = await laneImport('svelte', 'svelte/compiler');
		const compile = interop<
			(source: string, options: { generate: string; name: string }) => { js: { code: string } }
		>(compiler, 'compile');
		const internal = JSON.stringify(
			pathToFileURL(laneRequire('svelte').resolve('svelte/internal/server')).href,
		);
		// `<script>` is svelte's own instance script and `<input>`/`<track>` are
		// void, so the host is reached through `<svelte:element>`. Both are svelte
		// PARSER facts; the emitted call is the same `attr()` either way.
		const VOID = new Set(['input', 'track']);
		const render = async (name: string, value: boolean): Promise<string> => {
			const host = HOST[name]!;
			const source =
				host === 'script' || VOID.has(host)
					? `<svelte:element this={${JSON.stringify(host)}} ${name}={${value}} />`
					: `<${host} ${name}={${value}}></${host}>`;
			const code = compile(source, { generate: 'server', name: 'Probe' })
				.js.code.replaceAll("'svelte/internal/server'", internal)
				.replaceAll('"svelte/internal/server"', internal);
			const module = (await import(
				/* @vite-ignore */ `data:text/javascript,${encodeURIComponent(code)}`
			)) as { default: (renderer: { push: (chunk: string) => void }) => void };
			const chunks: string[] = [];
			module.default({ push: (chunk) => void chunks.push(chunk) });
			return chunks.join('');
		};
		const out: Record<string, string> = {};
		for (const name of NAMES)
			out[name] = both({
				true: liveReading(await render(name, true), name),
				false: liveReading(await render(name, false), name),
			});
		return out;
	}

	/**
	 * `@qwik.dev/core`'s own `isBooleanAttr`, read out of the shipped bundle. Its
	 * client patch runs `element[key] = parseBoolean(value)` when this is true and
	 * `directSetAttribute(element, key, value)` when it is false - and the latter
	 * stringifies `true` to `"true"`, which is the whole divergence.
	 */
	function qwikDecider(): {
		readonly names: readonly string[];
		readonly gatesOnElement: boolean;
		readonly version: string;
	} {
		const core = createRequire(laneRequire('qwik').resolve('@qwik.dev/core/package.json'));
		const bundle = readFileSync(
			fileURLToPath(new URL('dist/core.mjs', pathToFileURL(core.resolve('@qwik.dev/core/package.json')))),
			'utf8',
		);
		const start = bundle.indexOf('const isBooleanAttr = (element, key) => {');
		if (start < 0)
			throw new Error(
				'`isBooleanAttr` is no longer at this shape in @qwik.dev/core. The qwik row of this ' +
					'matrix is derived from it, so it must be re-read rather than assumed unchanged.',
			);
		const body = bundle.slice(start, bundle.indexOf('};', start) + 2);
		return {
			names: [...body.matchAll(/key == '([a-z]+)'/g)].map((match) => match[1]!),
			gatesOnElement: /return isBoolean && key in element;/.test(body),
			version: (core('@qwik.dev/core/package.json') as { version: string }).version,
		};
	}

	async function angularRegistry(): Promise<{
		hasProperty: (tag: string, prop: string) => boolean;
		mapped: (name: string) => string;
	}> {
		const compiler = await laneImport('angular', '@angular/compiler');
		const Registry = interop<new () => {
			hasProperty: (tag: string, prop: string, schemas: readonly unknown[]) => boolean;
			getMappedPropName: (name: string) => string;
		}>(compiler, 'DomElementSchemaRegistry');
		const registry = new Registry();
		return {
			hasProperty: (tag, prop) => registry.hasProperty(tag, prop, []),
			mapped: (name) => registry.getMappedPropName(name),
		};
	}

	/**
	 * THE MATRIX. Every cell is `getAttribute` in the TRUE state / the FALSE state.
	 * The four cells that are not `"" / null` are the finding, and each carries its
	 * lane and its cause in the assertion's own shape rather than in a comment.
	 */
	test('four executed lanes: react drops three names, and the other three agree on all fourteen', async () => {
		const [react, solid, vue, svelte] = await Promise.all([
			measureReact(),
			measureSolid(),
			measureVue(),
			measureSvelte(),
		]);
		const AGREED = '"" / null';
		// solid, vue and svelte are unanimous on every one of the fourteen. Asserted
		// as three whole objects, so a single moved cell in any of them goes red.
		const unanimous = Object.fromEntries(NAMES.map((name) => [name, AGREED]));
		expect(solid, 'solid').toEqual(unanimous);
		expect(vue, 'vue').toEqual(unanimous);
		expect(svelte, 'svelte').toEqual(unanimous);
		// react is the outlier, and ONLY on the three names it spells camelCase.
		// The emitter now maps those, which is why the AS-EMITTED react lane agrees:
		// this row is the UNMAPPED lowercase spelling, i.e. the defect itself.
		expect(react).toEqual({
			...unanimous,
			autofocus: 'null / null',
			autoplay: 'null / null',
			readonly: 'null / null',
		});
	});

	test('qwik: `hidden` and `readonly` fail its OWN decider, for opposite reasons', async () => {
		const qwik = qwikDecider();
		const angular = await angularRegistry();
		// Conjunct one: the name list. `hidden` is the only one of the fourteen off it.
		expect(NAMES.filter((name) => !qwik.names.includes(name)), `at qwik ${qwik.version}`).toEqual([
			'hidden',
		]);
		// Conjunct two, and the one the first reading of this finding missed: the
		// list is ANDed with `key in element`. `readonly` is ON the list and still
		// fails, because the DOM property is `readOnly` - the single name of the
		// fourteen whose lowercase spelling is not itself a property, cross-checked
		// here against Angular's registry and separately against lib.dom.d.ts,
		// jsdom 28.1.0 and the domino in @angular/platform-server 22.0.8.
		expect(qwik.gatesOnElement).toBe(true);
		expect(NAMES.filter((name) => !angular.hasProperty(HOST[name]!, name))).toEqual(['readonly']);
		// The two conjuncts together are qwik's answer, and it is these two names.
		const qwikFails = NAMES.filter(
			(name) => !(qwik.names.includes(name) && angular.hasProperty(HOST[name]!, name)),
		);
		expect(qwikFails).toEqual(['hidden', 'readonly']);
	});

	test('angular: every admitted name binds as a property, and `readonly` needs the remap to', async () => {
		const angular = await angularRegistry();
		for (const name of NAMES)
			expect(angular.hasProperty(HOST[name]!, angular.mapped(name)), `angular ${name}`).toBe(true);
		// The remap is Angular's alone. It is what old clause 3 leaned on, and it is
		// exactly why `readonly` was admitted as if it were lane-neutral when the
		// fact it rests on is a fact about ONE lane's runtime.
		expect(NAMES.filter((name) => angular.mapped(name) !== name)).toEqual(['readonly']);
	});

	/**
	 * CALIBRATION, and the reason the exclusions are an instrument rather than a
	 * transcript. `LANE_PORTABLE_BOOLEAN_ATTRIBUTES` is asserted EQUAL to the set
	 * the measurements above leave standing, so widening it and narrowing it both
	 * go red - and so does a lane whose behaviour moves under a version bump.
	 */
	test('CALIBRATION: the portable set is exactly what the six lanes leave standing', async () => {
		const qwik = qwikDecider();
		const angular = await angularRegistry();
		const react = await measureReact();
		const surviving = NAMES.filter((name) => {
			const qwikOk = qwik.names.includes(name) && angular.hasProperty(HOST[name]!, name);
			// react's cell is read AS EMITTED: the emitter maps the three names it
			// spells camelCase, so react's failure is repaired and does not exclude.
			const reactOk = react[name] === '"" / null' || REACT_MAPPED.has(name);
			return qwikOk && reactOk;
		});
		expect(surviving).toEqual(NAMES.filter((name) => isLanePortableBooleanAttribute(name)));
		expect(NAMES.filter((name) => !surviving.includes(name))).toEqual(['hidden', 'readonly']);
		// And every portable name is still an ADMITTED name - the portable set is a
		// SUBSET of the lowered set, never a second, competing source of truth.
		for (const name of surviving) expect(isDomBooleanContentAttribute(name)).toBe(true);
	});

	/**
	 * The three names the react emitter maps. Duplicated from that package rather
	 * than imported, because `@frameless/react` is not a dependency of this one -
	 * and pinned two-sided THERE, against react-dom's own rejections.
	 */
	const REACT_MAPPED = new Set(['autofocus', 'autoplay', 'readonly']);
});

interface SfcTemplate {
	readonly ast: { readonly children: ReadonlyArray<{ tag?: string; children: Array<{ content?: string }> }> };
}

interface AngularNode {
	readonly name?: string;
	readonly value?: unknown;
	readonly children?: readonly AngularNode[];
}

interface QwikOptimizer {
	transformModules(options: {
		srcDir: string;
		input: ReadonlyArray<{ path: string; code: string }>;
		sourceMaps: boolean;
		minify: string;
		transpileTs: boolean;
		transpileJsx: boolean;
		mode: string;
	}): Promise<{ modules: ReadonlyArray<{ code: string }> }>;
}

function mapValues(
	record: Record<string, string>,
	transform: (value: string) => string,
): Record<string, string> {
	return Object.fromEntries(Object.entries(record).map(([key, value]) => [key, transform(value)]));
}

describe('closure and honesty', () => {
	for (const file of FIXTURES) {
		test(`${file}: every graphNodeId resolves and every analyzer host shape is present`, async () => {
			const ir = await fixtureIr(file);
			const bindingIds = new Set(ir.records.bindings.map((binding) => binding.id));
			const referenced = new Set<string>();
			const visit = (value: unknown): void => {
				if (!value || typeof value !== 'object') return;
				if (Array.isArray(value)) return void value.forEach(visit);
				for (const [key, child] of Object.entries(value)) {
					if (key === 'graphNodeId' && typeof child === 'string') referenced.add(child);
					if (key === 'path' && Array.isArray(child)) {
						expect(
							child.every((part) => typeof part === 'string' && !/[()]/.test(part)),
							`degraded path ${String(child)}`,
						).toBe(true);
					}
					visit(child);
				}
			};
			visit(ir);
			for (const id of referenced) expect(bindingIds.has(id), `dangling ${id}`).toBe(true);

			const actual = hosts(ir).map((host): [string, string[]] => [
				host.tag,
				[
					...host.staticAttributes.map((attribute) => attribute.name),
					...host.dynamicBindings.map((binding) => binding.name),
				],
			]);
			for (const [tag, attribute] of EXPECTED_HOSTS[file]) {
				const index = actual.findIndex(
					([actualTag, attributes]) =>
						actualTag === tag && (!attribute || attributes.includes(attribute)),
				);
				expect(index, `missing <${tag} ${attribute}>`).toBeGreaterThanOrEqual(0);
				actual.splice(index, 1);
			}
			expect(actual).toEqual([]);
		});
	}

	test('the public contract has an allowlisted top-level shape and no public Markless type dependency', async () => {
		const allowed = new Set([
			'version',
			'filename',
			'imports',
			'module',
			'components',
			'records',
		]);
		const hasOnlyKnownTopLevelKeys = (value: object): boolean =>
			Object.keys(value).every((key) => allowed.has(key));
		for (const file of FIXTURES) {
			const ir = await fixtureIr(file);
			expect(hasOnlyKnownTopLevelKeys(ir)).toBe(true);
			expect(hasOnlyKnownTopLevelKeys({ ...ir, unknownArtifact: {} })).toBe(false);
		}
		const schemaSource = readFileSync(new URL('../src/schema.ts', import.meta.url), 'utf8');
		expect(schemaSource).not.toContain('@markless/');
	});

	test('record tables use defined locale-independent sort keys and filenames are normalized', async () => {
		const compare = (left: string, right: string): number =>
			left < right ? -1 : left > right ? 1 : 0;
		const sorted = <T>(values: readonly T[], key: (value: T) => string): T[] =>
			[...values].sort((a, b) => compare(key(a), key(b)));
		const sortedWrites = <
			T extends {
				componentId: string;
				graphNodeId: string;
				path: readonly string[];
				operation: string;
				method?: string;
				sourceSpan?: { start: number; end: number };
			},
		>(
			values: readonly T[],
		): T[] =>
			[...values].sort(
				(a, b) =>
					compare(a.componentId, b.componentId) ||
					compare(a.graphNodeId, b.graphNodeId) ||
					compare(a.path.join('\0'), b.path.join('\0')) ||
					compare(a.operation, b.operation) ||
					compare(a.method ?? '', b.method ?? '') ||
					(a.sourceSpan?.start ?? -1) - (b.sourceSpan?.start ?? -1) ||
					(a.sourceSpan?.end ?? -1) - (b.sourceSpan?.end ?? -1),
			);
		for (const file of FIXTURES) {
			const ir = await fixtureIr(file);
			expect(ir.records.bindings).toEqual(
				sorted(ir.records.bindings, (binding) => binding.id),
			);
			expect(ir.records.aliases).toEqual(sorted(ir.records.aliases, (alias) => alias.id));
			expect(ir.records.events).toEqual(sorted(ir.records.events, (event) => event.id));
			expect(ir.records.stateReads).toEqual(
				sorted(
					ir.records.stateReads,
					(read) => `${read.componentId}\0${read.graphNodeId}\0${read.path.join('\0')}`,
				),
			);
			expect(ir.records.stateWrites).toEqual(sortedWrites(ir.records.stateWrites));
			for (const binding of ir.records.bindings) {
				expect(binding.reads).toEqual(
					sorted(
						binding.reads,
						(read) =>
							`${read.componentId}\0${read.graphNodeId}\0${read.path.join('\0')}`,
					),
				);
				expect(binding.writes).toEqual(sortedWrites(binding.writes));
			}
			for (const event of ir.records.events) {
				expect(event.handlers).toEqual(
					sorted(
						event.handlers,
						(handler) =>
							`${String(handler.expression.start).padStart(12, '0')}\0${String(handler.expression.end).padStart(12, '0')}`,
					),
				);
				for (const handler of event.handlers)
					expect(handler.writes).toEqual(sortedWrites(handler.writes));
			}
		}
		const source = readFileSync(
			new URL('./fixtures/s1-render-once.tsrx', import.meta.url),
			'utf8',
		);
		const ir = await buildEnrichedIr({
			filename: '/machine/private/project/src/fixtures/s1-render-once.tsrx',
			source,
		});
		expect(ir.filename).toBe('src/fixtures/s1-render-once.tsrx');
		expect(dumpEnrichedIr(ir)).not.toContain('/machine/private/project');
	});

	test('lowered assignment and call writes carry AST operands instead of source fragments', async () => {
		for (const file of FIXTURES) {
			const ir = await fixtureIr(file);
			for (const write of ir.records.stateWrites) {
				if (write.operation === 'assign') expect(typeof write.value?.type).toBe('string');
				if (write.operation === 'call') expect(write.arguments).toBeDefined();
			}
		}
	});
});

describe('golden dumps', () => {
	for (const file of FIXTURES) {
		test(`${file}: deterministic across builds and byte-equal to its checked-in golden`, async () => {
			const firstIr = await fixtureIr(file);
			expect(firstIr.records.behaviors).toEqual([]);
			const first = dumpEnrichedIr(firstIr);
			const second = dumpEnrichedIr(await fixtureIr(file));
			expect(second).toBe(first);
			const goldenUrl = new URL(`./goldens/${basename(file, '.tsrx')}.json`, import.meta.url);
			if (process.env.UPDATE_GOLDENS === '1') writeFileSync(goldenUrl, first);
			expect(readFileSync(goldenUrl, 'utf8')).toBe(first);
		});
	}
});
