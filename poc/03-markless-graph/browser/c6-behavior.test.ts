// C6 (behavioral): markless 0.1.1 accepts AND preserves the observable CSR
// behavior of the fixture family covering exactly the shapes Mitosis 0.13.2
// mangles (poc/01): component-body locals (C1 mirror), state/local
// name-collision handler shapes (C2 mirror), props destructuring, ordinary
// deep state mutation, and a guard `if (...) return null` before the template
// root. Every fixture is compiled by the real markless vite plugin, mounted in
// headless Chromium through @markless/web render(), and asserted on initial
// DOM plus one state-changing interaction.
import { afterEach, expect, test } from 'vitest';
import { cleanup, mount } from './support/mount.ts';
import LocalApp from '../fixtures/c6a-local.tsrx';
import CollisionApp from '../fixtures/c6b-collision.tsrx';
import PropsApp from '../fixtures/c6c-props.tsrx';
import MutationApp from '../fixtures/c6d-mutation.tsrx';
import GuardPanel from '../fixtures/c6e-guard.tsrx';

afterEach(() => cleanup());

function text(container: HTMLElement, selector: string): string | null {
	return container.querySelector(selector)?.textContent ?? null;
}

function click(container: HTMLElement, selector: string): void {
	const element = container.querySelector<HTMLElement>(selector);
	if (!element) throw new Error(`Expected "${selector}" in the rendered DOM.`);
	element.click();
}

test('C6a (C1 mirror): component-body locals render and survive a state-changing interaction', async () => {
	const container = await mount(LocalApp);

	// Initial render: both body locals were computed and rendered — the exact
	// computation Mitosis silently drops.
	expect(text(container, '[data-greeting]')).toBe('Hello, MARKLESS!');
	expect(text(container, '[data-initial]')).toBe('start:1');
	expect(text(container, '[data-count]')).toBe('1');

	click(container, '[data-inc]');
	await expect.poll(() => text(container, '[data-count]')).toBe('2');

	// Render-once body semantics: the locals' rendered values are preserved,
	// not dropped or recomputed into garbage.
	expect(text(container, '[data-greeting]')).toBe('Hello, MARKLESS!');
	expect(text(container, '[data-initial]')).toBe('start:1');
});

test('C6b (C2 mirror): handler locals named after the state properties they read stay correct', async () => {
	const container = await mount(CollisionApp);

	expect(text(container, '[data-open]')).toBe('closed');
	expect(text(container, '[data-title]')).toBe('menu');

	// The handler runs `const open = menu.open; const title = menu.title;`
	// and writes back through them. Mitosis's rewrite of this class of code
	// emits a TDZ self-reference (poc/01 C2); here the click must observably
	// use the read values.
	click(container, '[data-toggle]');
	await expect.poll(() => text(container, '[data-open]')).toBe('open');
	expect(text(container, '[data-title]')).toBe('MENU');
});

test('C6c: props destructuring in a child component receives live parent state', async () => {
	const container = await mount(PropsApp);

	expect(text(container, '[data-badge]')).toBe('First');
	expect(container.querySelector('[data-badge]')?.getAttribute('data-tone')).toBe('info');

	click(container, '[data-next]');
	await expect.poll(() => text(container, '[data-badge]')).toBe('Second');
});

test('C6d: ordinary deep assignment/mutation of state updates the DOM', async () => {
	const container = await mount(MutationApp);

	expect(text(container, '[data-name]')).toBe('Ada');
	expect(text(container, '[data-hits]')).toBe('0');
	expect(text(container, '[data-tags]')).toBe('1');

	// Nested property assign, nested update expression, in-place array push.
	click(container, '[data-mutate]');
	await expect.poll(() => text(container, '[data-name]')).toBe('Grace');
	expect(text(container, '[data-hits]')).toBe('1');
	expect(text(container, '[data-tags]')).toBe('2');
});

test('C6e: guard `if (hidden) return null` renders nothing when hidden, mounts and interacts when visible', async () => {
	// Hidden: the compiled component contract is renderCsr(props) => null —
	// there is nothing to mount. This is the compiled artifact's observable
	// "render nothing" behavior for the guard path.
	const artifact = GuardPanel as unknown as { renderCsr: (props?: unknown) => unknown };
	expect(artifact.renderCsr({ hidden: true })).toBeNull();

	// Visible: mounts and its own state interaction works.
	const container = await mount({
		renderCsr: () => artifact.renderCsr({ hidden: false }),
	} as never);
	expect(container.querySelector('[data-panel]')).not.toBeNull();
	expect(text(container, '[data-notes]')).toBe('0');

	click(container, '[data-add]');
	await expect.poll(() => text(container, '[data-notes]')).toBe('1');
});
