import { type Component, createApp, createSSRApp, h, nextTick, version } from 'vue';
import { describe, expect, test } from 'vitest';
import { assertNoConsoleDiagnostics, takeConsoleDiagnostics } from './setup.ts';

/** Injected by `vitest.config.ts`, which resolves both packages at config time. */
declare const __FRAMELESS_VUE_VERSIONS__: {
	readonly vue: string;
	readonly compilerSfc: string;
};

type Trace = Array<[string, Record<string, unknown>]>;

/**
 * The corpus is DISCOVERED rather than named by three static imports, so a fourth
 * emitted component cannot appear without this lane noticing. A static import
 * list would silently keep passing while covering two thirds of the corpus.
 */
const modules = import.meta.glob('../generated/*.vue', { eager: true }) as Record<
	string,
	{ readonly default: Component }
>;

function component(name: string): Component {
	const found = modules[`../generated/${name}.vue`];
	if (!found) throw new Error(`emitted ${name}.vue is not in the discovered corpus`);
	return found.default;
}

/**
 * WAIT UNTIL THE MILLISECOND CLOCK HAS MOVED PAST THE LISTENERS' ATTACH TIME.
 *
 * This is a MEASURED property of Vue, not a flake mitigation, and it is the
 * single most surprising thing this lane found. `createInvoker` in the resolved
 * `@vue/runtime-dom@3.5.40`
 * (`dist/runtime-dom.esm-bundler.js:739-741`, `:777`) reads:
 *
 *     if (!e._vts) { e._vts = Date.now(); }
 *     else if (e._vts <= invoker.attached) { return; }
 *     ...
 *     invoker.attached = getNow();          // getNow() === Date.now(), per tick
 *
 * So the FIRST Vue handler an event reaches stamps it with `Date.now()`, and
 * every Vue handler after that - which means every ANCESTOR handler - is skipped
 * unless that stamp is strictly greater than its own attach time. A click
 * dispatched in the same millisecond as `mount()` therefore runs the innermost
 * emitted handler and silently drops the form's.
 *
 * That is exactly what happened on the first run of M2 here: the button's
 * `submit` trace appeared, the form's `bubble` trace did not, and a plain
 * `addEventListener` on the same form saw the click perfectly well. Under
 * instrument rule 1 that is evidence the TEST was unfair rather than that the
 * emitted output was wrong - a real user clicks milliseconds after mount, and
 * `pnpm e2e` clicks seconds after hydration. The harness moves the clock instead
 * of the emitter moving its output, and `M2 CALIBRATION` below pins the mechanism
 * deterministically so this is a recorded measurement and not a superstition.
 */
async function advanceAttachClock(): Promise<void> {
	const attached = Date.now();
	while (Date.now() <= attached) await new Promise((resolve) => setTimeout(resolve, 1));
}

async function mountEmitted(
	name: string,
	props: Record<string, unknown>,
): Promise<{ host: HTMLElement; app: ReturnType<typeof createApp>; trace: Trace }> {
	const host = document.createElement('div');
	document.body.append(host);
	const trace: Trace = [];
	const app = createApp(component(name), {
		...props,
		onTrace: (event: string, detail: Record<string, unknown>) => trace.push([event, detail]),
	});
	app.mount(host);
	await advanceAttachClock();
	return { host, app, trace };
}

async function click(host: HTMLElement, selector: string): Promise<void> {
	const element = host.querySelector<HTMLElement>(selector);
	if (!element) throw new Error(`no element matched ${selector}`);
	element.click();
	await nextTick();
}

async function type(host: HTMLElement, selector: string, value: string): Promise<void> {
	const element = host.querySelector<HTMLInputElement>(selector);
	if (!element) throw new Error(`no element matched ${selector}`);
	element.value = value;
	element.dispatchEvent(new Event('input', { bubbles: true }));
	await nextTick();
}

async function toggle(host: HTMLElement, selector: string, checked: boolean): Promise<void> {
	const element = host.querySelector<HTMLInputElement>(selector);
	if (!element) throw new Error(`no element matched ${selector}`);
	element.checked = checked;
	element.dispatchEvent(new Event('change', { bubbles: true }));
	await nextTick();
}

describe('preconditions', () => {
	// Instrument rule 2. A lane that silently covered a stale or partial corpus,
	// or that compiled the components with dev diagnostics stripped, would report
	// green while enforcing nothing.
	test('discovers exactly the three emitted scenario components', () => {
		expect(Object.keys(modules).sort()).toEqual([
			'../generated/S1.vue',
			'../generated/S2.vue',
			'../generated/S3.vue',
		]);
	});

	test('runs the emitted components in DEV mode, where Vue diagnostics exist at all', () => {
		expect(import.meta.env.DEV).toBe(true);
	});

	/**
	 * M4 - VERSION IDENTITY, asserted AT TEST TIME rather than at install time.
	 *
	 * `test/compile-emitted.test.ts` runs `@vue/compiler-sfc` in node and this file
	 * runs `vue`'s runtime in a real browser. If those resolve to different builds
	 * the compile oracle is measuring something the browser never runs, and Gate 1
	 * of `docs/emitter-idiom-policy.md` names that a FAIL outright: "the
	 * measurement was taken against a different build than the one this repo
	 * ships". Both versions are resolved by `vitest.config.ts` and injected, so
	 * this compares three independently-obtained values rather than a hand-updated
	 * literal.
	 */
	test('M4: vue and @vue/compiler-sfc resolve to the same version', () => {
		expect(__FRAMELESS_VUE_VERSIONS__.vue).toBe(__FRAMELESS_VUE_VERSIONS__.compilerSfc);
		// ...and the version the BROWSER is running is that same one, which is the
		// half a package.json comparison alone cannot make.
		expect(version).toBe(__FRAMELESS_VUE_VERSIONS__.vue);
		expect(version).toMatch(/^3\.\d+\.\d+/);
	});
});

/**
 * CALIBRATION of the console sink, in three steps, because "no warnings were
 * observed" is worth nothing unless the observer is known to observe, the
 * assertion is known to throw, and Vue's own diagnostics are known to travel the
 * path being watched.
 */
describe('CALIBRATION: the dev-warning lane goes red', () => {
	test('the sink captures a planted warning and a planted error', () => {
		console.warn('planted warning');
		console.error('planted error');
		const captured = takeConsoleDiagnostics();
		// EXACTLY these two, in order. The length is the assertion that catches a
		// double-installed patch: `setupFiles` and this file are different module
		// instances of setup.ts, so a sink held in module scope would be patched
		// twice and record every diagnostic twice.
		expect(captured).toEqual([
			{ level: 'warn', text: 'planted warning' },
			{ level: 'error', text: 'planted error' },
		]);
		// Drained, so the afterEach guard sees a clean sink and this test passes.
		// This also proves the guard reads the SAME sink this test drains.
		expect(takeConsoleDiagnostics()).toEqual([]);
	});

	test('the guard every test runs actually throws on a non-empty sink', () => {
		console.warn('planted warning');
		// The SAME function the afterEach hook calls, not a lookalike.
		expect(() => assertNoConsoleDiagnostics()).toThrow(/a dev-only warning is a FAILURE here/);
		// It drains as it throws, so the failure cannot cascade into later tests.
		expect(takeConsoleDiagnostics()).toEqual([]);
	});

	/**
	 * THE ROW THAT DISCHARGES T002'S DISSENT.
	 *
	 * T002 recorded as NOT VERIFIED "that Vue 3.5.40's hydration-mismatch message
	 * reaches `window.console` rather than an internal `warn()` that
	 * `warnHandler` could swallow", and said to look here first if a T004 lane is
	 * ever green on a planted mismatch. This plants one, on a REAL emitted
	 * component, and watches it arrive in the sink.
	 *
	 * TWO-SIDED, which is the whole point: the matching container hydrates in
	 * SILENCE and the mismatched one warns. A one-sided version would pass equally
	 * well if `createSSRApp` had quietly fallen back to a full client render.
	 */
	test('a REAL Vue hydration mismatch reaches the sink, from the real emitted component', async () => {
		const props = { label: 'kit', multiplier: 2, visible: true, onTrace: () => {} };
		const rendered = document.createElement('div');
		createApp(component('S1'), props).mount(rendered);
		const html = rendered.innerHTML;
		expect(html).toContain('kit:2');
		takeConsoleDiagnostics();

		const matching = document.createElement('div');
		document.body.append(matching);
		matching.innerHTML = html;
		createSSRApp(component('S1'), props).mount(matching);
		await nextTick();
		expect(takeConsoleDiagnostics(), 'a MATCHING container must hydrate silently').toEqual([]);

		const mismatched = document.createElement('div');
		document.body.append(mismatched);
		mismatched.innerHTML = html.replace('kit:2', 'kit:999');
		createSSRApp(component('S1'), props).mount(mismatched);
		await nextTick();
		const captured = takeConsoleDiagnostics();
		// MEASURED at 3.5.40, and recorded verbatim because T002 could only guess at
		// it: a text mismatch produces TWO diagnostics on `window.console`, a
		// `console.warn` naming the node and both values, and a `console.error`
		// summary. Both are ordinary console calls, so a sink that patches console
		// sees them - and an `app.config.warnHandler` would swallow the first.
		expect(captured.map((entry) => entry.level)).toEqual(['warn', 'error']);
		expect(captured[0]!.text).toContain('[Vue warn]: Hydration text content mismatch');
		expect(captured[0]!.text).toContain('rendered on server: kit:999');
		expect(captured[0]!.text).toContain('expected on client: kit:2');
		expect(captured[1]!.text).toContain('Hydration completed but contains mismatches.');
		// Vue PATCHES THE DOM TO MATCH THE CLIENT rather than failing, which is
		// exactly why the warning channel has to be watched: the visible result of a
		// genuine mismatch is a correct-looking page.
		expect(mismatched.textContent).toContain('kit:2');
	});
});

describe('emitted Vue components behave', () => {
	test('S1 renders the computed value and recomputes after a click', async () => {
		const { host, trace } = await mountEmitted('S1', {
			label: 'kit',
			multiplier: 2,
			visible: true,
		});
		expect(host.querySelector('[data-value="derived"]')!.textContent).toBe('kit:2');
		await click(host, '[data-action="increment"]');
		expect(host.querySelector('[data-value="derived"]')!.textContent).toBe('kit:4');
		// The once-per-instance local ran exactly once. In Vue that needs no
		// lowering - `<script setup>` IS the setup body and runs once per instance -
		// which is the claim this row turns into a check.
		expect(trace).toEqual([
			['setup', { runs: 1 }],
			['change', { count: 2 }],
		]);
	});

	test('S1 takes the other branch when the guard prop is false', async () => {
		const { host } = await mountEmitted('S1', { label: 'kit', multiplier: 2, visible: false });
		expect(host.querySelector('[data-branch="hidden"]')).not.toBeNull();
		expect(host.querySelector('[data-scenario="s1"]')).toBeNull();
	});

	test('S2 keeps keyed rows identified across edit, toggle, remove and reorder', async () => {
		const { host, trace } = await mountEmitted('S2', {
			seed: [
				{ id: 'a', title: 'Alpha', done: false },
				{ id: 'b', title: 'Beta', done: true },
			],
		});
		expect(host.querySelector('[data-count="complete"]')!.textContent).toBe('1/2');

		const rowB = host.querySelector('[data-oracle-row-key="b"]');
		const inputB = host.querySelector<HTMLInputElement>('[data-edit="b"]')!;
		await type(host, '[data-edit="b"]', 'Beta!');
		// The keyed v-for reused the row and the input node rather than rebuilding
		// them - the property `v-bind:key="todo.id"` exists to provide.
		expect(host.querySelector('[data-oracle-row-key="b"]')).toBe(rowB);
		expect(host.querySelector('[data-edit="b"]')).toBe(inputB);
		expect(inputB.value).toBe('Beta!');

		await type(host, '[data-action="new"]', 'Gamma');
		await click(host, '[data-action="add"]');
		await toggle(host, '[data-toggle="a"]', true);
		await click(host, '[data-remove="a"]');
		await click(host, '[data-action="reorder"]');

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

	test('S2 renders the empty branch once every row is cleared', async () => {
		const { host } = await mountEmitted('S2', { seed: [{ id: 'a', title: 'A', done: false }] });
		expect(host.querySelector('[data-empty="true"]')).toBeNull();
		await click(host, '[data-action="clear"]');
		expect(host.querySelector('[data-empty="true"]')).not.toBeNull();
		expect(host.querySelector('[data-count="complete"]')!.textContent).toBe('0/0');
	});

	test('S3 reflects text and checkbox input back through emitted state', async () => {
		const { host, trace } = await mountEmitted('S3', { initial: 'hello' });
		expect(host.querySelector<HTMLInputElement>('[data-action="text"]')!.value).toBe('hello');
		await type(host, '[data-action="text"]', 'typed');
		await toggle(host, '[data-action="checked"]', true);
		expect(trace).toEqual([
			['text', { value: 'typed' }],
			['checked', { checked: true }],
		]);
	});
});

/**
 * M1 - WHITESPACE, in the live DOM.
 *
 * Vue's SFC compiler defaults to `whitespace: 'condense'`, a DIFFERENT rule from
 * Svelte's, so `frameless-svelte-v1` T003 measurement 3 and its
 * newline-inside-the-closing-tag idiom DO NOT carry over and were re-measured
 * from scratch. The full two-arm compiler measurement - the naive layout renders
 * `1 /2` and ` increment `, the emitted layout renders `1/2` and `increment` -
 * lives in `test/compile-emitted.test.ts`, where `@vue/compiler-sfc` and
 * `vue/server-renderer` are both available. THIS is the other half: that the
 * bytes actually reaching a browser DOM carry the same answer.
 */
describe('M1: emitted whitespace survives condense in the live DOM', () => {
	test('the observations the e2e matrix compares are exact, with no stray space', async () => {
		const { host: s1 } = await mountEmitted('S1', { label: 'kit', multiplier: 2, visible: true });
		// THE OBSERVABLE AT RISK. The e2e contract reads these with a trimming
		// comparison, so a leading or trailing space would pass there - `1 /2` is
		// the one that would not, and it is the one Vue's condense produces from a
		// newline between an interpolation and adjacent text.
		expect(s1.querySelector('[data-value="derived"]')!.textContent).toBe('kit:2');
		expect(s1.querySelector('[data-action="increment"]')!.textContent).toBe('increment');

		const { host: s2 } = await mountEmitted('S2', {
			seed: [
				{ id: 'a', title: 'Alpha', done: false },
				{ id: 'b', title: 'Beta', done: true },
			],
		});
		const complete = s2.querySelector('[data-count="complete"]')!;
		expect(complete.textContent).toBe('1/2');
		expect(s2.querySelector('[data-action="add"]')!.textContent).toBe('add');

		// MEASURED, and worth stating because it changes what a negative control
		// here can look like: Vue compiles `{{ complete }}/{{ todos.length }}` into
		// ONE text node via `toDisplayString(a) + "/" + toDisplayString(b)`, so
		// there is no seam between the interpolation and the `/` to insert into.
		// Condense's damage arrives INSIDE that single node, which is why the
		// two-arm compiler measurement lives in `test/compile-emitted.test.ts`.
		expect(complete.childNodes).toHaveLength(1);

		// NEGATIVE CONTROL for the reader, not for the compiler: a `toBe('1/2')`
		// that has only ever been shown to pass is not evidence it can fail. One
		// whitespace text node - exactly what condense leaves behind when it does
		// not remove one - and the same read reports it.
		complete.append(document.createTextNode(' '));
		expect(complete.textContent).toBe('1/2 ');
	});
});

/**
 * M2 - BUBBLING.
 *
 * S3's emitted output puts `v-on:click` on the `<form>` itself, reading
 * `event.target.dataset.action === 'submit'`, so the corpus DEPENDS on a click
 * bubbling from `[data-action="submit"]` up to the form. Vue attaches a real
 * listener at the element - unlike Svelte 5, which delegates click to the root
 * and simulates propagation - so this is PREDICTED native. Instrument rule 1
 * still requires it to be run, with the product variable varied.
 */
describe('M2: the form observes the click BUBBLED from the button', () => {
	test('the ORDERED trace is button-handler-first, then the form handler', async () => {
		const { host, trace } = await mountEmitted('S3', { initial: 'hello' });
		await click(host, '[data-action="submit"]');
		expect(trace).toEqual([
			['submit', { text: 'hello', checked: false, writes: 2 }],
			['bubble', { source: 'form' }],
		]);
		expect(host.querySelector('[data-writes="true"]')!.textContent).toBe('2');
	});

	test('two-variable triangulation: the form handler tracks the TARGET, not the click', async () => {
		// Same form, same listener, a different descendant. `cancel-submit` also
		// bubbles to the form - so if `bubble` appeared here too, the ordered trace
		// above would be measuring "the form handler always fires" rather than "the
		// form handler saw this target".
		const { host, trace } = await mountEmitted('S3', { initial: 'hello' });
		await click(host, '[data-action="cancel-submit"]');
		expect(trace).toEqual([]);

		// And the click really did reach the form: an independent listener on the
		// form element records it. Without this row, an empty trace is equally
		// consistent with the event never bubbling at all.
		const form = host.querySelector('form')!;
		const seen: string[] = [];
		form.addEventListener('click', (event) => {
			seen.push(String((event.target as HTMLElement).dataset.action));
		});
		await click(host, '[data-action="cancel-submit"]');
		expect(seen).toEqual(['cancel-submit']);
	});

	/**
	 * M2 CALIBRATION - the harness assumption `advanceAttachClock()` rests on,
	 * asserted rather than believed (instrument rule 2), and asserted
	 * DETERMINISTICALLY rather than by racing the millisecond clock.
	 *
	 * `_vts` is stamped by whichever Vue invoker sees the event first and then
	 * compared against every later invoker's `attached`. Setting it here fixes both
	 * sides of that comparison, so the two cells below are decided by the guard and
	 * by nothing else. Without this row, `advanceAttachClock()` would be an
	 * unexplained sleep, which is how a harness workaround turns into folklore.
	 */
	test('CALIBRATION: Vue drops handlers for an event not newer than their attach time', async () => {
		const host = document.createElement('div');
		document.body.append(host);
		const seen: string[] = [];
		createApp({
			render: () =>
				h('div', { 'data-probe': 'parent', onClick: () => seen.push('parent') }, [
					h('button', { 'data-probe': 'child', onClick: () => seen.push('child') }, 'x'),
				]),
		}).mount(host);
		await advanceAttachClock();
		const child = host.querySelector<HTMLElement>('[data-probe="child"]')!;

		const stale = new MouseEvent('click', { bubbles: true });
		(stale as unknown as { _vts: number })._vts = 1;
		child.dispatchEvent(stale);
		await nextTick();
		expect(seen, 'an event stamped before attach reaches NO Vue handler').toEqual([]);

		const fresh = new MouseEvent('click', { bubbles: true });
		(fresh as unknown as { _vts: number })._vts = Date.now() + 1000;
		child.dispatchEvent(fresh);
		await nextTick();
		expect(seen, 'an event stamped after attach reaches both, innermost first').toEqual([
			'child',
			'parent',
		]);
	});
});

/**
 * M3 - PREVENTDEFAULT, as a plain in-body `event.preventDefault()` inside a
 * `v-on:click` on a real `<button type="submit">`.
 *
 * This is the property the emission form was chosen on, and
 * `docs/emitter-idiom-policy.md` Gate 1 records FAIL for documentary-only
 * evidence once the framework is in the lockfile - which this package is what
 * does. Two-variable triangulation: the PRODUCT variable is the presence of the
 * call, and the signal has to track it while being insensitive to how the handler
 * was attached.
 */
describe('M3: an in-body preventDefault averts the real form submission', () => {
	/**
	 * Stand-in for the Document-request count `assertS3` uses in `pnpm e2e`. If the
	 * emitted `preventDefault()` fails, the click's default action fires the form's
	 * `submit` event; this capturing listener records it AND cancels it, so the
	 * lane observes the failure instead of navigating away and destroying the test
	 * context. If `preventDefault()` works, no `submit` event exists at all.
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

	/** A form whose submit button carries a Vue `v-on:click` handler, or does not. */
	function mountProbeForm(handler: ((event: MouseEvent) => void) | null): HTMLElement {
		const host = document.createElement('div');
		document.body.append(host);
		createApp({
			render: () =>
				h('form', { 'data-probe': 'm3' }, [
					h(
						'button',
						{
							type: 'submit',
							'data-probe-action': 'go',
							...(handler ? { onClick: handler } : {}),
						},
						'go',
					),
				]),
		}).mount(host);
		return host;
	}

	test('EMITTED: clicking the emitted <button type="submit"> issues no submission', async () => {
		const { host } = await mountEmitted('S3', { initial: 'hello' });
		const { submits, stop } = observeSubmits();
		try {
			expect(host.querySelector('[data-action="cancel-submit"]')!.getAttribute('type')).toBe(
				'submit',
			);
			await click(host, '[data-action="cancel-submit"]');
			expect(submits).toHaveLength(0);
		} finally {
			stop();
		}
	});

	test('CALIBRATION: the submit observer sees a submission nothing cancels', async () => {
		// Instrument rule 4 - plant a member of the set the observer claims to find.
		// Without this, the row above would pass just as happily if the observer
		// were wired to an event that never fires.
		const { host } = await mountEmitted('S3', { initial: 'hello' });
		const { submits, stop } = observeSubmits();
		try {
			const control = document.createElement('button');
			control.type = 'submit';
			control.dataset.control = 'bare';
			host.querySelector('form')!.append(control);
			control.click();
			await nextTick();
			expect(submits).toHaveLength(1);
		} finally {
			stop();
		}
	});

	test('TRIANGULATION: the signal tracks the CALL, not the emission form', async () => {
		const { submits, stop } = observeSubmits();
		try {
			// Cell 1 - Vue's own `onClick` prop, which is exactly what `v-on:click`
			// compiles to, with the call ABSENT.
			const absent = mountProbeForm(() => {});
			await click(absent, '[data-probe-action="go"]');
			expect(submits, 'call absent must submit').toHaveLength(1);

			// Cell 2 - the same attachment, the same element, the call PRESENT.
			const present = mountProbeForm((event) => {
				event.preventDefault();
			});
			await click(present, '[data-probe-action="go"]');
			expect(submits, 'call present must not add a submission').toHaveLength(1);
		} finally {
			stop();
		}
	});
});
