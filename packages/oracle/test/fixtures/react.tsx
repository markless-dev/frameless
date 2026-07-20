import { useRef, useState, type ComponentType } from 'react';

type Trace = (name: string, payload: unknown, event?: Event) => void;
type Todo = { id: string; title: string; done: boolean };

export function ReactS1({
	label,
	multiplier,
	visible,
	onTrace,
}: {
	label: string;
	multiplier: number;
	visible: boolean;
	onTrace: Trace;
}) {
	const didRunSetup = useRef(false);
	if (!didRunSetup.current) {
		didRunSetup.current = true;
		onTrace('setup', { runs: 1 });
	}
	const [count, setCount] = useState(() => 1);
	const derived = `${label}:${count * multiplier}`;
	return (
		<div data-s1-root="">
			{!visible ? (
				<p data-branch="hidden">hidden</p>
			) : (
				<section data-scenario="s1">
					<output data-value="derived">{derived}</output>
					<button
						data-action="increment"
						onClick={() => {
							setCount((value) => value + 1);
							onTrace('change', { count: count + 1 });
						}}
					>
						increment
					</button>
				</section>
			)}
		</div>
	);
}

type S2Mutation = 'index-key' | 'wrong-text' | 'duplicate-handler' | undefined;
export function makeReactS2(mutation?: S2Mutation) {
	return function ReactS2({ seed, onTrace }: { seed: Todo[]; onTrace: Trace }) {
		const [todos, setTodos] = useState(() => structuredClone(seed));
		const [draft, setDraft] = useState('');
		const next = useRef(3);
		const emit = (name: string, payload: unknown, event?: Event) => {
			onTrace(name, payload, event);
			if (mutation === 'duplicate-handler' && name === 'toggle') onTrace(name, payload, event);
		};
		const edit = (id: string, title: string, event: Event) =>
			setTodos((old) => {
				const copy = old.map((todo) => (todo.id === id ? { ...todo, title } : todo));
				emit('edit', { id, title }, event);
				return copy;
			});
		const complete = todos.filter((todo) => todo.done).length;
		return (
			<section data-scenario="s2">
				<p data-count="complete">
					{mutation === 'wrong-text' ? complete + 1 : complete}/{todos.length}
				</p>
				<input
					data-action="new"
					value={draft}
					onChange={(event) => setDraft(event.currentTarget.value)}
				/>
				<button
					data-action="add"
					onClick={(event) => {
						const item = { id: `c${next.current++}`, title: draft, done: false };
						setTodos((value) => [...value, item]);
						setDraft('');
						emit('add', { id: item.id, title: item.title }, event.nativeEvent);
					}}
				>
					add
				</button>
				{todos.length === 0 ? <p data-empty="true">empty</p> : null}
				<ul>
					{todos.map((todo, index) => (
						<li
							key={mutation === 'index-key' ? index : todo.id}
							data-oracle-row-key={todo.id}
						>
							<input
								data-edit={todo.id}
								value={todo.title}
								onChange={(event) =>
									edit(todo.id, event.currentTarget.value, event.nativeEvent)
								}
							/>
							<input
								type="checkbox"
								data-toggle={todo.id}
								checked={todo.done}
								onChange={(event) => {
									const checked = event.currentTarget.checked;
									setTodos((value) =>
										value.map((item) =>
											item.id === todo.id ? { ...item, done: checked } : item,
										),
									);
									emit('toggle', { id: todo.id, checked }, event.nativeEvent);
								}}
							/>
							<button
								data-remove={todo.id}
								onClick={(event) => {
									setTodos((value) => value.filter((item) => item.id !== todo.id));
									emit('remove', { id: todo.id }, event.nativeEvent);
								}}
							>
								remove
							</button>
						</li>
					))}
				</ul>
				<button
					data-action="reorder"
					onClick={(event) => {
						const order = [...todos].reverse();
						setTodos(order);
						emit('reorder', { order: order.map((todo) => todo.id) }, event.nativeEvent);
					}}
				>
					reorder
				</button>
				<button
					data-action="clear"
					onClick={(event) => {
						setTodos([]);
						emit('clear', { count: todos.length }, event.nativeEvent);
					}}
				>
					clear
				</button>
			</section>
		);
	};
}

export const ReactS2 = makeReactS2();

type S3Mutation =
	| 'wrong-property'
	| 'omit-callback'
	| 'reorder-callback'
	| 'missing-prevent-default'
	| 'timing'
	| undefined;

export function makeReactS3(mutation?: S3Mutation) {
	return function ReactS3({ initial, onTrace }: { initial: string; onTrace: Trace }) {
		const [text, setText] = useState(initial);
		const [checked, setChecked] = useState(false);
		const [writes, setWrites] = useState(0);
		return (
			<form
				data-scenario="s3"
				onClick={(event) => {
					if (
						(event.target as HTMLElement).dataset.action === 'submit' &&
						mutation !== 'reorder-callback'
					) {
						onTrace('bubble', { source: 'form' }, event.nativeEvent);
					}
				}}
			>
				<input
					data-action="text"
					value={mutation === 'wrong-property' ? `${text}!` : text}
					onChange={(event) => {
						setText(event.currentTarget.value);
						onTrace('text', { value: event.currentTarget.value }, event.nativeEvent);
					}}
				/>
				<input
					type="checkbox"
					data-action="checked"
					checked={checked}
					onChange={(event) => {
						setChecked(event.currentTarget.checked);
						if (mutation !== 'omit-callback') {
							onTrace('checked', { checked: event.currentTarget.checked }, event.nativeEvent);
						}
					}}
				/>
				<button
					type="button"
					data-action="submit"
					onClick={(event) => {
						if (mutation !== 'missing-prevent-default') event.preventDefault();
						if (mutation === 'reorder-callback') {
							onTrace('bubble', { source: 'synthetic' }, event.nativeEvent);
						}
						if (mutation === 'timing') {
							const output = event.currentTarget.form!.querySelector('output')!;
							queueMicrotask(() => {
								output.textContent = '2';
							});
						} else {
							setWrites(1);
							setWrites(2);
						}
						onTrace('submit', { text, checked, writes: 2 }, event.nativeEvent);
					}}
				>
					submit
				</button>
				<output data-writes="true">{writes}</output>
				<span data-callback-marker="present" />
			</form>
		);
	};
}

export const ReactS3 = makeReactS3();

export const reactReferences: Record<string, ComponentType<any>> = {
	'S1-render-once-locals': ReactS1,
	'S2-keyed-todo': ReactS2,
	'S3-event-form': ReactS3,
};
