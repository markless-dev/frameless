import { compareRuns, runScenario, scenarioById } from '@frameless/analyzer';
import { createReactAdapter } from '@frameless/react/adapter';
import { describe, expect, test } from 'vitest';
import { EventForm } from '../generated/S3.jsx';
import { reactReferences } from './reference.tsx';

// RANDOMISED ACTION ORDERING (audit item 11).
//
// This is the concrete, implementable form of what the owner called "jitter
// testing". That is not standard compiler terminology - it is an SRE term for
// timing variance - but the instinct behind it is sound, and the strategy audit
// re-grounded it as three things: a StrictMode lane (shipped in T007),
// network-throttled Qwik resumption (still open), and this.
//
// The scenarios drive ONE fixed action sequence. That is a real limit: a
// divergence that only appears when a user clicks in a different order is
// invisible to the whole suite today.
//
// The invariant asserted here does NOT require knowing which actions commute -
// which matters, because most of S2's do not. It is simply:
//
//     for ANY order of actions, emitted output and the handwritten reference
//     must still agree.
//
// The end state may differ wildly from the scripted run. That is fine and is not
// what is being checked. What must hold is that both implementations get there
// the same way, in DOM, callbacks, list identity and focus.

const permutations = <T,>(items: readonly T[], seed: number): T[] => {
	// Deterministic shuffle: a fixed seed keeps CI reproducible, and a failure is
	// reported with the seed so it can be replayed.
	const next = (state: number) => (state * 1103515245 + 12345) % 2147483648;
	const out = [...items];
	let state = seed;
	for (let index = out.length - 1; index > 0; index--) {
		state = next(state);
		const swap = state % (index + 1);
		[out[index], out[swap]] = [out[swap]!, out[index]!];
	}
	return out;
};

// S3 only. S2's actions are NOT order-independent: they add an item, then edit,
// toggle, reorder and remove it by id. An arbitrary permutation asks the adapter
// to target an element that does not exist yet, which THROWS rather than
// diverging - so a permuted S2 tests the harness's error handling, not the
// emitter. All four S2 seeds failed that way, and so did the calibration, which
// is what made the cause clear.
//
// Doing S2 properly needs a notion of which actions commute, or an outcome
// comparison that treats "target not found" as a result both implementations
// must share. That is real design work, recorded in the T012 receipt rather than
// bodged here.
const targets = [{ id: 'S3-event-form', emitted: EventForm }] as const;

describe('emitted output agrees with the reference under any action order', () => {
	for (const { id, emitted } of targets) {
		// Several fixed seeds rather than one: enough orders to be meaningful,
		// reproducible enough to debug.
		for (const seed of [1, 7, 42, 1337]) {
			test(`${id} (order seed ${seed})`, async () => {
				const scenario = scenarioById[id]!;
				const shuffled = {
					...scenario,
					actions: permutations(scenario.actions, seed),
					// Callback expectations are order-dependent by construction, so
					// they are dropped here. The comparison against the reference is
					// the oracle - it is strictly stronger than a fixed expectation
					// list, because it checks every channel at every phase.
					expectedCallbacks: [],
				};
				const reference = await runScenario(
					createReactAdapter(reactReferences[id]),
					shuffled,
				);
				const generated = await runScenario(createReactAdapter(emitted), shuffled);
				expect(
					compareRuns(reference, generated),
					`diverged under action order seed ${seed}`,
				).toEqual({ equal: true, divergences: [] });
			});
		}
	}

	// CALIBRATION. The lane must be sensitive to order rather than blind to it:
	// two DIFFERENT orders of the same component must produce different traces.
	// If this ever passes, reordering has stopped being observable and the tests
	// above prove nothing.
	test('CALIBRATION: two different action orders produce different traces', async () => {
		const scenario = scenarioById['S3-event-form']!;
		// Compare the SCRIPTED order against a permutation, having first asserted
		// the two orders genuinely differ. Comparing two seeds was unreliable: S3
		// has only three actions, so different seeds can land on the same
		// permutation and the calibration would pass for the wrong reason.
		const shuffled = permutations(scenario.actions, 1337);
		expect(shuffled.map((a) => a.target)).not.toEqual(
			scenario.actions.map((a) => a.target),
		);
		const run = async (actions: typeof scenario.actions) =>
			runScenario(createReactAdapter(reactReferences['S3-event-form']), {
				...scenario,
				actions,
				expectedCallbacks: [],
			});
		expect(compareRuns(await run(scenario.actions), await run(shuffled)).equal).toBe(false);
	});
});
