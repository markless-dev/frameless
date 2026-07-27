/**
 * The dev-warning sink frameless-angular-v1 T002 ruling 4 requires of this lane.
 *
 * WHY THIS FILE EXISTS. @async/witness 0.7.0 cannot observe console warnings at
 * all: `PageOutcomeExpectation` exposes `consoleErrors` only, and `PageHandle`
 * has no console accessor. Angular's most important activation diagnostic is a
 * warning, not an error, and it is the one that would make this whole lane a
 * green vacuum if it went unwatched.
 *
 * MEASURED, at @angular/core 22.0.8, in the shipped bundle rather than from the
 * docs — `fesm2022/core.mjs:594`, inside `withDomHydration()`:
 *
 *   } else if (typeof ngDevMode !== 'undefined' && ngDevMode && !isClientRenderModeEnabled(doc)) {
 *     const console = inject(Console);
 *     const message = formatRuntimeError(-505, 'Angular hydration was requested on the client, ' +
 *       'but there was no serialized information present in the server response, ' +
 *       'thus hydration was not enabled. ...');
 *     console.warn(message);
 *   }
 *
 * `Console` is Angular's own one-line wrapper over `globalThis.console`, so
 * NG0505 lands on `window.console.warn` and nowhere else. What it means is
 * exactly the failure this lane cannot afford: the client decided the server
 * payload carried no hydration annotations, so it threw the server markup away
 * and client-rendered instead. Every observation in the shared contract would
 * still be green, because a client-rendered page looks identical. The only
 * difference is on a channel witness cannot see.
 *
 * `provideBrowserGlobalErrorListeners()` (which this demo keeps, from the
 * scaffold) is not a substitute: it catches errors, and this is a warning.
 *
 * HOW THE LANE READS IT. The sink cannot throw — nothing in the page would catch
 * it — so it reflects its state onto three attributes on `<html>`, which
 * `demos/angular-official/scenarios.box.ts` reads back out of `page.content()`
 * through the shared contract's own `measureAttribute`:
 *
 *   data-frameless-dev-sink           'calibrated' | 'uncalibrated:<reason>'
 *   data-frameless-dev-diagnostics    the count, as a decimal string
 *   data-frameless-dev-diagnostic-1st the first message, sanitized
 *
 * INSTRUMENT RULE 2 AND 3, BOTH. A sink that silently failed to install would
 * report nothing and read as clean. So installation is *asserted*, not assumed:
 * at install time the sink plants one warn and one error through the patched
 * console and requires each to have been captured exactly once — a
 * double-installed patch fails the count, a non-installed patch fails the
 * capture — and then drains. Only then does it write `calibrated`. The lane
 * asserts that value BEFORE it trusts a count of zero.
 *
 * INSTRUMENT RULE 4 is `calibrateDevSink` in `scenarios.box.ts`, which serves
 * the real S1 payload with Angular's own `<script id="ng-state">` removed and
 * requires this sink to capture the resulting NG0505. A sink calibrated only
 * against a console call it planted itself has never been shown to see a real
 * Angular diagnostic travel through this demo's actual wiring.
 *
 * The two install-time probes deliberately do **not** reach the real console:
 * the error one would otherwise land in witness's own `consoleErrors` ledger and
 * fail the `consoleErrors: 0` expectation the shared contract already asserts.
 *
 * WHY MODULE SCOPE, AND WHY FIRST IN `main.ts`. NG0505 is raised by an
 * `ENVIRONMENT_INITIALIZER` that runs *inside* `bootstrapApplication`. A sink
 * installed afterwards would capture nothing that matters. This module is
 * imported before `./app/app.config` and before `bootstrapApplication` is
 * called, and installs at module-evaluation time. Setting the *activation
 * marker* here would be wrong for exactly the same reason it is right for the
 * sink; it is set from `ApplicationRef.isStable` in `app/app.ts` instead.
 *
 * This follows `demos/vue-official/src/dev-sink.ts`, which follows
 * `demos/svelte-official/src/hooks.client.ts`. It differs only in the header and
 * in being imported from `main.ts` rather than from a client entry, because the
 * Angular scaffold has no separate client entry module.
 *
 * WHAT THIS SINK STILL CANNOT SEE, stated so it is not mistaken for total
 * coverage: Angular template and TypeScript diagnostics never reach
 * `window.console` — they fail `ng build`, which is this demo's own gate and a
 * verify command on the T004 card. Emitter-level grammar diagnostics are
 * enforced by `packages/frameworks/angular`'s `parseTemplate` arbiter.
 */
const SINK_ATTRIBUTE = 'data-frameless-dev-sink';
const COUNT_ATTRIBUTE = 'data-frameless-dev-diagnostics';
const FIRST_ATTRIBUTE = 'data-frameless-dev-diagnostic-1st';
const INSTALLED_FLAG = '__framelessDevDiagnosticSink';
const WARN_PROBE = 'frameless-sink-calibration-warn';
const ERROR_PROBE = 'frameless-sink-calibration-error';

/**
 * A page may declare itself a calibration page, and only a calibration page.
 *
 * `demos/angular-official/scenarios.box.ts` serves exactly one such page per
 * run: the real S1 markup with Angular's serialized hydration state deleted, so
 * that a REAL Angular diagnostic (NG0505) can be observed reaching this sink.
 * On a page carrying this meta, and ONLY there, captured diagnostics are not
 * re-emitted to the real console — they are still counted, still reflected onto
 * the attributes, and still asserted by the box. The suppression changes what
 * witness's ledger sees, never what this sink sees.
 *
 * The reason is the one `demos/react-official/three-way-contract.ts` already
 * gave, in those words, for `calibrateServedClientEntry`: a deliberate control
 * must not leave a permanent statement against the run.
 *
 * The three scenario pages (`/`, `/s2`, `/s3`) never carry the meta, so their
 * pass-through — and therefore the shared contract's `consoleErrors: 0` — is
 * completely untouched. Nothing in this file makes those pages quieter.
 *
 * `<head>` is fully parsed before this module runs: Angular's `index.html`
 * loads the built client entry from the end of `<body>`.
 */
const CALIBRATION_META = 'meta[name="frameless-calibration"]';

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
  // Read once, at install: see CALIBRATION_META. `false` on every real page.
  const isCalibrationPage = document.querySelector(CALIBRATION_META) !== null;

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
        text: args.map((arg) => (typeof arg === 'string' ? arg : String(arg))).join(' '),
      });
      // Probe messages stay inside the sink; see the header comment. So does
      // everything raised on a self-declared calibration page — counted and
      // reflected below, just not re-emitted. See CALIBRATION_META.
      if (probing) return;
      if (!isCalibrationPage) passThrough(...args);
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
