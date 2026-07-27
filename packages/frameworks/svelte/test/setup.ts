import { afterEach } from 'vitest';

/**
 * THE SOLE ENFORCEMENT POINT FOR SVELTE DEV WARNINGS.
 *
 * T002 finding 7: the witness API used by `pnpm e2e` cannot observe console
 * warnings AT ALL - `PageHandle` has no console accessor and
 * `PageOutcomeExpectation` exposes `consoleErrors` only. So the demo lane at
 * T004 cannot enforce the dev-warning constraint, and T999's version of it would
 * pass vacuously because nothing observes them.
 *
 * This lane runs IN the browser and patches `console` directly, so it can. All
 * 42 of Svelte 5.56.8's client dev diagnostics are emitted through
 * `console.warn` (`svelte/src/internal/client/warnings.js`) - including
 * `state_unsafe_mutation` and `ownership_invalid_mutation`, the two named in the
 * board - so warnings are captured, not only errors.
 *
 * The bar is ANY warning or error, with no allowlist. An allowlist is a hole,
 * and a dev-only warning that is expected is exactly the class of thing this
 * lane exists to stop.
 */
export type ConsoleDiagnostic = { readonly level: 'warn' | 'error'; readonly text: string };

type ConsoleSink = { readonly captured: ConsoleDiagnostic[]; patched: boolean };

/**
 * The sink lives on `globalThis`, and that is load-bearing rather than
 * incidental.
 *
 * Vitest evaluates a `setupFiles` module in a DIFFERENT module instance from the
 * one a test file gets when it imports the same path - MEASURED here, not
 * assumed: the first version of this file kept `captured` in module scope, and
 * the result was two independent arrays and two chained `console` patches. Every
 * diagnostic was recorded twice, and a test that drained the sink drained the
 * copy the `afterEach` guard was not reading, so three calibrations failed while
 * the lane still looked like it worked.
 *
 * That is precisely the failure this board keeps finding: an instrument whose
 * silent assumption - "importing my own setup file gives me my own state" - was
 * never asserted. It is asserted now, by the single-patch calibration in
 * `emitted-smoke.browser.test.ts`.
 */
const host = globalThis as unknown as { __framelessSvelteConsoleSink__?: ConsoleSink };
const sink: ConsoleSink = (host.__framelessSvelteConsoleSink__ ??= {
	captured: [],
	patched: false,
});

if (!sink.patched) {
	sink.patched = true;
	for (const level of ['warn', 'error'] as const) {
		const original = console[level].bind(console);
		console[level] = (...args: unknown[]) => {
			sink.captured.push({ level, text: args.map((arg) => String(arg)).join(' ') });
			original(...args);
		};
	}
}

/** Drain the sink. Used by the calibrations, which plant diagnostics on purpose. */
export function takeConsoleDiagnostics(): ConsoleDiagnostic[] {
	return sink.captured.splice(0, sink.captured.length);
}

/**
 * Drains and throws. Factored out of the `afterEach` below so the CALIBRATION can
 * exercise the exact code path that guards every test, rather than a lookalike -
 * an assertion nobody has watched throw is not evidence that it can.
 */
export function assertNoConsoleDiagnostics(): void {
	const diagnostics = takeConsoleDiagnostics();
	if (diagnostics.length === 0) return;
	throw new Error(
		`Svelte emitted ${diagnostics.length} console diagnostic(s); a dev-only warning is a FAILURE here, not noise:\n${diagnostics
			.map((entry) => `  [${entry.level}] ${entry.text}`)
			.join('\n')}`,
	);
}

afterEach(() => {
	document.body.replaceChildren();
	assertNoConsoleDiagnostics();
});
