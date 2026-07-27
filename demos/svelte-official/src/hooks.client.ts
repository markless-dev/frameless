/**
 * The dev-warning sink T002 finding 7 requires of this lane.
 *
 * WHY THIS FILE EXISTS. @async/witness 0.7.0 cannot observe console warnings at
 * all: `PageOutcomeExpectation` exposes `consoleErrors` only, and `PageHandle`
 * has no console accessor. Svelte reports its two most dangerous runtime
 * ownership faults — `ownership_invalid_mutation` and `state_unsafe_mutation` —
 * as `console.warn`, so a demo lane instrumented only through witness would
 * pass while the emitted output was warning on every interaction. T002 gave
 * this task two options: land a sink, or record the limitation in writing. This
 * is the sink. (The written record is in the T004 note, because the sink has
 * real limits of its own, listed at the bottom of this comment.)
 *
 * HOW THE LANE READS IT. The sink cannot throw — nothing in the page would
 * catch it — so it reflects its state onto two attributes on `<html>`, which
 * `demos/svelte-official/scenarios.box.ts` reads back out of `page.content()`
 * through the shared contract's own `measureAttribute`:
 *
 *   data-frameless-dev-sink           'calibrated' | 'uncalibrated:<reason>'
 *   data-frameless-dev-diagnostics    the count, as a decimal string
 *   data-frameless-dev-diagnostic-1st the first message, sanitized
 *
 * INSTRUMENT RULE 2 AND 3, BOTH. A sink that silently failed to install would
 * report nothing and read as clean, which is the exact "enforcement-shaped but
 * not enforcement" fault T003 caught in its own setup file. So installation is
 * *asserted*, not assumed: at install time the sink plants one warn and one
 * error through the patched console and requires each to have been captured
 * exactly once — a double-installed patch fails the count, a non-installed
 * patch fails the capture — and then drains. Only then does it write
 * `calibrated`. The lane asserts that value, so an uninstalled or
 * double-installed sink fails the lane rather than quietly passing it.
 *
 * The two probes deliberately do **not** reach the real console: the error one
 * would otherwise land in witness's own `consoleErrors` ledger and fail the
 * `consoleErrors: 0` expectation the shared contract already asserts.
 *
 * WHY MODULE SCOPE AND NOT `init`. This must be the earliest client code in the
 * document so that warnings raised *during* hydration are captured. Module
 * evaluation of the client hooks happens before `kit.start` mounts the app.
 * Setting the *activation marker* here would be wrong for exactly the same
 * reason it is right for the sink, and it is set in the root layout's
 * `onMount` instead.
 *
 * WHAT THIS SINK STILL CANNOT SEE, stated so it is not mistaken for total
 * coverage: compile-time Svelte warnings (`state_referenced_locally` and
 * friends) go to the dev server's terminal, never to `window.console`. Those
 * are enforced by the `compile()` empty-warning oracle in
 * packages/frameworks/svelte, which is where T003 put them.
 */
const SINK_ATTRIBUTE = 'data-frameless-dev-sink';
const COUNT_ATTRIBUTE = 'data-frameless-dev-diagnostics';
const FIRST_ATTRIBUTE = 'data-frameless-dev-diagnostic-1st';
const INSTALLED_FLAG = '__framelessDevDiagnosticSink';
const WARN_PROBE = 'frameless-sink-calibration-warn';
const ERROR_PROBE = 'frameless-sink-calibration-error';

type Diagnostic = { level: 'warn' | 'error'; text: string };

/** One line, no quotes, no angle brackets: this ends up inside an attribute. */
function sanitize(text: string): string {
	return text
		.replace(/[\r\n\t]+/g, ' ')
		.replace(/["<>]/g, '')
		.replace(/\s+/g, ' ')
		.trim()
		.slice(0, 200);
}

function install(): void {
	const global = globalThis as Record<string, unknown>;
	if (global[INSTALLED_FLAG] === true) return;
	global[INSTALLED_FLAG] = true;

	const captured: Diagnostic[] = [];
	let probing = false;

	const reflect = () => {
		const root = document.documentElement;
		root.setAttribute(COUNT_ATTRIBUTE, String(captured.length));
		const first = captured[0];
		if (first) root.setAttribute(FIRST_ATTRIBUTE, sanitize(`${first.level}: ${first.text}`));
		else root.removeAttribute(FIRST_ATTRIBUTE);
	};

	for (const level of ['warn', 'error'] as const) {
		const passThrough = console[level].bind(console);
		console[level] = (...args: unknown[]) => {
			captured.push({
				level,
				text: args.map((arg) => (typeof arg === 'string' ? arg : String(arg))).join(' ')
			});
			// Probe messages stay inside the sink; see the header comment.
			if (probing) return;
			passThrough(...args);
			reflect();
		};
	}

	// Calibration: prove the sink captures, exactly once each, before it is
	// trusted to report zero.
	probing = true;
	console.warn(WARN_PROBE);
	console.error(ERROR_PROBE);
	probing = false;
	const warns = captured.filter(({ text }) => text === WARN_PROBE).length;
	const errors = captured.filter(({ text }) => text === ERROR_PROBE).length;
	const verdict =
		warns === 1 && errors === 1 && captured.length === 2
			? 'calibrated'
			: `uncalibrated:warn=${warns},error=${errors},total=${captured.length}`;
	captured.length = 0;

	document.documentElement.setAttribute(SINK_ATTRIBUTE, verdict);
	reflect();
}

install();

/** SvelteKit's client-hooks entry point. The sink is already installed above. */
export const init = () => {};
