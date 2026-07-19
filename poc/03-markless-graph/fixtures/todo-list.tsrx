import { computed, state } from '@markless/core';

// C7 fixture: keyed todo list with state array, computed count, @if, keyed
// @for, event handlers, and a destructuring alias over a state object.
export function TodoApp() @{
	let todos = state([
		{ id: 'a', title: 'write tests', done: false },
		{ id: 'b', title: 'ship', done: true },
	]);
	const settings = state({ title: 'Board', theme: 'light' });
	// boardTitle is a destructured graph alias; the template below reads
	// settings.title directly because markless 0.1.1 public-render rejects
	// template reads of destructured aliases (MARKLESS_TEMPLATE_READ_UNDECLARED
	// — recorded as a finding). The alias record itself is asserted in C7.
	const { title: boardTitle } = settings;
	let draft = state('');
	const remaining = computed(() => todos.filter((todo) => !todo.done).length);

	<main>
		<h1 data-title>{settings.title}</h1>
		<output data-remaining>{remaining}</output>
		<input data-draft value={draft} onInput={(event) => draft = event.currentTarget.value} />
		<button
			type="button"
			data-add
			onClick={() => {
				todos.push({ id: `todo-${todos.length}`, title: draft, done: false });
				draft = '';
			}}
		>
			add
		</button>
		@if (todos.length === 0) {
			<p data-empty>Nothing to do</p>
		}
		<ul>
			@for (const todo of todos; key todo.id) {
				<li data-row>
					<span>{todo.title}</span>
					<button
						type="button"
						data-toggle
						onClick={() => todos = todos.map((item) => item.id === todo.id ? { ...item, done: !item.done } : item)}
					>
						toggle
					</button>
				</li>
			}
		</ul>
	</main>
}
