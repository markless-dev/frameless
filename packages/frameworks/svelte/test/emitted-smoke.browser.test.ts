import { flushSync, mount, unmount } from 'svelte';
import { describe, expect, test } from 'vitest';
import { assertNoConsoleDiagnostics, takeConsoleDiagnostics } from './setup.ts';

type MountableComponent = Parameters<typeof mount>[0];
type Trace = Array<[string, Record<string, unknown>]>;

/**
 * The corpus is DISCOVERED rather than named by three static imports, so a
 * fourth emitted component cannot appear without this lane noticing. A static
 * import list would silently keep passing while covering two thirds of the
 * corpus.
 *
 * `eager: true` is load-bearing beyond convenience: every match is compiled by
 * the real Svelte plugin at module-import time, so a component that does not
 * compile fails this FILE rather than an assertion inside it.
 */
const modules = import.meta.glob('../generated/*.svelte', { eager: true }) as Record<
	string,
	{ readonly default: MountableComponent }
>;

/**
 * THE EXPECTED INVENTORY IS DERIVED, NOT RE-LITERALLED - and in a BROWSER lane,
 * where `node:fs` does not exist, so the derivation is a second `import.meta.glob`
 * rather than a `readdirSync`.
 *
 * The source is the compiler's ratified golden corpus, and it is INDEPENDENT of
 * `../generated`: one is the IR this repo agreed to compile, the other is what
 * the emitter actually wrote. `eager: false` is deliberate - only the KEYS are
 * needed, and Vite resolves those at build time without ever fetching a golden.
 */
const goldenModules = import.meta.glob('../../../compiler/test/goldens/s*.json');

const EXPECTED_MODULES = Object.keys(goldenModules)
	.map((path) => /\/s(\d+)-[\w-]+\.json$/.exec(path)?.[1])
	.filter((digits): digits is string => digits !== undefined)
	.map((digits) => `../generated/S${digits}.svelte`)
	.sort();

function component(name: string): MountableComponent {
	const found = modules[`../generated/${name}.svelte`];
	if (!found) throw new Error(`emitted ${name}.svelte is not in the discovered corpus`);
	return found.default;
}

function mountEmitted(
	name: string,
	props: Record<string, unknown>,
): { host: HTMLElement; instance: ReturnType<typeof mount>; trace: Trace } {
	const host = document.createElement('div');
	document.body.append(host);
	const trace: Trace = [];
	const instance = mount(component(name), {
		target: host,
		props: {
			...props,
			onTrace: (name: string, detail: Record<string, unknown>) => trace.push([name, detail]),
		} as never,
	});
	return { host, instance, trace };
}

function click(host: HTMLElement, selector: string): void {
	const element = host.querySelector<HTMLElement>(selector);
	if (!element) throw new Error(`no element matched ${selector}`);
	element.click();
	flushSync();
}

function type(host: HTMLElement, selector: string, value: string): void {
	const element = host.querySelector<HTMLInputElement>(selector);
	if (!element) throw new Error(`no element matched ${selector}`);
	element.value = value;
	element.dispatchEvent(new Event('input', { bubbles: true }));
	flushSync();
}

function toggle(host: HTMLElement, selector: string, checked: boolean): void {
	const element = host.querySelector<HTMLInputElement>(selector);
	if (!element) throw new Error(`no element matched ${selector}`);
	element.checked = checked;
	element.dispatchEvent(new Event('change', { bubbles: true }));
	flushSync();
}

describe('preconditions', () => {
	// Instrument rule 2. A lane that silently covered a stale or partial corpus,
	// or that compiled the components with dev diagnostics stripped, would report
	// green while enforcing nothing.
	test('discovers exactly the emitted scenario corpus the compiler goldens declare', () => {
		// THE FLOOR, asserted first: if the golden glob resolved to nothing this
		// would compare [] to [] and pass while covering the whole corpus with
		// nothing. Every scenario ratified so far must be in the derivation, and a
		// later scenario widens it with no edit here.
		expect(EXPECTED_MODULES).toEqual(
			expect.arrayContaining([
				'../generated/S1.svelte',
				'../generated/S2.svelte',
				'../generated/S3.svelte',
				'../generated/S4.svelte',
			]),
		);
		expect(Object.keys(modules).sort()).toEqual(EXPECTED_MODULES);
	});

	test('runs the emitted components in DEV mode, where Svelte diagnostics exist at all', () => {
		expect(import.meta.env.DEV).toBe(true);
	});
});

/**
 * CALIBRATION of the console sink, in three steps, because "no warnings were
 * observed" is worth nothing unless the observer is known to observe, the
 * assertion is known to throw, and Svelte's own diagnostics are known to travel
 * the path being watched.
 */
describe('CALIBRATION: the dev-warning lane goes red', () => {
	test('the sink captures a planted warning and a planted error', () => {
		console.warn('planted warning');
		console.error('planted error');
		const captured = takeConsoleDiagnostics();
		// EXACTLY these two, in order. The length is the assertion that catches a
		// double-installed patch: `setupFiles` and this file are different module
		// instances of setup.ts, so a sink held in module scope would be patched
		// twice and record every diagnostic twice. That is not hypothetical - it is
		// what the first version of this lane did, and this row is what caught it.
		expect(captured).toEqual([
			{ level: 'warn', text: 'planted warning' },
			{ level: 'error', text: 'planted error' },
		]);
		// Drained, so the afterEach guard sees a clean sink and this test passes.
		// This also proves the guard reads the SAME sink this test drains; when it
		// did not, this test passed and the afterEach failed immediately after.
		expect(takeConsoleDiagnostics()).toEqual([]);
	});

	test('the guard every test runs actually throws on a non-empty sink', () => {
		console.warn('planted warning');
		// The SAME function the afterEach hook calls, not a lookalike.
		expect(() => assertNoConsoleDiagnostics()).toThrow(/a dev-only warning is a FAILURE here/);
		// It drains as it throws, so the failure cannot cascade into later tests.
		expect(takeConsoleDiagnostics()).toEqual([]);
	});

	test('a REAL Svelte dev warning reaches the sink, from the real emitted component', () => {
		// `lifecycle_double_unmount` - a genuine Svelte 5 diagnostic, provoked
		// through the public API on an emitted component, with no fixture file.
		const { instance } = mountEmitted('S1', {
			label: 'kit',
			multiplier: 2,
			visible: true,
		});
		unmount(instance);
		takeConsoleDiagnostics();
		unmount(instance);
		const captured = takeConsoleDiagnostics();
		expect(captured).toHaveLength(1);
		expect(captured[0]!.level).toBe('warn');
		// The DEV-ONLY message shape. Svelte's production branch logs the bare
		// https://svelte.dev/e/... URL and nothing else, so asserting the
		// `[svelte] <code>` prefix is what proves these components were compiled
		// with dev diagnostics enabled - and therefore that a green run of this
		// lane means something.
		expect(captured[0]!.text).toContain('[svelte] lifecycle_double_unmount');
	});
});

describe('emitted Svelte components behave', () => {
	test('S1 renders the derived value and recomputes after a delegated click', () => {
		const { host, trace } = mountEmitted('S1', {
			label: 'kit',
			multiplier: 2,
			visible: true,
		});
		expect(host.querySelector('[data-value="derived"]')!.textContent).toBe('kit:2');
		click(host, '[data-action="increment"]');
		expect(host.querySelector('[data-value="derived"]')!.textContent).toBe('kit:4');
		// The once-per-instance local ran exactly once, which is what the untrack
		// lowering exists to guarantee.
		expect(trace).toEqual([
			['setup', { runs: 1 }],
			['change', { count: 2 }],
		]);
	});

	test('S1 takes the other branch when the guard prop is false', () => {
		const { host } = mountEmitted('S1', { label: 'kit', multiplier: 2, visible: false });
		expect(host.querySelector('[data-branch="hidden"]')).not.toBeNull();
		expect(host.querySelector('[data-scenario="s1"]')).toBeNull();
	});

	test('S2 keeps keyed rows identified across edit, toggle, remove and reorder', () => {
		const { host, trace } = mountEmitted('S2', {
			seed: [
				{ id: 'a', title: 'Alpha', done: false },
				{ id: 'b', title: 'Beta', done: true },
			],
		});
		expect(host.querySelector('[data-count="complete"]')!.textContent).toBe('1/2');

		const rowB = host.querySelector('[data-oracle-row-key="b"]');
		const inputB = host.querySelector<HTMLInputElement>('[data-edit="b"]')!;
		type(host, '[data-edit="b"]', 'Beta!');
		// The keyed each block reused the row and the input node rather than
		// rebuilding them - the property the `(todo.id)` key exists to provide.
		expect(host.querySelector('[data-oracle-row-key="b"]')).toBe(rowB);
		expect(host.querySelector('[data-edit="b"]')).toBe(inputB);
		expect(inputB.value).toBe('Beta!');

		type(host, '[data-action="new"]', 'Gamma');
		click(host, '[data-action="add"]');
		toggle(host, '[data-toggle="a"]', true);
		click(host, '[data-remove="a"]');
		click(host, '[data-action="reorder"]');

		expect(
			[...host.querySelectorAll('[data-oracle-row-key]')].map((row) =>
				row.getAttribute('data-oracle-row-key'),
			),
		).toEqual(['c3', 'b']);
		expect(host.querySelector('[data-count="complete"]')!.textContent).toBe('1/2');
		expect(trace.map(([name]) => name)).toEqual([
			'edit',
			'add',
			'toggle',
			'remove',
			'reorder',
		]);
	});

	test('S2 renders the empty branch once every row is cleared', () => {
		const { host } = mountEmitted('S2', { seed: [{ id: 'a', title: 'A', done: false }] });
		expect(host.querySelector('[data-empty="true"]')).toBeNull();
		click(host, '[data-action="clear"]');
		expect(host.querySelector('[data-empty="true"]')).not.toBeNull();
		expect(host.querySelector('[data-count="complete"]')!.textContent).toBe('0/0');
	});
});

/**
 * THE TWO DELEGATION MEASUREMENTS, converted from a one-off probe into standing
 * checks.
 *
 * Svelte 5 delegates click/input/change to the root and SIMULATES propagation,
 * so neither of these is safe to assume from documentation - and Gate 1 records
 * FAIL for documentary-only evidence once the framework is in the lockfile.
 */
describe('S3 delegation, the property the emission form was chosen on', () => {
	/**
	 * Stand-in for the Document-request count `assertS3` uses. If the emitted
	 * `preventDefault()` fails, the click's default action fires the form's
	 * `submit` event; this capturing listener records it AND cancels it, so the
	 * lane observes the failure instead of navigating away and destroying the
	 * test context. If `preventDefault()` works, no `submit` event exists at all.
	 */
	function observeSubmits(): { submits: Event[]; stop: () => void } {
		const submits: Event[] = [];
		const listener = (event: Event) => {
			submits.push(event);
			event.preventDefault();
		};
		document.addEventListener('submit', listener, true);
		return { submits, stop: () => document.removeEventListener('submit', listener, true) };
	}

	test('Q1: preventDefault in a DELEGATED handler averts the real form submission', () => {
		const { host } = mountEmitted('S3', { initial: 'hello' });
		const { submits, stop } = observeSubmits();
		try {
			// A real <button type="submit"> inside the emitted <form>.
			expect(
				host.querySelector('[data-action="cancel-submit"]')!.getAttribute('type'),
			).toBe('submit');
			click(host, '[data-action="cancel-submit"]');
			expect(submits).toHaveLength(0);
		} finally {
			stop();
		}
	});

	test('CALIBRATION: the submit observer sees a submission nothing cancels', () => {
		// Instrument rule 4 - plant a member of the set the observer claims to
		// find. Without this, Q1's `toHaveLength(0)` would pass just as happily if
		// the observer were wired to an event that never fires.
		const { host } = mountEmitted('S3', { initial: 'hello' });
		const { submits, stop } = observeSubmits();
		try {
			const control = document.createElement('button');
			control.type = 'submit';
			control.dataset.control = 'bare';
			host.querySelector('form')!.append(control);
			control.click();
			expect(submits).toHaveLength(1);
		} finally {
			stop();
		}
	});

	test('Q2: the form observes the click BUBBLED from the button, in native order', () => {
		const { host, trace } = mountEmitted('S3', { initial: 'hello' });
		click(host, '[data-action="submit"]');
		// The emitted form handler reads `event.target.dataset.action === 'submit'`,
		// so the corpus depends on cross-element bubbling surviving Svelte's
		// simulated propagation - and on the button's handler running FIRST, which
		// is why a mix of onclick= and on() is forbidden.
		expect(trace).toEqual([
			['submit', { text: 'hello', checked: false, writes: 2 }],
			['bubble', { source: 'form' }],
		]);
		expect(host.querySelector('[data-writes="true"]')!.textContent).toBe('2');
	});

	test('S3 reflects text and checkbox input back through emitted state', () => {
		const { host, trace } = mountEmitted('S3', { initial: 'hello' });
		expect(host.querySelector<HTMLInputElement>('[data-action="text"]')!.value).toBe('hello');
		type(host, '[data-action="text"]', 'typed');
		toggle(host, '[data-action="checked"]', true);
		expect(trace).toEqual([
			['text', { value: 'typed' }],
			['checked', { checked: true }],
		]);
	});
});
