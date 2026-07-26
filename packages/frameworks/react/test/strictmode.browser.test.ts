import { calibrationScenarios, compareRuns, runScenario } from '@frameless/analyzer';
import { createReactAdapter } from '@frameless/react/adapter';
import React from 'react';
import { describe, expect, test } from 'vitest';
import { EventForm } from '../generated/S3.jsx';
import { KeyedTodo } from '../generated/S2.jsx';
import { RenderOnce } from '../generated/S1.jsx';
import { reactReferences } from './reference.tsx';

// StrictMode lane (audit item 7, and the concrete form of what the owner called
// "jitter testing" - see the strategy audit's T002 note).
//
// React 19 intentionally double-invokes component bodies and effects under
// StrictMode in development, to surface work that is not idempotent. That is
// exactly the shape of bug a code generator can introduce: emitted setup logic
// guarded by a ref, a mutation performed during render, an effect that is not
// safe to run twice.
//
// The stakes are concrete here rather than hypothetical. Scenario S1 asserts
// `setup` runs EXACTLY ONCE (packages/analyzer/src/scenarios.ts), and the
// emitted S1 implements once-per-mount setup with a useRef guard executed during
// render. Whether that guard survives StrictMode's double render was never
// tested: StrictMode appears only in the demo entry files
// (demos/react-official/src/entry-*.jsx, demos/ssr/react-app/src/*.tsx), never
// in this package's tests.
//
// The comparison is deliberately asymmetric: the emitted component runs wrapped
// in StrictMode, the handwritten reference runs unwrapped. Wrapping both would
// let a shared double-invocation bug cancel out and still report "equal".

const emitted = {
	'S1-render-once-locals': RenderOnce,
	'S2-keyed-todo': KeyedTodo,
	'S3-event-form': EventForm,
};

/** Wrap a component so it mounts inside StrictMode without changing its props. */
function strict<P extends object>(Component: React.ComponentType<P>): React.ComponentType<P> {
	const Wrapped = (props: P) =>
		React.createElement(React.StrictMode, null, React.createElement(Component, props));
	Wrapped.displayName = `Strict(${Component.displayName ?? Component.name ?? 'Component'})`;
	return Wrapped;
}

describe('emitted React output under StrictMode double-invocation', () => {
	for (const scenario of calibrationScenarios) {
		test(scenario.id, async () => {
			const componentId = scenario.id.split('/')[0]! as keyof typeof emitted;
			const reference = await runScenario(
				createReactAdapter(reactReferences[componentId]),
				scenario,
			);
			const strictEmitted = await runScenario(
				createReactAdapter(strict(emitted[componentId])),
				scenario,
			);
			expect(compareRuns(reference, strictEmitted)).toEqual({
				equal: true,
				divergences: [],
			});
		});
	}

	// CALIBRATION. This lane must be able to see a StrictMode-specific defect,
	// not merely pass because StrictMode happens to change nothing observable.
	// A component whose setup callback is NOT guarded fires twice under
	// StrictMode's double render, and the comparison must catch it.
	test('CALIBRATION: an unguarded once-per-mount setup diverges under StrictMode', async () => {
		const scenario = calibrationScenarios[0]!;
		const Unguarded = ({ onTrace, ...rest }: Record<string, unknown>) => {
			// No ref guard: this runs on every render, so StrictMode's double
			// invocation reports setup twice where the contract demands once.
			(onTrace as (name: string, payload: unknown) => void)('setup', { runs: 1 });
			return React.createElement(
				emitted['S1-render-once-locals'] as React.ComponentType<any>,
				{ onTrace, ...rest },
			);
		};
		const reference = await runScenario(
			createReactAdapter(reactReferences['S1-render-once-locals']),
			scenario,
		);
		const broken = await runScenario(createReactAdapter(strict(Unguarded)), scenario);
		expect(compareRuns(reference, broken).equal).toBe(false);
	});
});
