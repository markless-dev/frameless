import { afterEach } from 'vitest';

/**
 * THE SOLE ENFORCEMENT POINT FOR VUE DEV WARNINGS IN THIS PACKAGE.
 *
 * It matters more for Vue than for any lane that came before it. Vue does NOT
 * fail on a hydration mismatch: it reports `Hydration text mismatch` /
 * `Hydration node mismatch` through `console.warn` and then PATCHES THE DOM TO
 * MATCH THE CLIENT. A Vue lane with nothing watching that channel can therefore
 * be green while hydration is genuinely mismatching, which is the one thing this
 * board's oracle cannot afford. `test/emitted-smoke.browser.test.ts` plants a
 * real mismatch against a real emitted component and watches it arrive here.
 *
 * The bar is ANY warning or error, with NO ALLOWLIST. An allowlist is a hole, and
 * a dev-only warning that is expected is exactly the class of thing this lane
 * exists to stop.
 *
 * `app.config.warnHandler` is deliberately NEVER set anywhere in this package.
 * It intercepts Vue's own `warn()` channel and SUPPRESSES the console output, so
 * installing one would turn this sink into a green vacuum - reading zero while
 * hydration mismatched. That is a T003 stop_if and a standing T004 trap.
 */
export type ConsoleDiagnostic = { readonly level: 'warn' | 'error'; readonly text: string };

type ConsoleSink = { readonly captured: ConsoleDiagnostic[]; patched: boolean };

/**
 * The sink lives on `globalThis`, and that is load-bearing rather than
 * incidental.
 *
 * Vitest evaluates a `setupFiles` module in a DIFFERENT module instance from the
 * one a test file gets when it imports the same path. The Svelte lane MEASURED
 * that the hard way: its first version kept `captured` in module scope and ended
 * up with two independent arrays and two chained `console` patches, recording
 * every diagnostic twice while a test that drained one sink left the `afterEach`
 * guard reading the other. The single-patch calibration in
 * `emitted-smoke.browser.test.ts` is what asserts this rather than assuming it.
 */
const host = globalThis as unknown as { __framelessVueConsoleSink__?: ConsoleSink };
const sink: ConsoleSink = (host.__framelessVueConsoleSink__ ??= {
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
		`Vue emitted ${diagnostics.length} console diagnostic(s); a dev-only warning is a FAILURE here, not noise:\n${diagnostics
			.map((entry) => `  [${entry.level}] ${entry.text}`)
			.join('\n')}`,
	);
}

afterEach(() => {
	document.body.replaceChildren();
	assertNoConsoleDiagnostics();
});
