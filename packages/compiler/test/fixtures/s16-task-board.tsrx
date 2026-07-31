import { computed, state } from '@markless/core';

// THE SEVENTH APPLICATION IN THIS CORPUS - the TASK BOARD - authored ONCE and
// attempted in all six lanes. It rides the next ORDINAL slot for the reason S10
// through S15 record: ten-plus per-lane suites derive their `generated/`
// inventory from `/^s(\d+)-[\w-]+\.json$/` and assert it EXACTLY, so a
// sixteenth artifact named anything else is rejected by construction.
// `scripts/e2e.mjs` still pins `threeWayScenarios` to the literal ['s1'..'s9'],
// so this app does NOT join the 6 x 9 three-way contract - browsable first.
//
// ==========================================================================
// THE AXIS THIS CARD EXISTS TO MEASURE IS DRAG AND DROP, AND THIS MODULE NOW
// CONTAINS IT. IT SHIPS IN FIVE OF THE SIX LANES AND IS INERT IN REACT, AND
// THAT ASYMMETRY IS THE MEASUREMENT. THE PAGE SAYS WHICH LANE DOES WHICH.
// ==========================================================================
//
// The board predicted `onDragStart` / `onDragOver` / `onDrop` / `onPointerDown`
// "cannot be produced" because they are two-word and `jsxEventName` in
// packages/compiler/src/build.ts does `name.slice(2).toLowerCase()`.
// MEASURED ON A PROBE THROUGH ALL SIX REAL EMITTERS - see the T005 note - AND
// THE PREDICTION IS WRONG IN BOTH DIRECTIONS:
//
//   * THEY ARE PRODUCED. Every emitter takes them on THESE hosts. The one
//     recorded refusal is SVELTE'S AND IT IS ABOUT THE ELEMENT, NOT THE EVENT:
//     a `<div>` or `<span>` carrying any drag handler fails
//     `a11y_no_static_element_interactions`, while the identical handlers on
//     `<ul>` and `<li>` emit. THE DROP ZONE HERE IS THE COLUMN'S `<ul>` AND THE
//     DRAGGABLE IS THE CARD'S `<li>` FOR EXACTLY THAT REASON, so the "five of
//     six emitters" figure quoted around this repo is the count for a `<div>`
//     drop zone; on this markup it is SIX. DEFECTS.md 15 says so itself -
//     "there is no refusal in front of it" - so the compiler ACCEPTS a spelling
//     it is about to destroy.
//
//   * THEY ARE NOT UNIFORMLY INERT EITHER. The casing loss is fatal only where
//     the lane binds by a FRAMEWORK PROP NAME. react prints `onDragover` and
//     react-dom never fires it; vue prints `@dragover`, angular prints
//     `(dragover)`, svelte prints `ondragover`, solid and qwik bind the
//     flattened string through `addEventListener` - and `dragover` IS the real
//     DOM event name, so those FIVE are CORRECT BY ACCIDENT OF THE SAME BUG.
//     REACT IS THE ONLY DAMAGED LANE and it keeps the ◀ ▶ arrows, which is why
//     they are still below and why removing them would break a working lane.
//
//   * AND ONE OF THE FIVE HAS A MEASURED INTERMITTENCY THAT ONLY A DRIVEN
//     BROWSER COULD HAVE FOUND. IN THE QWIK LANE, THE FIRST DROP AFTER A DRAG
//     THAT ENDED OUTSIDE A DROP ZONE IS LOST; THE NEXT DROP LANDS. Reproduced
//     from a fresh page in three arms with a real mouse:
//       drop, drop                       -> both land
//       cancel, drop, drop               -> FIRST DROP LOST, second lands
//       cancel, cancel, drop, drop       -> FIRST DROP LOST, second lands
//     Every visible precondition is correct when the lost drop happens: the
//     `drop` event is delivered to the column's `<ul>`, `defaultPrevented` is
//     true so the `dragover` guard ran, `data-dragging` reads the right card so
//     `dragId` holds the right id, and there is NO console or page error. A 2.5s
//     settle does not help, so this is NOT simply a chunk still downloading.
//     THE MECHANISM IS UNRESOLVED AND IS RECORDED AS UNRESOLVED. The suspect is
//     visible in the emitted output - this lane alone splits the handler into a
//     synchronous `sync$` that calls `preventDefault()` and a LAZILY RESOLVED
//     `$()` that does the work - but that was not proven and the settle result
//     argues against the obvious version of it. It is inside qwik's own
//     resumability envelope and is NOT a defect to file upstream.
//
// WHAT USED TO KEEP THE DRAG OFF THIS PAGE WAS THE TYPE BASELINE, AND THAT WAS
// A BUDGET READ AS A WALL. A single drop zone plus a single draggable card was
// measured at `pnpm check` 267 -> 280: react 117 -> 123 and solid 80 -> 86 (one
// TS2322 per host for the unknown prop plus one TS7006 per handler, whose
// parameter can no longer be contextually typed), and qwik 70 -> 71 - the last
// one NOT from an event at all but from `draggable="true"`, which this corpus
// lowers as a STRING while qwik's JSX types declare `draggable?: boolean`. That
// is constraint (14)'s `rows="6"` finding in a second, non-numeric shape, AND
// IT IS THE ONE COST THIS MODULE AVOIDS RATHER THAN PAYS: `draggable` here is
// BOUND to an expression, not spelled as a static string, so constraint (14)
// still holds and the qwik line never appears. The rest of the rise is STATED
// IN ADVANCE AND ATTRIBUTED LINE BY LINE on the card that landed it; the
// remaining TS2322/TS7006 lines are the SAME react-only defect DEFECTS.md 15
// already carries, now visible in the type checker instead of only at runtime.
//
// FOR THE RECORD, THE REFERENCE HAS NO WORKING DRAG - QA'd live by the PM (the
// drag selects text), its Filter popover does not filter and "Add task" is
// inert. Measured again: `document.querySelectorAll('[draggable="true"]')`
// returns ZERO on that page. SO THIS PAGE NOW DOES SOMETHING THE THING IT
// COPIES DOES NOT DO, and that is stated rather than implied.
//
// WHAT A MOVE MOVES - AND A DROP AND AN ARROW PRESS ARE THE SAME MOVE, written
// once each against the SAME `columns` cell rather than sharing a helper, since
// this corpus has never printed one. All derived from that SINGLE cell and
// none of it written twice by the handler. NINE OBSERVABLES, and they are
// deliberately NOT all reachable from one click - which click moves which is
// itself part of the measurement, because a lane that repainted the whole page
// on every write would be indistinguishable from a correct one if every
// observable always moved:
//
//     1. the card leaves one column's <ul> and appears in another's - a real
//        SUBTREE MOVE across two different repeat instances.  EVERY CLICK.
//     2. the source column's count.                           EVERY CLICK.
//     3. the target column's count.                           EVERY CLICK.
//     4. the moved card's own arrows, whose `hidden` is decided by the column
//        it now sits in, so the control that was clicked can disappear under
//        the pointer.                        AT THE TWO ENDS OF THE BOARD.
//     5. the header's shipped counter        `{shipped}`.     ON A REVIEW MOVE.
//     6. the summary sentence                `{summary}`.     ON A REVIEW MOVE.
//     7. the summary emoji                   `{summaryEmoji}` - a ladder
//        PARALLEL to the sentence rather than the same one.   ON A REVIEW MOVE.
//     8. the source column's empty placeholder.               ON THE LAST CARD
//                                                             OUT OF A COLUMN.
//     9. the header's total `{totalLabel}` - the one that must NOT move, ever,
//        because a move conserves cards. It is listed here BECAUSE it is a
//        constant: a lane that rebuilt the seed on every write would move it.
//
// THE CONSTRAINTS BELOW ARE MEASURED. (1)-(9) are inherited from S10-S15
// because the same lanes still enforce them; (10)-(16) were measured ON THIS
// SOURCE.
//
// (1) NO SEED PROP. IR-8 has no lowering for `TSArrayType` - react, svelte and
//     angular each throw "has no IR-8 lowering for the type node TSArrayType" -
//     so the four columns are seeded in the component and all six lanes start
//     from byte-identical data. `Array<string>` DOES lower in five lanes (T003),
//     so the limit is the SPELLING, but it does not rescue this module:
//     `Array<{ id: string }>` throws on `TSTypeLiteral` in all six.
//
// (2) EVERY REPEAT IS OVER A STATE CELL OR OVER A FIELD OF ITS LOOP VARIABLE,
//     never over a `computed`. Solid refuses the latter ("Array state
//     state:columns has unconsumed keyed identity semantics"). That is why the
//     tasks live INSIDE their column object rather than in one flat list with a
//     `columnId` and a filtered view - and it is also why moving a card is a
//     rewrite of `columns` rather than a field write on a task.
//
// (3) EVERY CLICKABLE IS A `<button type="button">` OR AN `<a>` WITH A REAL
//     `href`. Svelte's emitted-form gate refuses a bare `<span>` carrying a
//     click handler (`a11y_no_static_element_interactions`) and refuses
//     `href="#"` and `href=""` outright (`a11y_invalid_attribute`), which is why
//     every inert link here is spelled `href="#/..."`.
//
// (4) THREE TWO-WORD DOM EVENTS ARE SHIPPED - `onDragStart`, `onDragOver` and
//     `onDragEnd` - AND THIS IS THE ONLY FIXTURE IN THE CORPUS THAT SHIPS ONE.
//     `onDrop` is spelled here too and it is the CONTROL: it is ONE word, so
//     `.toLowerCase()` is a no-op on it and it round-trips to react's own
//     `onDrop`. React therefore RECEIVES the drop handler and still never fires
//     it, because a drop only happens after a `dragover` that called
//     `preventDefault()` and react never sees the `dragover`. THAT PAIR IS THE
//     WHOLE MECHANISM OF DEFECTS.md 15 ON ONE ELEMENT.
//
// (5) NO STATE WRITE SITS INSIDE AN `if`. DEFECTS.md 8.1: the react emitter
//     lowers only TOP-LEVEL handler statements, so a write nested in an `if` is
//     NEITHER LOWERED NOR REFUSED. The single write in the move handler is
//     top-level and unconditional; the three-way choice it makes is a NESTED
//     TERNARY inside `.map`, which is an expression.
//
// (6) EVERY STRING CELL IS A `''`-SENTINEL, never `state(null)`: `state(null)`
//     pins the inferred cell type to `null` and the first non-null write does
//     not type (a live qwik TS2322 on s7 in this repo's own `pnpm check`).
//
// (7) NO TOP-LEVEL SIDE-EFFECT CALL in the component body - one emits
//     `useRef(null)` in the react lane and costs a type error. Every call site
//     here is inside a handler or a `computed`.
//
// (8) NO TEMPLATE TEXT NODE HAS WHITESPACE EDGES. Angular's `escapeText`
//     refuses one outright and the Vue gate rejects the emitted result. Every
//     gap on this page is a flex `gap` in `demos/shared/board-css/board.css`,
//     never a text node and never emitted formatting - the six emitters print
//     inter-element whitespace differently, so no layout here may lean on it.
//
// (9) NO ELEMENT WITH A HANDLER MAY SIT BESIDE TEXT. Svelte, Vue and Angular
//     all refuse it - "cannot inline <button>: it sits beside text / in a
//     text-bearing run and needs a multi-line start tag". EVERY TEXT RUN ON
//     THIS PAGE THEREFORE HAS ITS OWN `<span>`.
//
// (10) NO GLOBAL IS NAMED, `Math` INCLUDED. The angular emitter cannot resolve
//     any global identifier in a transplanted body, so the obvious spelling of
//     "move one column to the right" - `columns.indexOf(...)` clamped with
//     `Math.min` - would have cost that lane. Each column instead CARRIES its
//     own `prevId` and `nextId` in the seed, with `''` at the two ends, so the
//     move is a pure id comparison and the arrows' `hidden` is a `=== ''` test.
//     The board's whole ordering is therefore data, not arithmetic.
//
// (11) THE MOVE IS ONE `.map` WITH A NESTED TERNARY AND THREE ARMS - remove
//     from the source column, append to the target column, leave every other
//     column IDENTICAL. The third arm returns `entry` itself rather than a copy,
//     which is what lets a keyed repeat see two changed columns and two
//     unchanged ones. Every object literal spells out all five fields, as S15's
//     does, because no fixture in this corpus has ever printed a spread.
//
// (12) EVERY `computed` HAS AN EXPRESSION BODY AND RE-READS `columns` DIRECTLY
//     rather than reading another `computed`. That is why `summary` runs the
//     same `reduce` five times. It is S10's proven shape and the one the whole
//     corpus prints.
//
// (13) NO `style` OR `class` ATTRIBUTE IS BOUND ANYWHERE, AND THE DRAG DID NOT
//     CHANGE THAT - IT ROUTED AROUND IT. No fixture in this corpus binds
//     either, so both lowerings are UNMEASURED in all six lanes, and a drag
//     ghost or a dragging highlight is exactly where one would have been
//     reached for. THE HIGHLIGHT SHIPS ANYWAY, THROUGH A BOUND `data-` ATTRIBUTE
//     AND A CSS ATTRIBUTE SELECTOR: `data-dragging={task.id === dragId ? 'yes' :
//     'no'}` plus a `.tb-card[data-dragging='yes']` rule in
//     `demos/shared/board-css/board.css`. A bound `data-` attribute is the
//     BEST-MEASURED lowering on this page - `data-card`, `data-cards`,
//     `data-colcount` and a dozen more already use it in all six lanes - so the
//     effect a bound `class` would have bought costs NOTHING unmeasured. The
//     `cursor: grab` affordance is the same trick against the emitted
//     `[draggable="true"]`. So: no style binding, no class binding, and there IS
//     a highlight.
//     AND IT IS NOT ONLY COSMETIC. Binding `dragId` into the template is what
//     makes it a template READ, which decides its LOWERING in the react lane:
//     read by the template it becomes `useState`, unread it becomes `useRef` -
//     and the `useRef` form makes the react emitter open every writing handler
//     with a `const currentStateN = cell.current` snapshot that a
//     write-without-read handler NEVER USES. `onDragStart` and `onDragEnd` are
//     the first handlers in this corpus of that shape, and the react lane's own
//     dossier gate caught the dead binding as `eslint:no-unused-vars`. THAT IS A
//     REAL EMITTER WART AND IT IS RECORDED HERE RATHER THAN SILENCED: this page
//     avoids it, it is not fixed, and any future write-only cell will hit it.
//
// (14) NO STATIC NUMERIC ATTRIBUTE IS SPELLED ANYWHERE, and this card widens
//     that constraint. T003 measured `rows="6"` failing the react lane's
//     emitted typecheck because the corpus lowers a static attribute as a
//     STRING; T005 measured the SAME FAILURE ON A NON-NUMERIC ATTRIBUTE -
//     `draggable="true"` against qwik's `draggable?: boolean`. The rule is not
//     "no numbers", it is NO STATIC ATTRIBUTE WHOSE DOM TYPE IS NOT `string`.
//     THE DRAG OBEYS IT RATHER THAN BREAKING IT: `draggable={task.id !== ''}`
//     is a BOUND boolean, which is the same shape as the `hidden={...}` bindings
//     already on this page, so the one qwik diagnostic the earlier probe
//     measured never appears. The predicate is a TAUTOLOGY on this seed - every
//     card is draggable - and it is spelled as one rather than as `{true}`
//     because a bound attribute in this corpus carries READS, and a binding
//     with no reads is a lowering nothing here has measured.
//
// (15) THE COUNTS ARE `{column.tasks.length}` READ STRAIGHT OFF THE LOOP
//     VARIABLE, not a per-column `computed`, because a `computed` is
//     component-scoped and there is no per-instance derivation construct. That
//     makes the two column counts a DIFFERENT KIND of observable from the
//     header's `computed` pair, and one click moves both kinds at once.
//
// (16) THE SUMMARY LADDER IS FIVE BANDS WITH A PARALLEL EMOJI LADDER, the
//     shape S15 measured on the live habit tracker and the shape that catches a
//     lane which re-renders a counter without re-deriving its sentence.
//     ITS BAND EDGES WERE MOVED AFTER THE FIRST BROWSER DRIVE, and that is
//     recorded rather than tidied away. The first spelling used S15's edges -
//     0 / <3 / <6 / <9 / else - and the review column's REACHABLE range on this
//     seed is 1 to 9, so every stage of the drive sat inside the same band and
//     THE SENTENCE NEVER MOVED. Six lanes agreed on a value that never changed,
//     which is exactly the shape of an observable that measures nothing. The
//     edges are 0 / <2 / <4 / <9 / else, so the very first review move crosses
//     one.
//
// (17) THE DRAG CARRIES ONE EXTRA STATE CELL AND IT IS A `''`-SENTINEL STRING,
//     `dragId`, NOT the dragged task object. Constraint (6) is half the reason;
//     the other half is that `state([])` would infer `never[]` and the first
//     write would not type, which is constraint (6)'s hazard one container
//     over. The dropped card is recovered from `columns` itself with a
//     `flatMap` over the PRE-WRITE value, so no second copy of a task ever
//     exists and nothing has to be kept in sync.
//     NOTHING IS READ OFF `event.dataTransfer`. Chromium starts a drag from a
//     `draggable` element with no `setData` call at all, and reaching into a
//     handler parameter typed `unknown` in five of the six lanes would cost the
//     emitted typecheck more than the whole rest of this axis does. THE COST OF
//     THAT CHOICE IS STATED: FIREFOX REQUIRES `dataTransfer.setData` TO START A
//     DRAG, SO THIS PAGE'S DRAG IS A CHROMIUM CLAIM AND IS LABELLED AS ONE.
//
// (18) THE DROP HANDLER'S THIRD TERNARY ARM RETURNS `entry` ITSELF, exactly as
//     the arrows' does, so a keyed repeat still sees TWO changed columns and
//     TWO unchanged ones. A drop on the card's OWN column takes the first arm,
//     which removes and re-appends it - the card moves to the END of its
//     column, which is a real observable and not a no-op. A drop with no drag
//     in flight has `dragId === ''`, so the filter keeps everything and the
//     flatMap finds nothing: A NO-OP BY CONSTRUCTION RATHER THAN BY A GUARD,
//     which is what keeps constraint (5) - no state write inside an `if`.
//
// (19) EVERY `onTrace` CALL IS THE LAST STATEMENT IN ITS HANDLER, and this is a
//     MEASURED EMITTER RULE rather than a style choice. The qwik emitter throws
//     "Qwik v1 rejects synchronous actions after an awaited callback" for any
//     statement that follows a callback-prop call in a handler body - it was
//     reproduced on this module's first drop handler, which reset `dragId`
//     AFTER tracing. THE VISIBLE COST IS IN THE TRACE DETAIL: `drop` carries
//     only `{ to }` and not the moved card's id, because the id lives in
//     `dragId` and `dragId` has to be cleared before the trace runs. The card's
//     id is on the `dragstart` trace instead, so the pair still describes the
//     whole move. `event.preventDefault()` is FIRST in the drop handler for the
//     same rule.
//
// WHAT IS DELIBERATELY NOT HERE, each with a reason rather than an omission.
// There is no page routing - `.tsrx` has no routing construct at all - so the
// sidebar links, `Filter`, `Sort`, `Import / Export`, `Request task`, the
// per-column `+` and `Add task` are INERT and recorded as such, exactly as the
// reference's own `Filter` and `Add task` are. THE DRAG IS THE ONE PLACE THIS
// PAGE OVERSHOOTS ITS REFERENCE RATHER THAN FALLING SHORT OF IT.
// There is no drop INDICATOR and no reordering WITHIN a column: both need a
// per-hover bound `class` or `style`, and (13) refuses that lowering by name.
// There are no assignee avatars:
// the reference draws overlapping gradient discs that carry no state and would
// add a third nesting level measuring nothing.
export function TaskBoard({ onTrace }: {
	onTrace: (name: string, detail: Record<string, unknown>, event: unknown) => void;
}) @{
	let columns = state([
		{
			id: 'backlog',
			title: 'Backlog',
			mark: '◌',
			prevId: '',
			nextId: 'todo',
			tasks: [
				{
					id: 't1',
					title: 'Mobile app redesign',
					blurb: 'Complete redesign of mobile application for better UX',
					date: 'Feb 10',
					comments: '2',
					links: '3',
					tags: [{ id: 't1g1', name: 'Design' }],
				},
				{
					id: 't2',
					title: 'API documentation update',
					blurb: 'Update API docs with latest endpoints and examples',
					date: 'Feb 15',
					comments: '',
					links: '8',
					tags: [{ id: 't2g1', name: 'Product' }],
				},
				{
					id: 't3',
					title: 'Accessibility improvements',
					blurb: 'Enhance accessibility for screen readers and keyboard navigation',
					date: 'Feb 20',
					comments: '1',
					links: '5',
					tags: [
						{ id: 't3g1', name: 'Design' },
						{ id: 't3g2', name: 'New releases' },
					],
				},
			],
		},
		{
			id: 'todo',
			title: 'Todo',
			mark: '○',
			prevId: 'backlog',
			nextId: 'progress',
			tasks: [
				{
					id: 't4',
					title: 'Design system update',
					blurb: 'Enhance design system for consistency and usability',
					date: 'Jan 25',
					comments: '4',
					links: '',
					tags: [
						{ id: 't4g1', name: 'Design' },
						{ id: 't4g2', name: 'New releases' },
					],
				},
				{
					id: 't5',
					title: 'Retention rate by 23%',
					blurb: 'Improve retention through campaigns and feature updates',
					date: 'Jan 25',
					comments: '4',
					links: '12',
					tags: [
						{ id: 't5g1', name: 'Marketing' },
						{ id: 't5g2', name: 'Product' },
					],
				},
				{
					id: 't6',
					title: 'Icon system',
					blurb: 'Develop scalable icons for cohesive platform visuals',
					date: 'Jan 25',
					comments: '4',
					links: '',
					tags: [{ id: 't6g1', name: 'Design' }],
				},
			],
		},
		{
			id: 'progress',
			title: 'In Progress',
			mark: '◑',
			prevId: 'todo',
			nextId: 'review',
			tasks: [
				{
					id: 't7',
					title: 'Search features',
					blurb: 'Upgrade search for faster, accurate user results',
					date: 'Jan 25',
					comments: '',
					links: '12',
					tags: [{ id: 't7g1', name: 'Product' }],
				},
				{
					id: 't8',
					title: 'Checkout flow design',
					blurb: 'Optimize checkout process to improve conversion rates',
					date: 'Jan 25',
					comments: '',
					links: '12',
					tags: [{ id: 't8g1', name: 'Design' }],
				},
			],
		},
		{
			id: 'review',
			title: 'Technical Review',
			mark: '◍',
			prevId: 'progress',
			nextId: '',
			tasks: [
				{
					id: 't9',
					title: 'Payment gateway integration',
					blurb: 'Integrate Stripe payment system for subscriptions',
					date: 'Jan 28',
					comments: '2',
					links: '5',
					tags: [{ id: 't9g1', name: 'Product' }],
				},
			],
		},
	]);
	// THE ONLY CELL THE DRAG ADDS. See constraint (17): a `''` sentinel, never
	// the task object, and never `state(null)`.
	let dragId = state('');

	const shipped = computed(() =>
		columns
			.filter((column) => column.nextId === '')
			.reduce((sum, column) => sum + column.tasks.length, 0),
	);
	const totalLabel = computed(
		() => `/${columns.reduce((sum, column) => sum + column.tasks.length, 0)}`,
	);
	// THE SIDEBAR BADGE IS ITS OWN COMPUTED, AND THE VISUAL PASS IS WHY. The first
	// spelling bound `{totalLabel}` here, which is the HEADER's suffix - it reads
	// "1/9" beside the big shipped count and read "/9" on its own in the sidebar,
	// a stray slash no computed-style check could have seen. Measured off the
	// RENDERED IMAGE and repaired. `tally` is S15's sidebar-badge shape.
	const tally = computed(
		() =>
			`${columns.filter((column) => column.nextId === '').reduce((sum, column) => sum + column.tasks.length, 0)}/${columns.reduce((sum, column) => sum + column.tasks.length, 0)}`,
	);
	const summary = computed(() =>
		columns.filter((column) => column.nextId === '').reduce((sum, column) => sum + column.tasks.length, 0) === 0
			? 'Nothing has reached review yet.'
			: columns.filter((column) => column.nextId === '').reduce((sum, column) => sum + column.tasks.length, 0) < 2
				? 'Review is filling up.'
				: columns.filter((column) => column.nextId === '').reduce((sum, column) => sum + column.tasks.length, 0) < 4
					? 'Half the board is in review.'
					: columns.filter((column) => column.nextId === '').reduce((sum, column) => sum + column.tasks.length, 0) < 9
						? 'Almost everything is in review.'
						: 'Every task is in review.',
	);
	const summaryEmoji = computed(() =>
		columns.filter((column) => column.nextId === '').reduce((sum, column) => sum + column.tasks.length, 0) === 0
			? '◔'
			: columns.filter((column) => column.nextId === '').reduce((sum, column) => sum + column.tasks.length, 0) < 2
				? '◑'
				: columns.filter((column) => column.nextId === '').reduce((sum, column) => sum + column.tasks.length, 0) < 4
					? '◕'
					: columns.filter((column) => column.nextId === '').reduce((sum, column) => sum + column.tasks.length, 0) < 9
						? '●'
						: '✦',
	);

	<section class="tb" data-app="task-board">
		<div class="tb-shell">
			<aside class="tb-side" data-tb="sidebar">
				<div class="tb-brand" data-tb="brand">
					<span class="tb-mark">◧</span>
					<span class="tb-brandname">Frameless</span>
				</div>
				<nav class="tb-nav" data-tb="nav">
					<a
						class="tb-navlink"
						href="#/dashboard"
						data-nav="dashboard"
						onClick={(event) => {
							event.preventDefault();
							onTrace('nav', { to: 'dashboard' }, event);
						}}
					>
						<span class="tb-navicon">▤</span>
						<span class="tb-navtext">Dashboard</span>
					</a>
					<a
						class="tb-navlink tb-navlink-on"
						href="#/task"
						data-nav="task"
						onClick={(event) => {
							event.preventDefault();
							onTrace('nav', { to: 'task' }, event);
						}}
					>
						<span class="tb-navicon">☆</span>
						<span class="tb-navtext">Task</span>
						<span class="tb-badge" data-badge="task">{tally}</span>
					</a>
					<a
						class="tb-navlink"
						href="#/projects"
						data-nav="projects"
						onClick={(event) => {
							event.preventDefault();
							onTrace('nav', { to: 'projects' }, event);
						}}
					>
						<span class="tb-navicon">▣</span>
						<span class="tb-navtext">Projects</span>
					</a>
				</nav>
				<div class="tb-promo" data-tb="promo">
					<span class="tb-promotitle">One source, six lanes</span>
					<span class="tb-promotext">Every pixel on this page is emitted from a single .tsrx module into react, solid, qwik, svelte, vue and angular.</span>
				</div>
			</aside>
			<div class="tb-content">
				<header class="tb-top" data-tb="topbar">
					<button
						type="button"
						class="tb-icon"
						aria-label="toggle sidebar"
						data-action="toggle-sidebar"
						onClick={(event) => onTrace('press', { area: 'toggle-sidebar' }, event)}
					><span class="tb-iconglyph">▥</span></button>
					<h1 class="tb-crumb" data-tb="crumb">Task</h1>
					<span class="tb-topgap"></span>
					<span class="tb-stamp" data-tb="stamp">Last update 3 days ago</span>
					<button
						type="button"
						class="tb-pill"
						data-action="share"
						onClick={(event) => onTrace('press', { area: 'share' }, event)}
					>
						<span class="tb-pillglyph">↗</span>
						<span class="tb-pilltext">Share</span>
					</button>
				</header>
				<div class="tb-tools" data-tb="tools">
					<button
						type="button"
						class="tb-tool"
						data-action="filter"
						onClick={(event) => onTrace('press', { area: 'filter' }, event)}
					>
						<span class="tb-toolglyph">⚟</span>
						<span class="tb-tooltext">Filter</span>
					</button>
					<button
						type="button"
						class="tb-tool"
						data-action="sort"
						onClick={(event) => onTrace('press', { area: 'sort' }, event)}
					>
						<span class="tb-toolglyph">⇅</span>
						<span class="tb-tooltext">Sort</span>
					</button>
					<span class="tb-toolgap"></span>
					<span class="tb-date" data-tb="date">Sep 6, 2024</span>
					<button
						type="button"
						class="tb-tool tb-tool-solid"
						data-action="request-task"
						onClick={(event) => onTrace('press', { area: 'request-task' }, event)}
					>
						<span class="tb-toolglyph">+</span>
						<span class="tb-tooltext">Request task</span>
					</button>
				</div>
				<div class="tb-headline" data-tb="headline">
					<p class="tb-tally">
						<span class="tb-tallydone" data-tally="done">{shipped}</span>
						<span class="tb-tallytotal" data-tally="total">{totalLabel}</span>
					</p>
					<p class="tb-summaryline">
						<span class="tb-summaryemoji" data-summary="emoji">{summaryEmoji}</span>
						<span class="tb-summarytext" data-summary="text">{summary}</span>
					</p>
				</div>
				<p class="tb-note" data-tb="dragnote">
					<span class="tb-notemark">!</span>
					<span class="tb-notetext">DRAG A CARD ONTO ANOTHER COLUMN — it works in solid, qwik, svelte, vue and angular, and IT DOES NOT WORK IN REACT, which is the measurement rather than a shortfall. All six emitters produce the handlers from one .tsrx source; react-dom alone binds by a prop name of its own, so the flattened onDragover this compiler emits never fires there and the drop is never allowed. THE ◀ AND ▶ ARROWS MOVE A CARD IN ALL SIX LANES and are how react moves one. The reference this page was measured against has no working drag at all. See the fixture header.</span>
				</p>
				<main class="tb-board" data-tb="board">
					@for (const column of columns; key column.id) {
						<div class="tb-col" data-col={column.id}>
							<div class="tb-colhead" data-colhead={column.id}>
								<span class="tb-colmark">{column.mark}</span>
								<span class="tb-coltitle" data-coltitle={column.id}>{column.title}</span>
								<span class="tb-colcount" data-colcount={column.id}>{column.tasks.length}</span>
								<span class="tb-colgap"></span>
								<button
									type="button"
									class="tb-colicon"
									aria-label="add task to column"
									data-coladd={column.id}
									onClick={(event) => onTrace('press', { area: 'col-add' }, event)}
								><span class="tb-iconglyph">+</span></button>
							</div>
							<ul
								class="tb-cards"
								data-cards={column.id}
								onDragOver={(event) => event.preventDefault()}
								onDrop={(event) => {
									event.preventDefault();
									columns = columns.map((entry) =>
										entry.id === column.id
											? {
													id: entry.id,
													title: entry.title,
													mark: entry.mark,
													prevId: entry.prevId,
													nextId: entry.nextId,
													tasks: entry.tasks
														.filter((row) => row.id !== dragId)
														.concat(
															columns.flatMap((source) =>
																source.tasks.filter((row) => row.id === dragId),
															),
														),
												}
											: entry.tasks.filter((row) => row.id === dragId).length === 0
												? entry
												: {
														id: entry.id,
														title: entry.title,
														mark: entry.mark,
														prevId: entry.prevId,
														nextId: entry.nextId,
														tasks: entry.tasks.filter((row) => row.id !== dragId),
													},
									);
									dragId = '';
									onTrace('drop', { to: column.id }, event);
								}}
							>
								@for (const task of column.tasks; key task.id) {
									<li
										class="tb-card"
										data-card={task.id}
										data-dragging={task.id === dragId ? 'yes' : 'no'}
										draggable={task.id !== ''}
										onDragStart={(event) => {
											dragId = task.id;
											onTrace('dragstart', { id: task.id, from: column.id }, event);
										}}
										onDragEnd={(event) => {
											dragId = '';
											onTrace('dragend', { id: task.id }, event);
										}}
									>
										<div class="tb-cardtop">
											<span class="tb-cardmark">{column.mark}</span>
											<span class="tb-cardtitle" data-cardtitle={task.id}>{task.title}</span>
										</div>
										<p class="tb-cardblurb" data-cardblurb={task.id}>{task.blurb}</p>
										<div class="tb-tags" data-tags={task.id}>
											@for (const tag of task.tags; key tag.id) {
												<span class="tb-tag" data-tag={tag.id}>{tag.name}</span>
											}
										</div>
										<div class="tb-cardfoot" data-cardfoot={task.id}>
											<span class="tb-meta">
												<span class="tb-metaglyph">▤</span>
												<span class="tb-metatext">{task.date}</span>
											</span>
											<span class="tb-meta" hidden={task.comments === ''}>
												<span class="tb-metaglyph">▭</span>
												<span class="tb-metatext">{task.comments}</span>
											</span>
											<span class="tb-meta" hidden={task.links === ''}>
												<span class="tb-metaglyph">⛓</span>
												<span class="tb-metatext">{task.links}</span>
											</span>
											<span class="tb-metagap"></span>
											<button
												type="button"
												class="tb-move"
												aria-label="move task to the previous column"
												data-left={task.id}
												hidden={column.prevId === ''}
												onClick={(event) => {
													columns = columns.map((entry) =>
														entry.id === column.id
															? {
																	id: entry.id,
																	title: entry.title,
																	mark: entry.mark,
																	prevId: entry.prevId,
																	nextId: entry.nextId,
																	tasks: entry.tasks.filter((row) => row.id !== task.id),
																}
															: entry.id === column.prevId
																? {
																		id: entry.id,
																		title: entry.title,
																		mark: entry.mark,
																		prevId: entry.prevId,
																		nextId: entry.nextId,
																		tasks: entry.tasks.concat([task]),
																	}
																: entry,
													);
													onTrace('move', { id: task.id, to: column.prevId }, event);
												}}
											><span class="tb-moveglyph">◀</span></button>
											<button
												type="button"
												class="tb-move"
												aria-label="move task to the next column"
												data-right={task.id}
												hidden={column.nextId === ''}
												onClick={(event) => {
													columns = columns.map((entry) =>
														entry.id === column.id
															? {
																	id: entry.id,
																	title: entry.title,
																	mark: entry.mark,
																	prevId: entry.prevId,
																	nextId: entry.nextId,
																	tasks: entry.tasks.filter((row) => row.id !== task.id),
																}
															: entry.id === column.nextId
																? {
																		id: entry.id,
																		title: entry.title,
																		mark: entry.mark,
																		prevId: entry.prevId,
																		nextId: entry.nextId,
																		tasks: entry.tasks.concat([task]),
																	}
																: entry,
													);
													onTrace('move', { id: task.id, to: column.nextId }, event);
												}}
											><span class="tb-moveglyph">▶</span></button>
										</div>
									</li>
								}
							</ul>
							<p class="tb-empty" data-empty={column.id} hidden={column.tasks.length !== 0}>
								<span class="tb-emptytext">No tasks here.</span>
							</p>
							<button
								type="button"
								class="tb-add"
								data-add={column.id}
								onClick={(event) => onTrace('press', { area: 'add-task' }, event)}
							>
								<span class="tb-addglyph">+</span>
								<span class="tb-addtext">Add task</span>
							</button>
						</div>
					}
				</main>
			</div>
		</div>
	</section>
}
