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
// THE AXIS THIS CARD EXISTS TO MEASURE IS DRAG AND DROP, AND THIS MODULE DOES
// NOT CONTAIN IT. THAT IS THE MEASUREMENT, AND IT IS STATED ON THE PAGE.
// ==========================================================================
//
// The board predicted `onDragStart` / `onDragOver` / `onDrop` / `onPointerDown`
// "cannot be produced" because they are two-word and `jsxEventName` in
// packages/compiler/src/build.ts does `name.slice(2).toLowerCase()`.
// MEASURED ON A PROBE THROUGH ALL SIX REAL EMITTERS - see the T005 note - AND
// THE PREDICTION IS WRONG IN BOTH DIRECTIONS:
//
//   * THEY ARE PRODUCED. Five of the six emitters take them without complaint.
//     DEFECTS.md 15 says so itself - "there is no refusal in front of it" - so
//     the compiler ACCEPTS a spelling it is about to destroy. The sixth lane,
//     svelte, refuses only on the ELEMENT, not on the event: a `<div>` or
//     `<span>` carrying any drag handler fails `a11y_no_static_element_
//     interactions`, while the identical handlers on `<ul>` and `<li>` emit.
//
//   * THEY ARE NOT UNIFORMLY INERT EITHER. The casing loss is fatal only where
//     the lane binds by a FRAMEWORK PROP NAME. react prints `onDragover` and
//     react-dom never fires it; vue prints `@dragover`, angular prints
//     `(dragover)`, svelte prints `ondragover` - and `dragover` IS the real DOM
//     event name, so those three are CORRECT BY ACCIDENT OF THE SAME BUG.
//
// WHAT ACTUALLY KEEPS THE DRAG OFF THIS PAGE IS THE TYPE BASELINE, and it was
// measured rather than guessed. A single drop zone plus a single draggable card
// takes `pnpm check` from 267 to 280: react 117 -> 123 and solid 80 -> 86 (one
// TS2322 per host for the unknown prop plus one TS7006 per handler, whose
// parameter can no longer be contextually typed), and qwik 70 -> 71 - the last
// one NOT from an event at all but from `draggable="true"`, which this corpus
// lowers as a STRING while qwik's JSX types declare `draggable?: boolean`. That
// is constraint (14)'s `rows="6"` finding in a second, non-numeric shape.
// This board's oracle part 3 says `pnpm check` MUST NOT RISE above 267, so the
// axis is not shippable here. It is RECORDED, NOT SUBSTITUTED: the page says so
// in `.tb-note`, and cards move with the ARROW BUTTONS below, which is a
// DIFFERENT INTERACTION AND IS LABELLED AS ONE.
//
// FOR THE RECORD, THE REFERENCE HAS NO WORKING DRAG EITHER - QA'd live by the
// PM (the drag selects text), its Filter popover does not filter and "Add task"
// is inert. Measured again here: `document.querySelectorAll('[draggable="true"]')`
// returns ZERO on that page.
//
// WHAT THE MOVE ARROWS MOVE, all derived from the SINGLE `columns` cell and
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
// (4) NO TWO-WORD DOM EVENT IS SHIPPED - see the block above. This is the first
//     fixture in the corpus whose axis IS that constraint, so it is the first
//     one where (4) is a finding rather than an avoidance.
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
// (13) NO `style` ATTRIBUTE IS BOUND ANYWHERE. No fixture in this corpus binds
//     one, so the lowering is UNMEASURED in all six lanes; a drag ghost or a
//     drop-target highlight is exactly where a `style` binding would have been
//     reached for, and this page uses class names instead - which is also why
//     there is no highlight to bind.
//
// (14) NO STATIC NUMERIC ATTRIBUTE IS SPELLED ANYWHERE, and this card widens
//     that constraint. T003 measured `rows="6"` failing the react lane's
//     emitted typecheck because the corpus lowers a static attribute as a
//     STRING; T005 measured the SAME FAILURE ON A NON-NUMERIC ATTRIBUTE -
//     `draggable="true"` against qwik's `draggable?: boolean`. The rule is not
//     "no numbers", it is NO STATIC ATTRIBUTE WHOSE DOM TYPE IS NOT `string`.
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
// WHAT IS DELIBERATELY NOT HERE, each with a reason rather than an omission.
// There is no page routing - `.tsrx` has no routing construct at all - so the
// sidebar links, `Filter`, `Sort`, `Import / Export`, `Request task`, the
// per-column `+` and `Add task` are INERT and recorded as such, exactly as the
// reference's own `Filter` and `Add task` are. There are no assignee avatars:
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
					<span class="tb-notetext">DRAG AND DROP IS NOT WIRED ON THIS PAGE, and that absence is the measurement. Cards move with the ◀ and ▶ arrows instead — a different interaction, labelled as one. Measured through all six real emitters: the drag events DO emit in five lanes and are inert only where the lane binds by a framework prop name, but one drop zone and one draggable card take pnpm check from 267 to 280. See the fixture header.</span>
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
							<ul class="tb-cards" data-cards={column.id}>
								@for (const task of column.tasks; key task.id) {
									<li class="tb-card" data-card={task.id}>
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
