import { box } from '@async/witness'
import type { PageHandle } from '@async/witness'
import {
	assertServedActivation,
	calibrateServedClientEntry,
	measureAttribute,
	runScenario,
	scenarioIds,
} from '../react-official/three-way-contract.ts'

// SvelteKit's default `trailingSlash: 'never'`, so these are the canonical
// forms and the lane never pays for a redirect navigation.
const paths = { s1: '/', s2: '/s2', s3: '/s3', s4: '/s4', s5: '/s5' } as const

/**
 * The dev-warning check witness itself cannot make.
 *
 * @async/witness 0.7.0 exposes `consoleErrors` and nothing else — no console
 * accessor on `PageHandle` at all — so `expect.page.outcome` is blind to
 * `console.warn`, which is how Svelte reports `ownership_invalid_mutation` and
 * `state_unsafe_mutation`. `src/hooks.client.ts` installs an in-page sink and
 * reflects its state onto `<html>`; this reads it back through the shared
 * contract's own `measureAttribute`, so the demo lane measures rather than
 * assumes.
 *
 * Two assertions, in this order, because the second is worthless without the
 * first: the sink must report itself **calibrated** — it planted a warn and an
 * error at install and captured each exactly once — and only then does a count
 * of zero mean "no warnings" rather than "nothing was watching". A missing
 * attribute throws out of `measureAttribute` rather than reading as clean.
 */
async function assertNoDevDiagnostics(page: PageHandle): Promise<string> {
	const html = await page.content()
	const sink = measureAttribute(html, 'data-frameless-dev-sink', 'data-frameless-dev-sink')
	if (sink !== 'calibrated') {
		throw new Error(
			`The dev-diagnostic sink reported ${sink}, not "calibrated": it could not prove it ` +
				'captures a planted console.warn and console.error exactly once, so a zero count ' +
				'from it would mean nothing. See demos/svelte-official/src/hooks.client.ts.',
		)
	}
	const count = measureAttribute(
		html,
		'data-frameless-dev-diagnostics',
		'data-frameless-dev-diagnostics',
	)
	if (count !== '0') {
		const first = measureAttribute(
			html,
			'data-frameless-dev-diagnostics',
			'data-frameless-dev-diagnostic-1st',
		)
		throw new Error(
			`Svelte raised ${count} dev console diagnostic(s) during this scenario; the first was ` +
				`${first ?? '(not captured)'}. A dev-only warning is a failure in this lane, not ` +
				'noise: Svelte reports ownership violations that way and they do not surface as ' +
				'console errors.',
		)
	}
	return `sink ${sink} with ${count} dev console diagnostics`
}

export default box(
	{
		name: 'svelte-official — S1/S2/S3/S4/S5 from emitted output',
		modes: ['dev'],
		tags: ['three-way'],
	},
	async ({ pipeline, browser, expect, receipt }) => {
		// No config overlay and no middleware: `sveltekit()` already renders on
		// the server in dev. This is the stock `sv create` pipeline, and it is
		// the same single path `pnpm --dir demos/svelte-official dev` takes —
		// react-official's "server.js and the box share createSsrHandler" property
		// reached by there being only one handler in the first place.
		await pipeline.dev()

		const activation = { kind: 'hydrate', framework: 'svelte' } as const
		const results = []
		for (const scenario of scenarioIds) {
			// What the server actually sent, before any JS ran: SvelteKit's client
			// entry module and inert markup — no Qwik container, no activation
			// marker.
			const served = await browser.fetch(paths[scenario])
			const servedEvidence = await assertServedActivation({ served, expect, activation })
			// Instrument rule 3. The literal above is measured from this payload;
			// this proves the same predicate rejects a payload without it, so the
			// check is one that has been seen to go red.
			const calibration = calibrateServedClientEntry({
				served,
				framework: activation.framework,
			})

			const page = await browser.visit(paths[scenario])
			// `served` is the same payload asserted above: S3 reads its
			// `server-rendered text` observation out of the server's own bytes.
			// SvelteKit's SSR emits `value="hello"`; hydration then deletes the
			// attribute by design, which is exactly why the read is here.
			const result = await runScenario({ scenario, page, expect, activation, served })
			// Svelte only: the console-warning channel the witness API cannot see.
			const devDiagnostics = await assertNoDevDiagnostics(page)
			results.push({
				...result,
				evidence: {
					...servedEvidence,
					...calibration,
					...result.evidence,
					devDiagnostics,
				},
			})
		}

		receipt.note(
			JSON.stringify({ kind: 'three-way-results', framework: 'svelte', results }),
		)
	},
)
