import { createSignal, For, Show } from 'solid-js';

type Trace = (name: string, payload: unknown, event?: Event) => void;
type Todo = { id: string; title: string; done: boolean };

export function SolidS1(props: {
	label: string;
	multiplier: number;
	visible: boolean;
	onTrace: Trace;
}) {
	const { label, multiplier, visible } = props;
	props.onTrace('setup', { runs: 1 });
	const [count, setCount] = createSignal(1);
	const derived = () => `${label}:${count() * multiplier}`;
	return (
		<div data-s1-root="">
			{!visible ? (
				<p data-branch="hidden">hidden</p>
			) : (
				<section data-scenario="s1">
					<output data-value="derived">{derived()}</output>
					<button
						data-action="increment"
						onClick={() => {
							const next = count() + 1;
							setCount(next);
							props.onTrace('change', { count: next });
						}}
					>
						increment
					</button>
				</section>
			)}
		</div>
	);
}

export function SolidS2(props: { seed: Todo[]; onTrace: Trace }) {
	const [todos, setTodos] = createSignal(structuredClone(props.seed));
	const [draft, setDraft] = createSignal('');
	let next = 3;
	const edit = (id: string, title: string, event: Event) => {
		const copy = [...todos()];
		copy.find((todo) => todo.id === id)!.title = title;
		setTodos(copy);
		props.onTrace('edit', { id, title }, event);
	};
	const row = (todo: Todo) => (
		<li data-oracle-row-key={todo.id}>
			<input
				data-edit={todo.id}
				value={todos() && todo.title}
				onInput={(event) => edit(todo.id, event.currentTarget.value, event)}
			/>
			<input
				type="checkbox"
				data-toggle={todo.id}
				checked={todo.done}
				onChange={(event) => {
					const checked = event.currentTarget.checked;
					setTodos((value) => {
						const copy = [...value];
						copy.find((item) => item.id === todo.id)!.done = checked;
						return copy;
					});
					props.onTrace('toggle', { id: todo.id, checked }, event);
				}}
			/>
			<button
				data-remove={todo.id}
				onClick={(event) => {
					setTodos((value) => value.filter((item) => item.id !== todo.id));
					props.onTrace('remove', { id: todo.id }, event);
				}}
			>
				remove
			</button>
		</li>
	);
	return (
		<section data-scenario="s2">
			<p data-count="complete">
				{todos().filter((todo) => todo.done).length}/{todos().length}
			</p>
			<input
				data-action="new"
				value={draft()}
				onInput={(event) => setDraft(event.currentTarget.value)}
			/>
			<button
				data-action="add"
				onClick={(event) => {
					const item = { id: `c${next++}`, title: draft(), done: false };
					setTodos((value) => [...value, item]);
					setDraft('');
					props.onTrace('add', { id: item.id, title: item.title }, event);
				}}
			>
				add
			</button>
			<Show when={todos().length === 0} fallback={<ul><For each={todos()}>{row}</For></ul>}>
				<>
					<p data-empty="true">empty</p>
					<ul />
				</>
			</Show>
			<button
				data-action="reorder"
				onClick={(event) => {
					const order = [...todos()].reverse();
					setTodos(order);
					props.onTrace('reorder', { order: order.map((todo) => todo.id) }, event);
				}}
			>
				reorder
			</button>
			<button
				data-action="clear"
				onClick={(event) => {
					const count = todos().length;
					setTodos([]);
					props.onTrace('clear', { count }, event);
				}}
			>
				clear
			</button>
		</section>
	);
}

export function SolidS3(props: { initial: string; onTrace: Trace }) {
	const [text, setText] = createSignal(props.initial);
	const [checked, setChecked] = createSignal(false);
	const [writes, setWrites] = createSignal(0);
	return (
		<form
			data-scenario="s3"
			onClick={(event) => {
				if ((event.target as HTMLElement).dataset.action === 'submit') {
					props.onTrace('bubble', { source: 'form' }, event);
				}
			}}
		>
			<input
				data-action="text"
				value={text()}
				onInput={(event) => {
					setText(event.currentTarget.value);
					props.onTrace('text', { value: event.currentTarget.value }, event);
				}}
			/>
			<input
				type="checkbox"
				data-action="checked"
				checked={checked()}
				onChange={(event) => {
					setChecked(event.currentTarget.checked);
					props.onTrace('checked', { checked: event.currentTarget.checked }, event);
				}}
			/>
			<button
				type="button"
				data-action="submit"
				onClick={(event) => {
					event.preventDefault();
					setWrites(1);
					setWrites(2);
					props.onTrace('submit', { text: text(), checked: checked(), writes: 2 }, event);
				}}
			>
				submit
			</button>
			<output data-writes="true">{writes()}</output>
			<span data-callback-marker="present" />
		</form>
	);
}

export const solidReferences: Record<string, (props: any) => unknown> = {
	'S1-render-once-locals': SolidS1,
	'S2-keyed-todo': SolidS2,
	'S3-event-form': SolidS3,
};
