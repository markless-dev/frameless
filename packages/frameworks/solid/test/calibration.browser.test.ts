import { onCleanup } from 'solid-js';
import { describe, expect, test } from 'vitest';
import {
	calibrationScenarios,
	compareRuns,
	mutantClasses,
	runScenario,
	scenarioById,
} from '@frameless/analyzer';
import { createSolidAdapter } from '@frameless/solid/adapter';
import { makeSolidS2, makeSolidS3, solidReferences } from './reference.solid.tsx';

// Mutants are COMPONENT VARIANTS (the calibrated mechanism): the mutant component's
// own behavior must produce the divergence. External DOM surgery is forbidden — it
// tests the framework's tolerance of vandalism, not the analyzer's sensitivity.
const mutantComponents: Record<string, unknown> = {
	'wrong-text': makeSolidS2('wrong-text'),
	'wrong-live-property': makeSolidS3('wrong-property'),
	'omitted-callback': makeSolidS3('omit-callback'),
	'reordered-callback': makeSolidS3('reorder-callback'),
	'broken-key-identity': makeSolidS2('index-key'),
	'wrong-cancellation': makeSolidS3('missing-prevent-default'),
	'duplicate-handler': makeSolidS2('duplicate-handler'),
	timing: makeSolidS3('timing'),
};

describe('Solid handwritten reference calibration', () => {
	for (const scenario of calibrationScenarios) {
		test(`${scenario.id}: reference traces are equal`, async () => {
			const reference = solidReferences[scenario.id.split('/')[0]];
			const first = await runScenario(createSolidAdapter(reference), scenario);
			const second = await runScenario(createSolidAdapter(reference), scenario);
			expect(compareRuns(first, second)).toEqual({ equal: true, divergences: [] });
		});
	}

	for (const mutant of mutantClasses) {
		test(`${mutant.id} is rejected in ${mutant.channel}`, async () => {
			const scenario = scenarioById[mutant.scenario];
			const clean = await runScenario(
				createSolidAdapter(solidReferences[mutant.scenario]),
				scenario,
			);
			const broken = await runScenario(
				createSolidAdapter(mutantComponents[mutant.id] as never),
				scenario,
			);
			const verdict = compareRuns(clean, broken);
			if (verdict.equal) {
				const writes = (run: typeof clean) =>
					run.observations
						.map((o) => {
							const find = (n: any): string | null => {
								if (n.tag === 'output') return n.children?.[0]?.text ?? '';
								for (const c of n.children ?? []) {
									const r = find(c);
									if (r !== null) return r;
								}
								return null;
							};
							return `${o.phase}=${o.dom.map(find).find((x) => x !== null)}`;
						})
						.join(' ');
				console.error(
					`[${mutant.id}] equal! clean: ${writes(clean)} | broken: ${writes(broken)}`,
				);
			}
			expect(verdict.equal).toBe(false);
			if (!verdict.equal) {
				expect(verdict.divergences.some((item) => item.channel === mutant.channel)).toBe(
					true,
				);
			}
		});
	}
});

// ---------------------------------------------------------------------------
// Settle-loop calibration (defect 4). See
// docs/goals/frameless-defects-and-targets-v1/notes/T017-quiescence.md.
//
// The settle loop is itself an instrument, and until now it had no calibration:
// nothing proved it could still go red, and nothing asserted the precondition it
// silently depended on (that requestAnimationFrame is delivered at some rate,
// which no specification provides). These five tests are two-sided. Three of them
// are WITNESSED FAILURES against the pre-repair adapter, recorded in the note:
// "starved 300ms frame cadence" reproduced the verbatim CI error
// `Observable DOM did not quiesce within 500ms`, and both the never-composites
// case and the runaway-guard case hung until the vitest timeout because the loop
// awaited a callback the engine owed it on no schedule.
// ---------------------------------------------------------------------------

/** Replaces the frame clock for the duration of `body`. `'never'` models a headless engine that never composites. */
async function withFrameCadence<T>(cadence: number | 'never', body: () => Promise<T>): Promise<T> {
	const realRequest = globalThis.requestAnimationFrame;
	const realCancel = globalThis.cancelAnimationFrame;
	const pending = new Set<ReturnType<typeof setTimeout>>();
	let handle = 0;
	globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => {
		handle += 1;
		if (cadence !== 'never') {
			pending.add(setTimeout(() => callback(performance.now()), cadence));
		}
		return handle;
	}) as typeof globalThis.requestAnimationFrame;
	globalThis.cancelAnimationFrame = (() => undefined) as typeof globalThis.cancelAnimationFrame;
	try {
		return await body();
	} finally {
		for (const timer of pending) clearTimeout(timer);
		globalThis.requestAnimationFrame = realRequest;
		globalThis.cancelAnimationFrame = realCancel;
	}
}

/**
 * Throttles ONLY the settle loop's own fallback timer (its 50ms tick floor), leaving
 * the churner and the test runner on the real clock. Models a page whose timers are
 * clamped - the one condition under which a tick-bounded loop still needs a wall-clock
 * runaway guard.
 */
async function withThrottledTimers<T>(clampMs: number, body: () => Promise<T>): Promise<T> {
	const realSetTimeout = globalThis.setTimeout;
	globalThis.setTimeout = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) =>
		realSetTimeout(
			handler as never,
			timeout === 50 ? clampMs : timeout,
			...(args as never[]),
		)) as unknown as typeof globalThis.setTimeout;
	try {
		return await body();
	} finally {
		globalThis.setTimeout = realSetTimeout;
	}
}

/** Renders an <output> and then mutates it forever from its own owner scope. Never quiesces. */
function churningComponent(): unknown {
	const element = document.createElement('output');
	let count = 0;
	let timer: ReturnType<typeof setTimeout>;
	const churn = (): void => {
		count += 1;
		element.textContent = String(count);
		timer = setTimeout(churn, 0);
	};
	churn();
	onCleanup(() => clearTimeout(timer));
	return element;
}

function quiescingComponent(): unknown {
	const element = document.createElement('output');
	element.textContent = 'stable';
	return element;
}

async function mounted(component: (props: never) => unknown) {
	const adapter = createSolidAdapter(component as (props: unknown) => unknown);
	const host = document.createElement('div');
	document.body.append(host);
	return { adapter, handle: await adapter.mount(host, {}) };
}

describe('Solid settle-loop calibration', () => {
	test('resolves on a DOM that quiesces', async () => {
		const { adapter, handle } = await mounted(quiescingComponent);
		await expect(adapter.settle(handle)).resolves.toBeUndefined();
		adapter.unmount(handle);
	});

	test('throws on a DOM that never quiesces', async () => {
		const { adapter, handle } = await mounted(churningComponent);
		await expect(adapter.settle(handle)).rejects.toThrow(/did not quiesce within \d+ settle ticks/);
		adapter.unmount(handle);
	});

	test('resolves when the compositor never delivers a frame', async () => {
		const { adapter, handle } = await mounted(quiescingComponent);
		await withFrameCadence('never', async () => {
			await expect(adapter.settle(handle)).resolves.toBeUndefined();
		});
		adapter.unmount(handle);
	});

	test('resolves at a starved 300ms frame cadence', async () => {
		const { adapter, handle } = await mounted(quiescingComponent);
		await withFrameCadence(300, async () => {
			await expect(adapter.settle(handle)).resolves.toBeUndefined();
		});
		adapter.unmount(handle);
	});

	test('the wall-clock runaway guard still fires when ticks themselves are clamped', async () => {
		const { adapter, handle } = await mounted(quiescingComponent);
		await withFrameCadence('never', async () => {
			await withThrottledTimers(1_000, async () => {
				await expect(adapter.settle(handle)).rejects.toThrow(/runaway guard/);
			});
		});
		adapter.unmount(handle);
	});
});
