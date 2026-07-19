// Minimal CSR mount helper modeled on markless's own
// packages/vitest-browser/src/index.ts (render + cleanup): mounts a compiled
// .tsrx component through @markless/web's public render() and disposes the
// runtime after each test.
import { render, type CsrRenderable, type CsrRenderContainer } from '@markless/web';

type Mounted = {
	readonly container: HTMLElement;
	readonly runtime: CsrRenderContainer;
};

const mounted: Mounted[] = [];

export async function mount(component: CsrRenderable): Promise<HTMLElement> {
	const container = document.createElement('div');
	document.body.appendChild(container);
	const runtime = await render(component, { target: container });
	mounted.push({ container, runtime });
	return container;
}

export function cleanup(): void {
	while (mounted.length > 0) {
		const entry = mounted.pop();
		if (!entry) return;
		(entry.runtime.runtime as { readonly dispose?: () => void }).dispose?.();
		entry.container.replaceChildren();
		entry.container.parentNode?.removeChild(entry.container);
	}
}
