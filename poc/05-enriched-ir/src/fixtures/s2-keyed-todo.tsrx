import { computed, state } from '@markless/core';

export function KeyedTodo({ seed, onTrace }) @{
	let todos = state(seed.map((todo) => ({ ...todo })));
	let draft = state('');
	let next = state(3);
	const complete = computed(() => todos.filter((todo) => todo.done).length);

	<section data-scenario="s2">
		<p data-count="complete">{complete}/{todos.length}</p>
		<input
			data-action="new"
			value={draft}
			onInput={(event) => draft = event.currentTarget.value}
		/>
		<button
			data-action="add"
			onClick={(event) => {
				const item = { id: `c${next}`, title: draft, done: false };
				next++;
				todos = todos.concat(item);
				draft = '';
				onTrace('add', { id: item.id, title: item.title }, event);
			}}
		>
			add
		</button>
		@if (todos.length === 0) {
			<p data-empty="true">empty</p>
		} @else {
		}
		<ul>
			@for (const todo of todos; key todo.id) {
					<li data-oracle-row-key={todo.id}>
						<input
							data-edit={todo.id}
							value={todo.title}
							onInput={(event) => {
								const title = event.currentTarget.value;
								const alias = todos.find((item) => item.id === todo.id);
								alias.title = title;
								todos = todos.slice();
								onTrace('edit', { id: todo.id, title }, event);
							}}
						/>
						<input
							type="checkbox"
							data-toggle={todo.id}
							checked={todo.done}
							onChange={(event) => {
								const checked = event.currentTarget.checked;
								const copy = todos.slice();
								const alias = copy.find((item) => item.id === todo.id);
								alias.done = checked;
								todos = copy;
								onTrace('toggle', { id: todo.id, checked }, event);
							}}
						/>
						<button
							data-remove={todo.id}
							onClick={(event) => {
								todos = todos.filter((item) => item.id !== todo.id);
								onTrace('remove', { id: todo.id }, event);
							}}
						>
							remove
						</button>
					</li>
			}
		</ul>
		<button
			data-action="reorder"
			onClick={(event) => {
				const order = todos.slice().reverse();
				todos = order;
				onTrace('reorder', { order: order.map((todo) => todo.id) }, event);
			}}
		>
			reorder
		</button>
		<button
			data-action="clear"
			onClick={(event) => {
				const count = todos.length;
				todos = [];
				onTrace('clear', { count }, event);
			}}
		>
			clear
		</button>
	</section>
}
