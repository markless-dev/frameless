import { buildEnrichedIr, type EnrichedIR, type SyncPolicy } from '@frameless/compiler';
import { describe, expect, test } from 'vitest';
import { emit, validateEnrichedIr } from '../src/emitter/index.ts';
import { formatEmitted } from '../src/format-emitted.ts';

/**
 * THE QWIK V-LIMITS - the adapter's fail-closed boundary for conditional
 * cancellation, ruled by T011 §5 of frameless-defects-and-targets-v1.
 *
 * WHY THEY LIVE HERE AND NOT IN @frameless/compiler. The limit is QWIK'S. React
 * and Solid lower a `graph-truthy` guard with no difficulty, because their
 * handlers are synchronous and resident; only Qwik has to split the declared
 * actions into a channel that runs before the container resumes, and a `sync$()`
 * QRL may close over nothing. Encoding that weakness in the shared IR would
 * export it to Svelte, Vue and Angular, none of which have it. The general rule
 * every adapter inherits instead: THE IR DECLARES WHEN AND WHAT; THE ADAPTER
 * DECIDES WHERE, and refuses to emit when its partition is not total for a
 * declared action.
 *
 * Each refusal below ships with a test that watches it FIRE (T007 rule 2: an
 * instrument that establishes a set must be calibrated against a known member).
 * V5 is the exception and says so in its own test.
 */
async function guardedIr(guard: string, body: string): Promise<EnrichedIR> {
	return buildEnrichedIr({
		filename: 'guarded.tsrx',
		source: `import { state } from '@markless/core';

export function Guarded({ onTrace }) @{
	let seen = state(0);

	<form>
		<button
			type="submit"
			data-action="go"
			onClick={(event) => {
				${guard} {
					${body}
					seen = 1;
					onTrace('go');
				}
			}}
		/>
		<output>{seen}</output>
	</form>
}
`,
	});
}

function policyOf(ir: EnrichedIR): SyncPolicy {
	const policy = ir.records.events[0]?.syncPolicy;
	if (!policy) throw new Error('fixture produced no SyncPolicy');
	return policy;
}

function withPolicy(ir: EnrichedIR, policy: unknown): EnrichedIR {
	const mutant = structuredClone(ir) as EnrichedIR;
	(mutant.records.events[0] as { syncPolicy?: unknown }).syncPolicy = policy;
	return mutant;
}

describe('Qwik conditional-cancellation v-limits', () => {
	test('BASELINE: the guarded shape these limits bound does emit', async () => {
		const ir = await guardedIr(`if (event.key === 'Enter')`, 'event.preventDefault();');
		expect(policyOf(ir)).toEqual({
			when: { type: 'event-equals', field: 'key', value: 'Enter' },
			actions: ['preventDefault'],
		});
		const source = await formatEmitted(emit(ir));
		expect(source).toContain("if (event.key === 'Enter') {");
		expect(source).toContain('event.preventDefault();');
		// A refusal test proves nothing if the accepted case does not exist.
		expect(() => validateEnrichedIr(ir)).not.toThrow();
	});

	test('V1 refuses a guard that reads graph state', async () => {
		// Authored as `if (locked) event.preventDefault()`, which Markless extracts
		// as graph-truthy. Qwik cannot lower it: the sync$() body would have to read
		// a signal, and a synchronous QRL closes over nothing.
		const ir = await buildEnrichedIr({
			filename: 'locked.tsrx',
			source: `import { state } from '@markless/core';

export function Locked({ onTrace }) @{
	let locked = state(true);

	<form>
		<button
			type="submit"
			onClick={(event) => {
				if (locked) {
					event.preventDefault();
					onTrace('blocked');
				}
			}}
		/>
		<output>{locked}</output>
	</form>
}
`,
		});
		expect(policyOf(ir)).toEqual({
			when: { type: 'graph-truthy', graphNodeId: 'state:locked', path: [] },
			actions: ['preventDefault'],
		});
		const message =
			'declares a conditional sync action whose guard reads graph state state:locked; Qwik sync$() QRLs cannot close over reactive state';
		expect(() => validateEnrichedIr(ir)).toThrow(message);
		expect(() => emit(ir)).toThrow(message);
	});

	test('V1 reaches inside and/or/not rather than only the root condition', async () => {
		const ir = await guardedIr(`if (event.key === 'Enter')`, 'event.preventDefault();');
		const nested = withPolicy(ir, {
			when: {
				type: 'and',
				conditions: [
					{ type: 'event-equals', field: 'key', value: 'Enter' },
					{
						type: 'not',
						condition: {
							type: 'graph-truthy',
							graphNodeId: 'state:seen',
							path: [],
						},
					},
				],
			},
			actions: ['preventDefault'],
		});
		expect(() => emit(nested)).toThrow('guard reads graph state state:seen');
	});

	test('V2 refuses the multi-handler branches form', async () => {
		const ir = await guardedIr(`if (event.key === 'Enter')`, 'event.preventDefault();');
		const branches = withPolicy(ir, {
			branches: [
				{
					when: { type: 'event-equals', field: 'key', value: 'Enter' },
					actions: ['preventDefault'],
				},
				{
					when: { type: 'constant-truthy', value: true },
					actions: ['stopPropagation'],
				},
			],
		});
		const message =
			'declares a multi-handler sync policy; Qwik emits one QRL array per event prop';
		expect(() => validateEnrichedIr(branches)).toThrow(message);
		expect(() => emit(branches)).toThrow(message);
	});

	test('V3 refuses a statically false guard instead of silently deleting the action', async () => {
		const ir = await guardedIr(`if (event.key === 'Enter')`, 'event.preventDefault();');
		const dead = withPolicy(ir, {
			when: { type: 'constant-truthy', value: false },
			actions: ['preventDefault'],
		});
		const message = 'declares a sync action guarded by a statically false condition';
		expect(() => validateEnrichedIr(dead)).toThrow(message);
		expect(() => emit(dead)).toThrow(message);
	});

	test('V4 refuses a declared action the handler body does not spell', async () => {
		// The guarded position is the point: before T012 the strip-filter looked at
		// TOP-LEVEL statements only, so a nested call was neither removed nor
		// missed - the emitter silently shipped a bare lazy QRL instead.
		const ir = await guardedIr(`if (event.key === 'Enter')`, 'event.preventDefault();');
		const both = withPolicy(ir, {
			when: { type: 'event-equals', field: 'key', value: 'Enter' },
			actions: ['preventDefault', 'stopPropagation'],
		});
		expect(() => emit(both)).toThrow(
			'declares the sync action stopPropagation its handler body does not spell as a event.stopPropagation() call',
		);
	});

	test('V4 locates BOTH actions when both are authored in the guard', async () => {
		const ir = await guardedIr(
			`if (event.key === 'Enter')`,
			'event.preventDefault();\n\t\t\t\t\tevent.stopPropagation();',
		);
		expect(policyOf(ir)).toEqual({
			when: { type: 'event-equals', field: 'key', value: 'Enter' },
			actions: ['preventDefault', 'stopPropagation'],
		});
		const source = await formatEmitted(emit(ir));
		expect(source).toMatch(
			/sync\$\(\(event\) => \{\s*if \(event\.key === 'Enter'\) \{\s*event\.preventDefault\(\);\s*event\.stopPropagation\(\);\s*\}\s*\}\)/,
		);
		// Both authored calls left the lazy remainder; only the rest survives.
		expect(source).not.toMatch(/\$\(async[\s\S]*?preventDefault/);
		expect(source).not.toMatch(/\$\(async[\s\S]*?stopPropagation/);
	});

	/**
	 * NOT IN THE T011 RULING. Found by measurement while T012 pinned the condition
	 * vocabulary, and closed here because it is defect 1's failure mode arriving
	 * through a door V4 does not watch.
	 *
	 * `if (k) { preventDefault() } else { stopPropagation() }` compiles cleanly and
	 * Markless extracts ONLY the consequent's action. The else-branch call is then
	 * an ordinary statement, and before this refusal it was emitted into the lazily
	 * fetched remainder - a stopPropagation that runs after bubbling has finished.
	 */
	test('a sync action stranded outside the declared policy is refused', async () => {
		const ir = await buildEnrichedIr({
			filename: 'stranded.tsrx',
			source: `import { state } from '@markless/core';

export function Stranded({ onTrace }) @{
	let seen = state(0);

	<form>
		<button
			type="submit"
			onClick={(event) => {
				if (event.key === 'Enter') {
					event.preventDefault();
				} else {
					event.stopPropagation();
				}
			}}
		/>
		<output>{seen}</output>
	</form>
}
`,
		});
		// The measurement that motivates the refusal: the else branch is NOT in the
		// policy, so nothing downstream would know the action was ever declared.
		expect(ir.records.events[0]!.syncPolicy).toEqual({
			when: { type: 'event-equals', field: 'key', value: 'Enter' },
			actions: ['preventDefault'],
		});
		expect(() => emit(ir)).toThrow(
			'calls event.stopPropagation() at a position its SyncPolicy does not declare',
		);
	});

	/**
	 * V5 IS THE EMITTER ASSERTING ITS OWN PRECONDITION, not a gate (T007 rule 2).
	 *
	 * T011 §1.2 proves it cannot fire for anything Markless can produce today:
	 * `eventFieldName()` requires the object to BE the event parameter and the
	 * property to be static, so the only event-side vocabulary that can reach an
	 * emitter is one flat field compared to a JSON literal - and a tree of those
	 * synthesizes to something closed by construction.
	 *
	 * A check that cannot fire is exactly the check that catches the day the IR
	 * grows a new condition type, which is the failure mode
	 * packages/compiler/test/unknown-template-node.test.ts exists for. So it gets
	 * a REACHABILITY test rather than a failing mutant: construct the future
	 * condition and prove the refusal is named and greppable.
	 */
	test('V5 refuses a condition type this emitter has never heard of', async () => {
		const ir = await guardedIr(`if (event.key === 'Enter')`, 'event.preventDefault();');
		const future = withPolicy(ir, {
			when: { type: 'FutureSyncCondition', selector: '[data-locked]' },
			actions: ['preventDefault'],
		});
		const message =
			'synthesized sync$ body is not closed: unsupported guard condition "FutureSyncCondition"';
		expect(() => validateEnrichedIr(future)).toThrow(message);
		expect(() => emit(future)).toThrow(message);
	});

	test('V5 refuses a future condition nested inside a guard it does understand', async () => {
		const ir = await guardedIr(`if (event.key === 'Enter')`, 'event.preventDefault();');
		const future = withPolicy(ir, {
			when: {
				type: 'or',
				conditions: [
					{ type: 'event-equals', field: 'key', value: 'Enter' },
					{ type: 'element-matches', selector: '[data-locked]' },
				],
			},
			actions: ['preventDefault'],
		});
		expect(() => emit(future)).toThrow(
			'synthesized sync$ body is not closed: unsupported guard condition "element-matches"',
		);
	});

	test('every refusal names the event and is distinct', async () => {
		const ir = await guardedIr(`if (event.key === 'Enter')`, 'event.preventDefault();');
		const eventId = ir.records.events[0]!.id;
		const messages = [
			withPolicy(ir, {
				when: { type: 'graph-truthy', graphNodeId: 'state:seen', path: [] },
				actions: ['preventDefault'],
			}),
			withPolicy(ir, {
				branches: [
					{
						when: { type: 'constant-truthy', value: true },
						actions: ['preventDefault'],
					},
				],
			}),
			withPolicy(ir, {
				when: { type: 'constant-truthy', value: 0 },
				actions: ['preventDefault'],
			}),
			withPolicy(ir, {
				when: { type: 'event-equals', field: 'key', value: 'Enter' },
				actions: ['stopPropagation'],
			}),
			withPolicy(ir, {
				when: { type: 'FutureSyncCondition' },
				actions: ['preventDefault'],
			}),
		].map((mutant) => {
			try {
				emit(mutant);
			} catch (error) {
				return (error as Error).message;
			}
			throw new Error('a v-limit mutant emitted instead of refusing');
		});
		for (const message of messages) expect(message).toContain(`Qwik event ${eventId}`);
		expect(new Set(messages).size).toBe(messages.length);
	});
});

describe('Qwik unconditional lowering is unmoved by the conditional work', () => {
	test('a constant-truthy true guard synthesizes NO guard', async () => {
		const ir = await guardedIr(`if (event.key === 'Enter')`, 'event.preventDefault();');
		const unconditional = withPolicy(ir, {
			when: { type: 'constant-truthy', value: true },
			actions: ['preventDefault'],
		});
		// The authored call still sits inside the authored `if`; an unconditional
		// policy strips it from wherever it is and emits an UNGUARDED sync$ body -
		// byte-identical to the shape T003 shipped.
		const source = await formatEmitted(emit(unconditional));
		expect(source).toMatch(
			/sync\$\(\(event\) => \{\s*event\.preventDefault\(\);\s*\}\)/,
		);
		expect(source).not.toMatch(/sync\$\(\(event\) => \{\s*if /);
	});

	test('a policy declaring no action is lowered as if there were no policy', async () => {
		const ir = await guardedIr(`if (event.key === 'Enter')`, 'seen = 2;');
		const empty = withPolicy(ir, {
			when: { type: 'event-equals', field: 'key', value: 'Enter' },
			actions: [],
		});
		const source = await formatEmitted(emit(empty));
		expect(source).not.toContain('sync$');
	});
});
