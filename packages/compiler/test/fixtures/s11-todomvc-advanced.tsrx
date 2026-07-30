import { computed, state } from '@markless/core';

// THE SECOND APPLICATION IN THIS CORPUS, and the first one whose defining
// mechanism is ASYNCHRONOUS. S10 is TodoMVC simple; this is TodoMVC ADVANCED,
// authored ONCE and ATTEMPTED in all six lanes. It is a strict superset of S10 -
// add, toggle, destroy, toggle-all, edit-by-double-click, clear-completed, the
// All/Active/Completed filter - plus the four axes the owner named: LOCAL
// FILTERING, REMOTE QUERY WITH AN ARTIFICIAL DELAY, and an OPTIMISTIC WRITE
// FOLLOWED BY A REVERT with a per-row pending flag.
//
// ITS ASYNC AXES RUN IN FOUR LANES, NOT FIVE AND NOT SIX. TWO LANES CANNOT NAME
// A TIMER, AND THEY FAIL AT TWO DIFFERENT STAGES. This corrects the dispatch AND
// T002's own ruling table, both of which predicted the `new Promise` + setTimeout
// shape would lose ANGULAR ALONE.
//
//   ANGULAR - REFUSES AT EMIT. The emitter resolves every Identifier in a
//   transplanted body against lexical scope plus declared component members and
//   throws otherwise: `Angular emitter cannot resolve the identifier "Promise" in
//   a transplanted body`. Measured on a FULLY SYNCHRONOUS control too
//   (probes/async-door PC), so it is a global-identifier ban, not an async limit.
//   There is no generated/S11.ts and no angular route.
//
//   VUE - EMITS, PASSES ITS OWN GATE, AND THEN THROWS IN THE BROWSER. This one
//   was NOT predicted by anything and no static check in this repo catches it.
//   The vue emitter inlines handlers into TEMPLATE EXPRESSIONS
//   (`@change="async (event) => { ... }"`), and Vue's template compiler prefixes
//   every identifier outside its own allowlist with `_ctx.`. MEASURED at
//   @vue/shared@3.5.40: GLOBALS_ALLOWED is
//   "Infinity,undefined,NaN,isFinite,isNaN,parseFloat,parseInt,decodeURI,
//   decodeURIComponent,encodeURI,encodeURIComponent,Math,Number,Date,Array,
//   Object,Boolean,String,RegExp,Map,Set,JSON,Intl,BigInt,console,Error,Symbol"
//   - it contains Date and JSON and it does NOT contain Promise or setTimeout.
//   So `new Promise(...)` compiles to `new _ctx.Promise(...)` and the browser
//   reports, verbatim: `_ctx.Promise is not a constructor`. compileScript is
//   happy, the vue gate is happy, `pnpm check` is happy. ONLY A BROWSER SEES IT.
//
// Both are LANE LIMITS INSIDE EACH FRAMEWORK'S OWN DESIGN ENVELOPE - Angular
// scopes transplanted bodies deliberately and Vue scopes template expressions
// deliberately - so neither is a defect to file upstream. The four lanes whose
// async axes actually run are REACT, SOLID, QWIK and SVELTE, each driven through
// all seven axes in a real browser with zero console errors. Vue's route is still
// generated and still shipped, because four of its seven axes work and because
// deleting it would delete the evidence; it is labelled EMITS-BUT-MISBEHAVES,
// which is the third verdict T001 established.
//
// THIRTEEN CONSTRAINTS BELOW ARE MEASURED, NOT STYLISTIC. The first eight are
// S10's, unchanged and re-inherited because the same lanes still enforce them;
// the last five are this module's own and were measured ON THIS SOURCE - (9)
// and (10) by emitting a deliberate variant and typechecking it, not by
// reasoning from the emitter.
//
// (1) NO `seed` PROP - IR-8 has no lowering for `TSArrayType`. The list is
//     seeded IN the component, exactly as S10 does. T002 ruled the narrowing
//     from "loads its data when it appears" to "when the user asks" ACCEPTED and
//     ruled an explicit initial-load button OUT: both async axes here are
//     user-initiated by their own nature, so a load button would be a control
//     that exists only to apologise for a missing lifecycle hook.
//
// (2) THE FILTER AND THE SEARCH ARE ONE `hidden` BINDING ON THE ROW, not a
//     repeat over a filtered view. Repeating over a `computed` is refused by
//     Solid ("Array state state:todos has unconsumed keyed identity semantics")
//     and wrapping the row in a branch is refused by three lanes at once. So the
//     repeat stays over `todos`, every row keeps its key across a filter change
//     AND across a search keystroke, and one conditional EXPRESSION decides
//     `hidden` from both axes at once.
//
// (3) THE TITLE IS A `<button>`, not TodoMVC's `<label>` - Svelte's emitted-form
//     gate refuses `<label>{todo.title}</label>` with
//     `a11y_label_has_associated_control` and the `<span>` alternative with
//     `a11y_no_static_element_interactions`.
//
// (4) NO TWO-WORD DOM EVENT IS AUTHORABLE AT ALL (DEFECTS.md 15). Every emitter
//     lowercases the whole event name, so `onKeyDown` prints `onKeydown` and
//     react-dom NEVER FIRES it. Enter rides implicit form submission - which is
//     why BOTH the new-todo box and the SEARCH box live inside a `<form>` -
//     double-click rides S3's `event.detail === 2` idiom, and Escape is a
//     button.
//
// (5) NO STATE WRITE SITS INSIDE AN `if`, AND NO `await` SITS INSIDE A LOOP.
//     DEFECTS.md 8.1: the react emitter lowers only TOP-LEVEL handler
//     statements, so a write nested in an `if` is NEITHER LOWERED NOR REFUSED -
//     it prints as a raw assignment against the `const` that destructures
//     `useState`. Every conditional here is a conditional EXPRESSION and every
//     write is top-level and unconditional. The same rule is why the revert arm
//     below spells its decision as `done: rejected ? !wanted : wanted` INSIDE the
//     object literal rather than branching around two different writes, and why a
//     variable-length async loop is not authorable in this corpus at all.
//
// (6) `editing`, `editDraft`, `query`, `remoteTerm`, `remoteStatus` AND
//     `syncNote` ARE `''`-SENTINEL STRINGS, never `state(null)`. `s7`'s
//     `lock = state(null)` is a LIVE qwik TS2322 in this repo's own `pnpm
//     check`: the initializer pins the inferred cell type to `null`.
//
// (7) NO TOP-LEVEL SIDE-EFFECT CALL in the component body - it emits
//     `useRef(null)` in the react lane and costs a type error.
//
// (8) NO TEMPLATE TEXT NODE HAS WHITESPACE EDGES. Every space that has to sit
//     beside an interpolation is carried by the DATA (`' item left'`,
//     `' matches for '`), because Angular's `escapeText` throws on template text
//     whose own edges are whitespace and the Vue gate's `condense-stable-text`
//     rejects the emitted result for the same shape.
//
// (9) THE AWAITED VALUE IS NEVER CONSUMED, AND THAT IS A TYPE MEASUREMENT
//     RATHER THAN A STYLE CHOICE. `new Promise((settle) => ...)` with no type
//     argument infers `Promise<unknown>`, and this repo's `pnpm check`
//     TYPECHECKS the react, solid and qwik emitted output. MEASURED ON THIS
//     MODULE by emitting a variant whose search handler writes
//     `const delivered = await new Promise(...); remoteHits = delivered;` and
//     running each lane's own `tsc -p`: it costs EXACTLY ONE new error in each
//     of the three typechecking lanes, and they are THREE DIFFERENT CODES -
//     react TS2345 "Argument of type 'unknown' is not assignable to parameter
//     of type 'SetStateAction<number>'", solid TS2769 "No overload matches this
//     call", qwik TS2322 "Type 'unknown' is not assignable to type 'number'".
//     That is +3 and `pnpm check` would RISE from 267 to 270. The shipped shape
//     was measured on the same instrument and adds ZERO: 117/80/70 before and
//     after, per lane. So the promise here is a pure LATENCY - exactly the
//     "artificial delay" the owner accepted - and every value written after the
//     `await` comes from a `const` captured BEFORE it. Typing the promise
//     instead would mean a type ARGUMENT on a `new` expression, which is a new
//     construct for the IR and out of scope on this card.
//
// (10) THE OPTIMISTIC AXIS TRIPS DEFECTS.md 12.2's RECORDED V-LIMIT IN THE
//     REACT LANE, BY CONSTRUCTION, AND IT IS RECORDED HERE RATHER THAN
//     ENGINEERED AROUND. 12.2's repair folds a post-`await` write into React's
//     functional updater `setTodos((current) => ...)` only when the cell's
//     version "is read nowhere else" and the initializer reads the RENDER
//     BINDING of the cell it writes. An optimistic update is BY DEFINITION a
//     write to the same cell on BOTH sides of the boundary, so both conditions
//     fail: the pre-`await` version is read again by the post-`await`
//     initializer, and that initializer therefore reads a version const rather
//     than the render binding. MEASURED on this module's emitted bytes: react
//     resumes with `const nextTodos2 = nextTodos.map(...)` - reading the
//     PRE-SUSPENSION const rather than the cell - while solid, qwik and svelte
//     all resume against the LIVE cell (`setTodos(reconcile(todos.map(...)))`,
//     `todos.splice(0, todos.length, ...todos.map(...))`, `todos = todos.map(...)`).
//     ONE in-flight toggle is identical in every lane that runs the axis, because
//     `nextTodos` is then exactly the current value; the lanes diverge only on TWO
//     OVERLAPPING in-flight toggles, where react's second resume rebuilds from a
//     snapshot that predates the first. This is EMITTED, NOT REFUSED, and no gate
//     or typecheck in this repo sees it. Repairing it is an emitter change and is
//     explicitly outside this card's scope. See the T003 note.
//
// (11) THE REVERT UN-APPLIES THE CHANGE; IT DOES NOT RESTORE A CAPTURED LIST.
//     P9's probe shape is `const previousRows = rows;` before the boundary and
//     `rows = ok ? ... : previousRows` after it, and T001 recorded solid as
//     EMITTING it. THAT MEASUREMENT WAS INCOMPLETE, and this module is where the
//     gap showed: the probe ran `emit()` only, never each lane's own output
//     verification, and the SOLID GATE REFUSES the captured-list form through its
//     THIRD-PARTY arbiter - eslint-plugin-solid `solid/reactivity`, verbatim:
//     "The reactive variable 'todos' should be used within JSX, a tracked scope
//     (like createEffect), or inside an event handler function, or else changes
//     will be ignored." A bare `const previous = todos` reads the store proxy
//     into an untracked local, and `EMITS` is not `PASSES ITS OWN GATE`.
//     So the revert arm computes `done: rejected ? !wanted : wanted` instead.
//     `!wanted` IS the pre-optimistic value, because `wanted` came from the
//     checkbox, so the outcome is identical for this row - and strictly better
//     for every other row, since un-applying cannot clobber a concurrent edit
//     the way restoring a whole captured list would.
//
// (12) `onTrace(...)` IS THE LAST STATEMENT IN EVERY HANDLER THAT CALLS IT.
//     The qwik emitter refuses otherwise: "Qwik v1 rejects synchronous actions
//     after an awaited callback". `event.preventDefault()` is correspondingly
//     the FIRST statement in both submit handlers, before any `await`.
//
// (13) THE SERVER'S ANSWER IS A USER-DRIVEN CHECKBOX, not a coin flip or a
//     clock. Angular has no clock (`Date` is a global it cannot name) and a
//     random revert is not observable in a cross-lane comparison, so
//     `serverFails` is an explicit control: tick it and the NEXT optimistic
//     save is rejected and the row reverts. Both arms of the revert are
//     exercised by the same authored bytes, which is P9's intent, and the flag
//     resets itself after each save so the control is one-shot and the next
//     toggle is accepted again.
export function TodoMvcAdvanced({ onTrace }: {
	onTrace: (name: string, detail: Record<string, unknown>, event: unknown) => void;
}) @{
	let todos = state([
		{ id: 't1', title: 'Taste JavaScript', done: true, pending: false },
		{ id: 't2', title: 'Buy a unicorn', done: false, pending: false },
		{ id: 't3', title: 'Measure the async door', done: false, pending: false },
	]);
	let draft = state('');
	let next = state(4);
	let filter = state('all');
	let editing = state('');
	let editDraft = state('');
	let query = state('');
	let remoteTerm = state('');
	let remoteHits = state(0);
	let remoteStatus = state('idle');
	let serverFails = state(false);
	let syncNote = state('idle');

	const active = computed(() => todos.filter((todo) => !todo.done).length);
	const completed = computed(() => todos.filter((todo) => todo.done).length);
	const allDone = computed(
		() => todos.length > 0 && todos.filter((todo) => !todo.done).length === 0,
	);
	const remainingLabel = computed(() =>
		todos.filter((todo) => !todo.done).length === 1 ? ' item left' : ' items left',
	);
	const shown = computed(
		() =>
			todos.filter(
				(todo) => query === '' || todo.title.toLowerCase().includes(query.toLowerCase()),
			).length,
	);
	const shownLabel = computed(() =>
		todos.filter(
			(todo) => query === '' || todo.title.toLowerCase().includes(query.toLowerCase()),
		).length === 1
			? ' row matches locally'
			: ' rows match locally',
	);
	const remoteLabel = computed(() =>
		remoteHits === 1 ? ' remote match for ' : ' remote matches for ',
	);
	const searching = computed(() => remoteStatus === 'searching');

	<section class="todoapp todoapp-advanced" data-app="todomvc-advanced">
		<header class="header">
			<h1>todos</h1>
			<form
				class="new-todo-form"
				data-action="add"
				onClick={(event) => onTrace('press', { area: 'new-todo' }, event)}
				onSubmit={(event) => {
					event.preventDefault();
					const title = draft.trim();
					const item = { id: `t${next}`, title, done: false, pending: false };
					todos = title === '' ? todos : todos.concat(item);
					next = title === '' ? next : next + 1;
					draft = '';
					onTrace('add', { id: item.id, title }, event);
				}}
			>
				<input
					class="new-todo"
					placeholder="What needs to be done?"
					data-action="new"
					value={draft}
					onInput={(event) => draft = event.currentTarget.value}
				/>
			</form>
		</header>
		<div class="advanced" data-advanced="bar">
			<form
				class="search-form"
				data-action="search"
				onClick={(event) => onTrace('press', { area: 'search' }, event)}
				onSubmit={async (event) => {
					event.preventDefault();
					const term = query.trim();
					const hits = todos.filter(
						(todo) => term === '' || todo.title.toLowerCase().includes(term.toLowerCase()),
					).length;
					remoteTerm = term;
					remoteStatus = 'searching';
					await new Promise((settle) => {
						setTimeout(() => settle(true), 600);
					});
					remoteHits = hits;
					remoteStatus = 'done';
					onTrace('remote-search', { term, hits }, event);
				}}
			>
				<input
					class="search"
					placeholder="Filter locally, submit to query"
					data-action="search-term"
					value={query}
					onInput={(event) => query = event.currentTarget.value}
				/>
				<button
					type="submit"
					class="search-go"
					data-action="remote"
					disabled={searching}
				>search</button>
			</form>
			<p class="local-count" data-local="count"><strong>{shown}</strong>{shownLabel}</p>
			<p class="remote-status" data-remote="status">{remoteStatus}</p>
			<p class="remote-count" data-remote="hits"><strong>{remoteHits}</strong>{remoteLabel}{remoteTerm}</p>
			<input
				id="server-fails"
				class="server-fails"
				type="checkbox"
				data-action="server-fails"
				checked={serverFails}
				onChange={(event) => serverFails = event.currentTarget.checked}
			/>
			<label for="server-fails">Reject the next save</label>
			<p class="sync-note" data-sync="note">{syncNote}</p>
		</div>
		@if (todos.length > 0) {
			<main class="main">
				<input
					id="toggle-all"
					class="toggle-all"
					type="checkbox"
					data-action="toggle-all"
					checked={allDone}
					onChange={(event) => {
						const done = event.currentTarget.checked;
						todos = todos.map((todo) => ({
							id: todo.id,
							title: todo.title,
							done,
							pending: false,
						}));
						onTrace('toggle-all', { done }, event);
					}}
				/>
				<label for="toggle-all">Mark all as complete</label>
				<ul class="todo-list">
					@for (const todo of todos; key todo.id) {
						<li
							class={editing === todo.id ? 'editing' : todo.pending ? 'saving' : todo.done ? 'completed' : ''}
							data-oracle-advanced-key={todo.id}
							hidden={query !== '' && !todo.title.toLowerCase().includes(query.toLowerCase()) ? true : filter === 'active' ? todo.done : filter === 'completed' ? !todo.done : false}
						>
							@if (editing === todo.id) {
							<form
								class="edit-form"
								data-commit={todo.id}
								onClick={(event) => onTrace('press', { area: 'edit' }, event)}
								onSubmit={(event) => {
									event.preventDefault();
									const title = editDraft.trim();
									todos =
										title === ''
											? todos
											: todos.map((entry) =>
													entry.id === todo.id
														? {
																id: entry.id,
																title,
																done: entry.done,
																pending: entry.pending,
															}
														: entry,
												);
									editing = '';
									editDraft = '';
									onTrace('commit', { id: todo.id, title }, event);
								}}
							>
								<input
									class="edit"
									data-edit={todo.id}
									value={editDraft}
									onInput={(event) => editDraft = event.currentTarget.value}
								/>
								<button
									type="button"
									class="cancel-edit"
									data-revert={todo.id}
									onClick={(event) => {
										editing = '';
										editDraft = '';
										onTrace('revert', { id: todo.id }, event);
									}}
								>cancel</button>
							</form>
							} @else {
							<div class="view">
								<input
									class="toggle"
									type="checkbox"
									data-toggle={todo.id}
									checked={todo.done}
									onChange={async (event) => {
										const wanted = event.currentTarget.checked;
										const rejected = serverFails;
										todos = todos.map((entry) =>
											entry.id === todo.id
												? {
														id: entry.id,
														title: entry.title,
														done: wanted,
														pending: true,
													}
												: entry,
										);
										syncNote = 'saving';
										await new Promise((settle) => {
											setTimeout(() => settle(true), 600);
										});
										todos = todos.map((entry) =>
											entry.id === todo.id
												? {
														id: entry.id,
														title: entry.title,
														done: rejected ? !wanted : wanted,
														pending: false,
													}
												: entry,
										);
										syncNote = rejected ? 'reverted' : 'saved';
										serverFails = false;
										onTrace('toggle', { id: todo.id, done: wanted, rejected }, event);
									}}
								/>
								<button
									type="button"
									class="todo-title"
									data-title={todo.id}
									onClick={(event) => {
										const opened = event.detail === 2;
										editing = opened ? todo.id : editing;
										editDraft = opened ? todo.title : editDraft;
										onTrace('edit', { id: todo.id, opened }, event);
									}}
								>{todo.title}</button>
								<span class="row-pending" data-pending={todo.id} hidden={!todo.pending}>saving</span>
								<button
									type="button"
									class="destroy"
									data-destroy={todo.id}
									onClick={(event) => {
										todos = todos.filter((entry) => entry.id !== todo.id);
										onTrace('destroy', { id: todo.id }, event);
									}}
								>x</button>
							</div>
							}
						</li>
					}
				</ul>
			</main>
		} @else {
		}
		@if (todos.length > 0) {
			<footer class="footer">
				<span class="todo-count"><strong>{active}</strong>{remainingLabel}</span>
				<ul class="filters">
					<li>
						<a
							class={filter === 'all' ? 'selected' : ''}
							href="#/"
							data-filter="all"
							onClick={(event) => {
								event.preventDefault();
								filter = 'all';
								onTrace('filter', { filter: 'all' }, event);
							}}
						>All</a>
					</li>
					<li>
						<a
							class={filter === 'active' ? 'selected' : ''}
							href="#/active"
							data-filter="active"
							onClick={(event) => {
								event.preventDefault();
								filter = 'active';
								onTrace('filter', { filter: 'active' }, event);
							}}
						>Active</a>
					</li>
					<li>
						<a
							class={filter === 'completed' ? 'selected' : ''}
							href="#/completed"
							data-filter="completed"
							onClick={(event) => {
								event.preventDefault();
								filter = 'completed';
								onTrace('filter', { filter: 'completed' }, event);
							}}
						>Completed</a>
					</li>
				</ul>
				@if (completed > 0) {
					<button
						type="button"
						class="clear-completed"
						data-action="clear-completed"
						onClick={(event) => {
							const cleared = todos.filter((todo) => todo.done).length;
							todos = todos.filter((todo) => !todo.done);
							onTrace('clear-completed', { cleared }, event);
						}}
					>Clear completed</button>
				} @else {
				}
			</footer>
		} @else {
		}
	</section>
}
