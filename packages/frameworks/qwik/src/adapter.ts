import { jsx, render, type FunctionComponent } from '@qwik.dev/core';
import type { Action, Adapter } from '@frameless/analyzer';

type QwikHandle = {
	readonly host: HTMLElement;
	readonly rendered: Awaited<ReturnType<typeof render>>;
};

export function createQwikAdapter(component: FunctionComponent<any>): Adapter<QwikHandle> {
	return {
		name: 'qwik-2.0.0-beta.38',
		host: (handle) => handle.host,
		async mount(host, props) {
			return { host, rendered: await render(host, jsx(component, props)) };
		},
		dispatch(handle, action) {
			dispatchDomAction(handle.host, action);
		},
		settle(handle) {
			return boundedQuiescence(handle.host, () => Promise.resolve());
		},
		unmount(handle) {
			handle.rendered.cleanup();
		},
	};
}

function dispatchDomAction(host: HTMLElement, action: Action): void {
	const target = host.querySelector<HTMLElement>(action.target);
	if (!target) throw new Error(`Action target not found: ${action.target}`);
	if (action.type === 'focus') {
		target.focus();
		if (action.selection && target instanceof HTMLInputElement)
			target.setSelectionRange(...action.selection);
		return;
	}
	if (action.type === 'input') {
		const input = target as HTMLInputElement;
		input.value = action.value;
		if (action.selection) input.setSelectionRange(...action.selection);
		input.dispatchEvent(
			new InputEvent('input', { bubbles: true, inputType: 'insertText', data: action.value }),
		);
		return;
	}
	if (action.type === 'check') {
		const input = target as HTMLInputElement;
		input.checked = !action.checked;
		input.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
		return;
	}
	target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
}

// SETTLE LOOP - bounded on TICKS, not on wall clock (defect 4, T017).
//
// The quantity this loop consumes is settle ticks, so ticks are what it bounds. It
// used to bound wall clock instead, over a wait gated entirely on
// requestAnimationFrame. rAF's contract is ORDERING - "before the next repaint" -
// and never a RATE: an engine that never composites owes no repaint and therefore no
// callback on any schedule, so a 500ms budget silently encoded a >4fps floor that no
// specification provides. That failure reproduces on Chromium by slowing frames
// alone, against the unmodified loop; it is witnessed and calibrated in
// test/calibration.browser.test.ts.
//
// A tick is a frame when the compositor delivers one and a macrotask turn
// regardless: the HTML event loop contracts to run a queued task, whereas the frame
// callback is explicitly skippable. Wall clock survives only as a runaway guard, so
// a page whose timers are clamped still fails rather than hanging the suite.
//
// See docs/goals/frameless-defects-and-targets-v1/notes/T017-quiescence.md.
const SETTLE_TICK_BUDGET = 30;
const SETTLE_STABLE_TICKS = 2;
const SETTLE_TICK_FALLBACK_MS = 50;
const SETTLE_RUNAWAY_MS = 2_000;

async function boundedQuiescence(host: HTMLElement, flush: () => Promise<void>): Promise<void> {
	const start = performance.now();
	let previous = '';
	let stable = 0;
	for (let tick = 1; tick <= SETTLE_TICK_BUDGET; tick += 1) {
		await flush();
		await settleTick();
		const current = host.innerHTML;
		stable = current === previous ? stable + 1 : 0;
		previous = current;
		if (stable >= SETTLE_STABLE_TICKS) return;
		const elapsed = performance.now() - start;
		if (elapsed >= SETTLE_RUNAWAY_MS) {
			throw new Error(
				`Observable DOM settle hit the ${SETTLE_RUNAWAY_MS}ms runaway guard after ${tick} tick(s)`,
			);
		}
	}
	throw new Error(`Observable DOM did not quiesce within ${SETTLE_TICK_BUDGET} settle ticks`);
}

// One tick of progress. requestAnimationFrame is RACED, not awaited: it wins on an
// engine that composites, and is simply ignored on one that does not. The timer is
// not a bound - it is the delivery-contracted floor that keeps the loop advancing.
function settleTick(): Promise<void> {
	return new Promise<void>((resolve) => {
		let done = false;
		let timer: ReturnType<typeof setTimeout> | undefined;
		const advance = (): void => {
			if (done) return;
			done = true;
			clearTimeout(timer);
			resolve();
		};
		timer = setTimeout(advance, SETTLE_TICK_FALLBACK_MS);
		requestAnimationFrame(advance);
	});
}
