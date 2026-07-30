import { computed, state } from '@markless/core';

// THE FIRST APPLICATION IN THIS CORPUS, as opposed to the first scenario. S1-S9
// each isolate one axis; this module is a whole TodoMVC, authored ONCE and
// emitted to all six lanes. Every shape in it was already proven by the scenario
// family - keyed repeat (S2), branch (S1/S5), form controls and dynamic
// attributes (S7/S9), `event.preventDefault()` as a sync policy and the
// `event.detail` click-count idiom (S3), interpolation adjacency (S6).
//
// WHAT IS IN. Add-via-Enter (trimmed, clearing the input), toggle, destroy,
// toggle-all, the active count with its pluralisation, clear-completed, the
// All/Active/Completed filter as INTERNAL STATE, hiding main and footer while
// the list is empty, edit mode by double-click with Enter-commit and an explicit
// revert, and a dynamic class carrying completed/editing/selected.
//
// WHAT IS OUT, AND WHY. localStorage, which is a separate proven axis living in
// `demos/persistence`. URL routing for the filters, because there is no routing
// construct in `.tsrx` at all and three host routes would mean THREE INSTANCES
// WITH INDEPENDENT STATE, which is exactly the six-lane comparison this corpus
// exists to make. Blur-commits-edit, because focus is not observable in this
// harness. And the published `todomvc-app-css` stylesheet, because it is a new
// dependency and this sandbox has no network - the class names below are the
// published ones, so the stylesheet drops in unchanged if it is ever vendored.
//
// EIGHT CONSTRAINTS BELOW ARE MEASURED, NOT STYLISTIC. Each is a lane that
// refused, or silently miscompiled, the obvious spelling. Every refusal is
// recorded verbatim in `docs/goals/frameless-real-apps-v1/notes/T002-todomvc.md`.
//
// (1) NO `seed` PROP. The obvious authoring is `{ seed }: { seed: Todo[] }`, and
//     IR-8 has no lowering for it: react, svelte and angular each throw "has no
//     IR-8 lowering for the type node TSArrayType". The accepted type set is the
//     keywords, a BARE `TSTypeReference` and a `TSFunctionType`, and a bare
//     reference to a locally-declared `Todo` would name a type the emitted module
//     cannot import. So the list is seeded IN the component, which also makes the
//     six lanes byte-comparable on identical data with no host wiring to keep in
//     step.
//
// (2) THE FILTER IS A `hidden` BINDING ON THE ROW, not a repeat over a filtered
//     view. Repeating over a `computed` is refused by Solid - "Array state
//     state:todos has unconsumed keyed identity semantics" - because every
//     array-valued STATE must be consumed by a keyed repeat that names its key.
//     Wrapping the row in the filter branch instead is refused by three lanes at
//     once ("A keyed repeat row must have one host root in this fixture
//     contract"; "Qwik keyed repeat repeat:0 row root must be a host element";
//     "Vue emitter requires a keyed repeat row to be exactly one host element").
//     So the repeat stays over `todos`, every row keeps its key across a filter
//     change, and the filter decides `hidden`. `hidden` is admitted by
//     `DOM_BOOLEAN_CONTENT_ATTRIBUTES` and is NOT in
//     `LANE_PORTABLE_BOOLEAN_ATTRIBUTES`: S9 measured qwik serving `hidden="true"`
//     where five lanes serve `hidden=""`. That is a SERIALIZATION divergence and
//     not a behavioural one - the element is hidden in all six lanes - and this
//     module is not part of the byte-comparing three-way contract.
//
// (3) THE TITLE IS A `<button>`, not TodoMVC's `<label>`. Svelte's emitted-form
//     gate refuses `<label>{todo.title}</label>` with
//     `a11y_label_has_associated_control`, and refuses the `<span>` alternative
//     carrying the same handler with `a11y_no_static_element_interactions`. The
//     toggle-all `<label for="toggle-all">` is untouched: measured separately and
//     accepted, because `for` associates it with a control.
//
// (4) NO TWO-WORD DOM EVENT IS AUTHORABLE AT ALL, WHICH IS WHY ENTER IS A FORM
//     `submit`, DOUBLE-CLICK IS `event.detail === 2`, AND ESCAPE-REVERT IS A
//     BUTTON. Every emitter derives its event prop by capitalising only the FIRST
//     letter of an already-lowercased DOM event name, so `keydown` prints
//     `onKeydown` and `dblclick` prints `onDblclick`. MEASURED, TWICE OVER:
//       - IN A REAL DOM at react-dom 19.2.3, `onKeydown` and `onDblclick` NEVER
//         FIRE; only `onKeyDown` and `onDoubleClick` do, and react-dom logs
//         "Invalid event handler property". React has no `onDblClick` at all, so
//         no capitalisation scheme could have produced its name.
//       - AT THE TYPE LEVEL, one `onKeyDown` binding cost FIVE errors in
//         `pnpm check` - react TS2322 + TS7006, solid TS2322 + TS7006, and qwik
//         TS2339 "Property 'key' does not exist on type 'Event'".
//     No lane REFUSES them, which is what makes this dangerous: in svelte, vue and
//     angular the lowercased name is the correct one, so the defect is invisible
//     there and silent in react. It was invisible everywhere until now only
//     because all three events in S1-S9 are single words. So Enter rides implicit
//     form submission, the double-click rides the click-count idiom S3 already
//     proves, and Escape - whose ONLY spelling is `keydown` - is recorded as
//     UNSPELLABLE and its behaviour kept as an explicit `cancel` control.
//
// (5) NO STATE WRITE SITS INSIDE AN `if` BLOCK. MEASURED: the react emitter lowers
//     only TOP-LEVEL handler statements, so a write nested in an `if` is printed
//     as a raw `todos = ...` against the `const` that destructures `useState` -
//     invalid TypeScript and a runtime TypeError. Svelte, Vue, Angular, Solid and
//     Qwik all lower nested writes correctly, so this too is silent and
//     react-only. Every conditional here is therefore a conditional EXPRESSION on
//     the value, and each write is unconditional and top-level; writing a cell
//     back to itself is the no-op arm, which React's `useState` bail-out already
//     understands because the reference is unchanged.
//
// (6) `editing` AND `editDraft` ARE `''`-SENTINEL STRINGS, never `state(null)`.
//     `s7`'s `lock = state(null)` is a LIVE qwik TS2322 in this repo's own `pnpm
//     check`: the initializer pins the inferred cell type to `null`, so the first
//     non-null write does not type. A `''` sentinel infers `string`.
//
// (7) NO TOP-LEVEL SIDE-EFFECT CALL in the component body. One emits
//     `useRef(null)` in the react lane and costs a type error; it is S1's ONLY
//     error in `pnpm check`. Every call site here is inside a handler or a
//     `computed`.
//
// (8) NO TEMPLATE TEXT NODE HAS WHITESPACE EDGES. The count reads
//     `<strong>{active}</strong>{remainingLabel}` with nothing between them, and
//     the space is carried by the DATA - `' item left'` - for the reason S6
//     records: Angular's `escapeText` throws on template text whose own edges are
//     whitespace and the Vue gate rejects the emitted result for the same shape.
export function TodoMvc({ onTrace }: {
	onTrace: (name: string, detail: Record<string, unknown>, event: unknown) => void;
}) @{
	let todos = state([
		{ id: 't1', title: 'Taste JavaScript', done: true },
		{ id: 't2', title: 'Buy a unicorn', done: false },
	]);
	let draft = state('');
	let next = state(3);
	let filter = state('all');
	let editing = state('');
	let editDraft = state('');

	const active = computed(() => todos.filter((todo) => !todo.done).length);
	const completed = computed(() => todos.filter((todo) => todo.done).length);
	const allDone = computed(
		() => todos.length > 0 && todos.filter((todo) => !todo.done).length === 0,
	);
	const remainingLabel = computed(() =>
		todos.filter((todo) => !todo.done).length === 1 ? ' item left' : ' items left',
	);

	<section class="todoapp" data-app="todomvc">
		<header class="header">
			<h1>todos</h1>
			<form
				class="new-todo-form"
				data-action="add"
				onClick={(event) => onTrace('press', { area: 'new-todo' }, event)}
				onSubmit={(event) => {
					event.preventDefault();
					const title = draft.trim();
					const item = { id: `t${next}`, title, done: false };
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
						todos = todos.map((todo) => ({ id: todo.id, title: todo.title, done }));
						onTrace('toggle-all', { done }, event);
					}}
				/>
				<label for="toggle-all">Mark all as complete</label>
				<ul class="todo-list">
					@for (const todo of todos; key todo.id) {
						<li
							class={editing === todo.id ? 'editing' : todo.done ? 'completed' : ''}
							data-oracle-todo-key={todo.id}
							hidden={filter === 'active' ? todo.done : filter === 'completed' ? !todo.done : false}
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
														? { id: entry.id, title, done: entry.done }
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
									onChange={(event) => {
										const done = event.currentTarget.checked;
										todos = todos.map((entry) =>
											entry.id === todo.id
												? { id: entry.id, title: entry.title, done }
												: entry,
										);
										onTrace('toggle', { id: todo.id, done }, event);
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
