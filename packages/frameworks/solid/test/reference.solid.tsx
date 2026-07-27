import { createSignal, For, Show, untrack } from 'solid-js';
import { createStore, produce, reconcile } from 'solid-js/store';

type Trace = (name: string, payload: unknown, event?: Event) => void;
type Todo = { id: string; title: string; done: boolean };

export function SolidS1(props: {
	label: string;
	multiplier: number;
	visible: boolean;
	onTrace: Trace;
}) {
	untrack(() => props.onTrace('setup', { runs: 1 }));
	const [count, setCount] = createSignal(1);
	const prefix = untrack(() => `${props.label}:`);
	const derived = () => `${prefix}${count() * props.multiplier}`;
	return (
		<div data-s1-root="">
			<Show
				when={!props.visible}
				fallback={
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
				}
			>
				<p data-branch="hidden">hidden</p>
			</Show>
		</div>
	);
}

type S2Mutation = 'index-key' | 'wrong-text' | 'duplicate-handler' | undefined;
export function makeSolidS2(mutation?: S2Mutation) {
	return function SolidS2(props: { seed: Todo[]; onTrace: Trace }) {
		const [todos, setTodos] = createStore(
			untrack(() => props.seed.map((todo) => ({ ...todo }))),
		);
		const [draft, setDraft] = createSignal('');
		let next = 3;
		const emit = (name: string, payload: unknown, event?: Event) => {
			props.onTrace(name, payload, event);
			if (mutation === 'duplicate-handler' && name === 'toggle') {
				props.onTrace(name, payload, event);
			}
		};
		const edit = (id: string, title: string, event: Event) => {
			setTodos(
				produce((draft) => {
					draft.find((todo) => todo.id === id)!.title = title;
				}),
			);
			emit('edit', { id, title }, event);
		};
		// Solid's <For> keys rows by object identity rather than an explicit key prop.
		// Fresh clones on every collection update are the Solid-idiomatic equivalent
		// of an index-key violation: === identity breaks and every row remounts.
		const rows = () => (mutation === 'index-key' ? todos.map((todo) => ({ ...todo })) : todos);
		const complete = () => todos.filter((todo) => todo.done).length;
		const row = (todo: Todo) => (
			<li data-oracle-row-key={todo.id}>
				<input
					data-edit={todo.id}
					value={todo.title}
					attr:value={todo.title}
					onInput={(event) => edit(todo.id, event.currentTarget.value, event)}
				/>
				<input
					type="checkbox"
					data-toggle={todo.id}
					checked={todo.done}
					onChange={(event) => {
						const checked = event.currentTarget.checked;
						setTodos(
							produce((draft) => {
								draft.find((item) => item.id === todo.id)!.done = checked;
							}),
						);
						emit('toggle', { id: todo.id, checked }, event);
					}}
				/>
				<button
					data-remove={todo.id}
					onClick={(event) => {
						setTodos(
							reconcile(
								todos.filter((item) => item.id !== todo.id),
								{ key: 'id' },
							),
						);
						emit('remove', { id: todo.id }, event);
					}}
				>
					remove
				</button>
			</li>
		);
		return (
			<section data-scenario="s2">
				<p data-count="complete">
					{mutation === 'wrong-text' ? complete() + 1 : complete()}/{todos.length}
				</p>
				<input
					data-action="new"
					value={draft()}
					attr:value={draft()}
					onInput={(event) => setDraft(event.currentTarget.value)}
				/>
				<button
					data-action="add"
					onClick={(event) => {
						const item = { id: `c${next++}`, title: draft(), done: false };
						setTodos(reconcile([...todos, item], { key: 'id' }));
						setDraft('');
						emit('add', { id: item.id, title: item.title }, event);
					}}
				>
					add
				</button>
				<Show when={todos.length === 0} fallback={<></>}>
					<p data-empty="true">empty</p>
				</Show>
				<ul>
					<For each={rows()}>{row}</For>
				</ul>
				<button
					data-action="reorder"
					onClick={(event) => {
						const order = [...todos].reverse();
						setTodos(reconcile(order, { key: 'id' }));
						emit('reorder', { order: order.map((todo) => todo.id) }, event);
					}}
				>
					reorder
				</button>
				<button
					data-action="clear"
					onClick={(event) => {
						const count = todos.length;
						setTodos(reconcile([], { key: 'id' }));
						emit('clear', { count }, event);
					}}
				>
					clear
				</button>
			</section>
		);
	};
}

export const SolidS2 = makeSolidS2();

type S3Mutation =
	| 'wrong-property'
	| 'omit-callback'
	| 'reorder-callback'
	| 'missing-prevent-default'
	| 'timing'
	| undefined;

export function makeSolidS3(mutation?: S3Mutation) {
	return function SolidS3(props: { initial: string; onTrace: Trace }) {
		const [text, setText] = createSignal(untrack(() => props.initial));
		const [checked, setChecked] = createSignal(false);
		const [writes, setWrites] = createSignal(0);
		return (
			<form
				data-scenario="s3"
				onClick={(event) => {
					if (
						(event.target as HTMLElement).dataset.action === 'submit' &&
						mutation !== 'reorder-callback'
					) {
						props.onTrace('bubble', { source: 'form' }, event);
					}
				}}
			>
				<input
					data-action="text"
					value={mutation === 'wrong-property' ? `${text()}!` : text()}
					attr:value={mutation === 'wrong-property' ? `${text()}!` : text()}
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
						if (mutation !== 'omit-callback') {
							props.onTrace(
								'checked',
								{ checked: event.currentTarget.checked },
								event,
							);
						}
					}}
				/>
				<button
					type="button"
					data-action="submit"
					onClick={(event) => {
						if (mutation !== 'missing-prevent-default') event.preventDefault();
						if (mutation === 'reorder-callback') {
							props.onTrace('bubble', { source: 'synthetic' }, event);
						}
						if (mutation === 'timing') {
							// Timing-channel contract under Solid's synchronous commit semantics:
							// dispatch returns after the handler and reactive DOM writes complete.
							// The calibrated sensitivity is "write lands beyond the immediate
							// post-dispatch observation window": this delayed direct write shows
							// stale DOM at the after/microtask phases (vs the clean run) and
							// converges by quiescence — divergence at the early phases is the
							// detection.
							const output = event.currentTarget.form!.querySelector('output')!;
							setTimeout(() => {
								output.textContent = '2';
							}, 30);
						} else {
							setWrites(1);
							setWrites(2);
						}
						props.onTrace(
							'submit',
							{ text: text(), checked: checked(), writes: 2 },
							event,
						);
					}}
				>
					submit
				</button>
				<button
					type="submit"
					data-action="cancel-submit"
					onClick={(event) => {
						event.preventDefault();
					}}
				>
					cancel-submit
				</button>
				<output data-writes="true">{writes()}</output>
				<span data-callback-marker="present" />
				<details data-cancel="guarded">
					<summary
						data-action="cancel-open"
						onClick={(event) => {
							if (event.detail === 1) {
								event.preventDefault();
							}
						}}
					>
						cancel-open
					</summary>
				</details>
				<details data-cancel="unguarded">
					<summary
						data-action="allow-open"
						onClick={(event) => {
							if (event.detail === 2) {
								event.preventDefault();
							}
						}}
					>
						allow-open
					</summary>
				</details>
			</form>
		);
	};
}

export const SolidS3 = makeSolidS3();

export const solidReferences: Record<string, (props: any) => unknown> = {
	'S1-render-once-locals': SolidS1,
	'S2-keyed-todo': SolidS2,
	'S3-event-form': SolidS3,
};
