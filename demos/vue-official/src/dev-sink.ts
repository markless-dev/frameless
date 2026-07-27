/**
 * The dev-warning sink T002 ruling 4 requires of this lane.
 *
 * WHY THIS FILE EXISTS, and why it matters MORE here than in the Svelte lane.
 * @async/witness 0.7.0 cannot observe console warnings at all:
 * `PageOutcomeExpectation` exposes `consoleErrors` only, and `PageHandle` has no
 * console accessor. Vue does not *fail* on a hydration mismatch — measured by
 * `frameless-vue-v1` T003 finding 2, on a real emitted component, two-sided:
 *
 *   matching container   -> hydrates in silence
 *   mismatched container -> console.warn  "[Vue warn]: Hydration text content
 *                                          mismatch on <output …> - rendered on
 *                                          server: … - expected on client: …"
 *                           console.error "Hydration completed but contains
 *                                          mismatches."
 *
 * and Vue then **patches the DOM to match the client**, so the visible result of
 * a genuine mismatch is a correct-looking page. A Vue lane instrumented only
 * through witness could therefore pass green while hydration was mismatching on
 * every scenario. That is what this sink exists to make impossible.
 *
 * The `console.error` half would be caught by the shared contract's
 * `consoleErrors: 0`. The `console.warn` half — the one that names the element
 * and both values — would not be caught by anything without this file.
 *
 * NO `app.config.warnHandler`. This is the trap T002 ruling 4 names as a T004
 * stop condition, and it is set nowhere in this demo. `warnHandler` intercepts
 * Vue's own `warn()` channel and *suppresses* the console output; installing one
 * without re-emitting would turn this sink into a green vacuum, which is worse
 * than having no sink at all. Patching `console` is the correct level precisely
 * because T003 measured both messages to be ordinary console calls.
 *
 * HOW THE LANE READS IT. The sink cannot throw — nothing in the page would catch
 * it — so it reflects its state onto three attributes on `<html>`, which
 * `demos/vue-official/scenarios.box.ts` reads back out of `page.content()`
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
 * asserts that value BEFORE it trusts a count of zero, so an uninstalled or
 * double-installed sink fails the lane rather than quietly passing it.
 *
 * The two probes deliberately do **not** reach the real console: the error one
 * would otherwise land in witness's own `consoleErrors` ledger and fail the
 * `consoleErrors: 0` expectation the shared contract already asserts.
 *
 * WHY MODULE SCOPE, AND WHY FIRST IN `entry-client.ts`. Hydration mismatches are
 * raised *during* `app.mount()`. A sink installed after mount would capture
 * nothing that matters. This module is imported before `./main` and before
 * `mount()` is called, and installs at module-evaluation time. Setting the
 * *activation marker* here would be wrong for exactly the same reason it is
 * right for the sink, and it is set in `App.vue`'s `onMounted` instead.
 *
 * This is a direct copy of `demos/svelte-official/src/hooks.client.ts`, which
 * T002 ruling 4 named as the shape to copy. It differs only in the header and
 * in having no SvelteKit `init` export.
 *
 * WHAT THIS SINK STILL CANNOT SEE, stated so it is not mistaken for total
 * coverage: SFC *compile*-time diagnostics never reach `window.console` — they
 * surface as Vite errors or as `@vue/compiler-sfc` `errors`/`tips`. Those are
 * enforced by the empty-diagnostics oracle in
 * `packages/frameworks/vue/test/compile-emitted.test.ts`, which is where T003
 * put them.
 */
const SINK_ATTRIBUTE = 'data-frameless-dev-sink'
const COUNT_ATTRIBUTE = 'data-frameless-dev-diagnostics'
const FIRST_ATTRIBUTE = 'data-frameless-dev-diagnostic-1st'
const INSTALLED_FLAG = '__framelessDevDiagnosticSink'
const WARN_PROBE = 'frameless-sink-calibration-warn'
const ERROR_PROBE = 'frameless-sink-calibration-error'

/**
 * A page may declare itself a calibration page, and only a calibration page.
 *
 * `demos/vue-official/scenarios.box.ts` serves exactly one such page per run:
 * the real S1 markup with `kit:2` rewritten to `kit:999`, so that a REAL Vue
 * hydration mismatch can be observed reaching this sink (instrument rule 4 — an
 * instrument that issues a verdict is calibrated against a known member). Vue
 * reports that mismatch as `console.warn` **and** `console.error`, and the
 * error would land in @async/witness's own client ledger and mark the whole box
 * a *contested pass* — a deliberate control leaving a permanent mark against the
 * run. `demos/react-official/three-way-contract.ts` already ruled that shape
 * out for `calibrateServedClientEntry`, in those words, and this follows it.
 *
 * So on a page carrying this meta, and ONLY there, captured diagnostics are not
 * re-emitted to the real console. They are still counted, still reflected onto
 * the attributes, and still asserted by the box — the suppression changes what
 * witness's ledger sees, never what this sink sees. It is the same mechanism the
 * two install-time probes below already use, widened from "this call is a probe"
 * to "this whole document is a probe".
 *
 * The three scenario pages (`/`, `/s2`, `/s3`) never carry the meta, so their
 * pass-through — and therefore the shared contract's `consoleErrors: 0` — is
 * completely untouched. Nothing in this file makes those pages quieter.
 *
 * `<head>` is fully parsed before this module runs: `index.html` loads the
 * client entry from the end of `<body>`.
 */
const CALIBRATION_META = 'meta[name="frameless-calibration"]'

type Diagnostic = { level: 'warn' | 'error'; text: string }

/** One line, no quotes, no angle brackets: this ends up inside an attribute. */
function sanitize(text: string): string {
  return text
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/["<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200)
}

function install(): void {
  const global = globalThis as Record<string, unknown>
  if (global[INSTALLED_FLAG] === true) return
  global[INSTALLED_FLAG] = true

  const captured: Diagnostic[] = []
  let probing = false
  // Read once, at install: see CALIBRATION_META. `false` on every real page.
  const isCalibrationPage = document.querySelector(CALIBRATION_META) !== null

  const reflect = () => {
    const root = document.documentElement
    root.setAttribute(COUNT_ATTRIBUTE, String(captured.length))
    const first = captured[0]
    if (first) root.setAttribute(FIRST_ATTRIBUTE, sanitize(`${first.level}: ${first.text}`))
    else root.removeAttribute(FIRST_ATTRIBUTE)
  }

  for (const level of ['warn', 'error'] as const) {
    const passThrough = console[level].bind(console)
    console[level] = (...args: unknown[]) => {
      captured.push({
        level,
        text: args.map((arg) => (typeof arg === 'string' ? arg : String(arg))).join(' '),
      })
      // Probe messages stay inside the sink; see the header comment. So does
      // everything raised on a self-declared calibration page — counted and
      // reflected below, just not re-emitted. See CALIBRATION_META.
      if (probing) return
      if (!isCalibrationPage) passThrough(...args)
      reflect()
    }
  }

  // Calibration: prove the sink captures, exactly once each, before it is
  // trusted to report zero.
  probing = true
  console.warn(WARN_PROBE)
  console.error(ERROR_PROBE)
  probing = false
  const warns = captured.filter(({ text }) => text === WARN_PROBE).length
  const errors = captured.filter(({ text }) => text === ERROR_PROBE).length
  const verdict =
    warns === 1 && errors === 1 && captured.length === 2
      ? 'calibrated'
      : `uncalibrated:warn=${warns},error=${errors},total=${captured.length}`
  captured.length = 0

  document.documentElement.setAttribute(SINK_ATTRIBUTE, verdict)
  reflect()
}

install()
