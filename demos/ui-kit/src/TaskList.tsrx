import { computed, state } from '@markless/core';

export function TaskList({ seedTasks, onTrace }) @{
	let tasks = state(seedTasks.map((task) => ({ ...task })));
	let draftTitle = state('');
	let nextTaskNumber = state(3);
	const openCount = computed(() => tasks.filter((task) => !task.done).length);

	<section data-component="task-list">
		<header>
			<h2>Launch checklist</h2>
			<output data-open-count="">{openCount} open</output>
		</header>
		<input
			data-action="draft-task"
			value={draftTitle}
			onInput={(event) => {
				draftTitle = event.currentTarget.value;
				onTrace('draft-changed', { title: event.currentTarget.value }, event);
			}}
		/>
		<button
			data-action="create-task"
			onClick={(event) => {
				const task = { id: `task-${nextTaskNumber}`, title: draftTitle, done: false };
				nextTaskNumber++;
				tasks = tasks.concat(task);
				draftTitle = '';
				onTrace('task-created', { id: task.id, title: task.title }, event);
			}}
		>Create task</button>
		@if (tasks.length === 0) {
			<p data-task-state="empty">No tasks remain.</p>
		} @else {
		}
		<ul>
			@for (const task of tasks; key task.id) {
				<li data-oracle-row-key={task.id}>
					<input
						data-task-title={task.id}
						value={task.title}
						onInput={(event) => {
							const title = event.currentTarget.value;
							const copy = tasks.slice();
							const current = copy.find((item) => item.id === task.id);
							current.title = title;
							tasks = copy;
							onTrace('task-renamed', { id: task.id, title }, event);
						}}
					/>
					<input
						type="checkbox"
						data-task-toggle={task.id}
						checked={task.done}
						onChange={(event) => {
							const done = event.currentTarget.checked;
							const copy = tasks.slice();
							const current = copy.find((item) => item.id === task.id);
							current.done = done;
							tasks = copy;
							onTrace('task-toggled', { id: task.id, done }, event);
						}}
					/>
					<button
						data-task-remove={task.id}
						onClick={(event) => {
							tasks = tasks.filter((item) => item.id !== task.id);
							onTrace('task-removed', { id: task.id }, event);
						}}
					>Remove</button>
				</li>
			}
		</ul>
		<button
			data-action="clear-tasks"
			onClick={(event) => {
				const count = tasks.length;
				tasks = [];
				onTrace('tasks-cleared', { count }, event);
			}}
		>Clear all</button>
	</section>
}
