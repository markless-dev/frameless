import { state } from '@markless/core';

// THE SECOND ANNOTATED MODULE IN THE CORPUS, and the annotation is on the axis
// rather than on the count. `ready` is the thing the handlers `await`: T043's
// re-specification of S8 is "`await` on a promise-VALUED prop", and on an
// unannotated prop that sentence is unprovable - the emitted `await ready` is an
// `await` of `any`, which is also what awaiting a number looks like. Typing it
// `Promise<string>` is what makes the emitted output say what the scenario
// claims. `s1-render-once.tsrx` remains the specimen that proves IR-8 carries a
// type at all; the other seven scenarios remain the unannotated control arm.
export function AsyncBoard({ ready, onTrace }: {
	ready: Promise<string>;
	onTrace: (name: string, detail: Record<string, unknown>, event: unknown) => void;
}) @{
	let ticks = state(0);
	let phase = state('idle');
	let cancels = state(0);

	<form data-scenario="s8">
		<p data-async="ticks">{ticks}</p>
		<p data-async="phase">{phase}</p>
		<p data-async="cancels">{cancels}</p>
		<button
			type="button"
			data-action="run"
			onClick={async (event) => {
				phase = 'pending';
				await ready;
				ticks = ticks + 1;
				phase = 'done';
				onTrace('run', { phase: 'done' }, event);
			}}
		>run</button>
		<button
			type="submit"
			data-action="cancel-run"
			onClick={async (event) => {
				event.preventDefault();
				await ready;
				cancels = cancels + 1;
				onTrace('cancel', { cancels: 1 }, event);
			}}
		>cancel</button>
	</form>
}
