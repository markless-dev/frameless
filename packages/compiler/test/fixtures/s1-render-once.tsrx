import { computed, state } from '@markless/core';

// THE ONLY ANNOTATED MODULE IN THE CORPUS, AND THAT IS THE POINT.
//
// Before this, 0 of 43 live-corpus `.tsrx` files carried a prop type, so
// `PropDestructuringEntry.type` would have been `undefined` in 100% of the
// corpus: the supply channel would have shipped with no evidence that anything
// flows through it. This module is the one specimen that makes IR-8 provable,
// and its golden is the proof.
//
// The types are the ones S1 ALREADY OBEYS, not aspirational ones: `label` is
// interpolated into a template literal, `multiplier` is multiplied, `visible`
// is a branch test, and `onTrace` is called here with exactly two arguments.
// The rest of the corpus stays UNANNOTATED on purpose - it is the control arm
// that proves the field stays absent when the author wrote nothing.
export function RenderOnce({ label, multiplier, visible, onTrace }: {
	label: string;
	multiplier: number;
	visible: boolean;
	onTrace: (name: string, detail: Record<string, unknown>) => void;
}) @{
	const setup = onTrace('setup', { runs: 1 });
	let count = state(1);
	const prefix = `${label}:`;
	const derived = computed(() => `${prefix}${count * multiplier}`);

	<div data-s1-root="">
		@if (!visible) {
			<p data-branch="hidden">hidden</p>
		} @else {
			<section data-scenario="s1">
				<output data-value="derived">{derived}</output>
				<button
					data-action="increment"
					onClick={() => {
						count++;
						onTrace('change', { count });
					}}
				>increment</button>
			</section>
		}
	</div>
}
