import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { buildEnrichedIr, type EnrichedIR } from '@frameless/compiler';
import { dirname, resolve } from 'pathe';
import { describe, expect, test } from 'vitest';
import { emit } from '../src/emitter/index.ts';

/**
 * STEP 4, EFFECTS (`attach=`) - AND THIS LANE IS THE ONE THAT REFUSES.
 *
 * Svelte, Vue and Angular all gained an `attach=` lowering at Step 4. Qwik did
 * not, and the refusal is a MEASUREMENT rather than an omission or a deferral.
 * This file is where that measurement lives, because a refusal recorded only in a
 * note is a refusal nothing re-checks.
 *
 * `attach=` obliges the emitter to run application code against a MOUNTED DOM
 * NODE. At `@qwik.dev/core@2.0.0-beta.38`:
 *
 *   1. The `ref` prop - BOTH arms of
 *      `Ref<EL> = Signal<Element | undefined> | RefFnInterface<EL>` - is applied
 *      by `applyRef`, whose only two call sites are in the CLIENT vnode diff.
 *      `dist/server.mjs` contains ZERO occurrences of it. So for markup this
 *      container server-rendered and RESUMED - the only mode this lane ships - a
 *      `ref` callback never runs. Both halves are asserted below against the
 *      resolved package.
 *   2. `useTask$` runs before render and has no DOM on the server.
 *   3. The construct that DOES run against a mounted node is the visible-
 *      lifecycle family, which this lane bans in `emit` AND in its gate policy
 *      `no-visible-task`, on the activation-neutrality doctrine that the emitted
 *      component "must do no client work merely because the element became
 *      visible".
 *
 * So Qwik has no `attach=` idiom inside its design envelope. The owner's standing
 * rule is that a framework is not tested outside its envelope and that such
 * output is not read as a defect, so the construct is refused BY NAME with the
 * reason attached, rather than lowered onto a form the lane already forbids.
 */
async function ir(source: string): Promise<EnrichedIR> {
	return buildEnrichedIr({ filename: 'src/attach-probe.tsrx', source });
}

const TRACKED = `import { state } from "@markless/core";
export function Page() @{
	let value = state("a");
	<div data-scenario="attach" attach={(node) => { node.dataset.value = value; return () => { delete node.dataset.value; }; }}>{value}</div>
}`;

const qwikRoot = dirname(createRequire(import.meta.url).resolve('@qwik.dev/core/package.json'));

function distFile(name: string): string {
	return readFileSync(resolve(qwikRoot, 'dist', name), 'utf8');
}

describe('Qwik attach behaviors', () => {
	test('refuses the construct by name, with the reason in the message', async () => {
		const value = await ir(TRACKED);
		expect(value.records.behaviors).toHaveLength(1);
		expect(() => emit(value)).toThrow(/does not support element attach behaviors/);
		// The message has to carry the REASON, not just the refusal: a bare "not
		// supported" reads as unfinished work, and this is a lane limit.
		expect(() => emit(value)).toThrow(/visible-lifecycle family/);
		expect(() => emit(value)).toThrow(/client vnode diff/);
	});

	/**
	 * THE REFUSAL'S PREMISE, RE-MEASURED ON EVERY RUN rather than quoted from a
	 * note. If a future Qwik makes `ref` reachable from the server renderer, this
	 * row goes red and the refusal is re-opened by a failing test rather than by an
	 * auditor happening to look.
	 */
	test('MEASURED: applyRef exists only in the client bundle, never in the server one', () => {
		const core = distFile('core.mjs');
		const server = distFile('server.mjs');
		expect(core).toContain('function applyRef(');
		// Two call sites, both inside the client vnode diff.
		expect(core.match(/applyRef\(/g)?.length).toBe(3);
		expect(server).not.toContain('applyRef');
		// And the type that makes the callback arm look available in the first place.
		expect(distFile('core-internal.d.ts')).toContain(
			'Ref<EL extends Element = Element> = Signal<Element | undefined> | RefFnInterface<EL>',
		);
	});

	test('MEASURED: the emitter still bans the one construct that would work', async () => {
		const source = readFileSync(
			resolve(dirname(new URL(import.meta.url).pathname), '../src/emitter/index.ts'),
			'utf8',
		);
		expect(source).toContain('Qwik emission introduced a forbidden visible task');
		const gate = readFileSync(
			resolve(dirname(new URL(import.meta.url).pathname), '../src/gate/index.ts'),
			'utf8',
		);
		expect(gate).toContain('no-visible-task');
		// The emitted corpus carries no visible lifecycle marker, which is what makes
		// the ban a standing fact rather than an aspiration.
		expect(emit(await ir('export function Page() @{ <div data-x="1" /> }'))).not.toMatch(
			/useVisibleTask\$|onQVisible\$|q-e:qvisible/,
		);
	});
});
