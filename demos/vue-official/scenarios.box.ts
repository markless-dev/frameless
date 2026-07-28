import { box } from '@async/witness'
import type { BrowserApi, ExpectApi, PageHandle } from '@async/witness'
import {
	assertServedActivation,
	calibrateServedClientEntry,
	measureAttribute,
	measureText,
	runScenario,
	scenarioIds,
} from '../react-official/three-way-contract.ts'
import { createSsrHandler } from './ssr-handler.js'

const paths = { s1: '/', s2: '/s2', s3: '/s3', s4: '/s4', s5: '/s5', s6: '/s6' } as const

/**
 * The calibration route. Not part of the three scenarios and never compared
 * across lanes — it exists only so this box can prove its own dev-warning sink
 * catches a REAL Vue hydration mismatch before it is trusted to report zero.
 * See `calibrateDevSink`.
 */
const MISMATCH_PATH = '/__frameless-hydration-mismatch'

/** What the server renders for S1, and what the calibration route corrupts it to. */
const HONEST_DERIVED = '>kit:2<'
const PLANTED_DERIVED = '>kit:999<'

/**
 * How the calibration page declares itself to `src/dev-sink.ts`.
 *
 * A real hydration mismatch makes Vue raise `console.error` as well as
 * `console.warn`, and that error would land in witness's own client ledger and
 * mark this box a *contested pass* — a deliberate control leaving a permanent
 * mark against the run. `demos/react-official/three-way-contract.ts` already
 * ruled that shape out for `calibrateServedClientEntry`, in those words. The
 * sink therefore stops re-emitting to the real console on a page carrying this
 * meta, while still counting and reflecting everything it captures, which is all
 * this box reads. See the CALIBRATION_META comment in `src/dev-sink.ts`; the
 * three scenario pages never carry it and are completely unaffected.
 */
const CALIBRATION_META = '<meta name="frameless-calibration" content="hydration-mismatch">'

/**
 * Serves the demo through the pipeline's own Vite dev server using the demo's
 * own SSR handler. server.js and this lane share createSsrHandler(), so the lane
 * exercises the same render path `pnpm --dir demos/vue-official dev` does — no
 * second harness exists to drift.
 *
 * The calibration middleware sits in front of it and answers exactly one path;
 * every other request, including all three scenario paths, reaches the stock
 * handler untouched.
 */
const demoSsr = {
	name: 'frameless-demo-ssr',
	configureServer(server: {
		middlewares: { use: (handler: unknown) => void }
	}) {
		return () => {
			const handler = createSsrHandler({ vite: server, base: '/' })

			// Instrument rule 4: plant an instance the sink should find. This renders
			// the real S1 page through the real handler and then rewrites the ONE
			// text node the client will recompute, so the browser receives markup a
			// correct client render disagrees with. The mutation is asserted to have
			// landed — a search literal that silently fails to match is this repo's
			// own recorded failure mode.
			server.middlewares.use(
				async (
					req: { url?: string; originalUrl?: string },
					res: {
						statusCode: number
						setHeader: (name: string, value: string) => void
						end: (body?: string) => void
					},
					next: () => void,
				) => {
					const url = req.url ?? ''
					if (url !== MISMATCH_PATH && !url.startsWith(`${MISMATCH_PATH}?`)) {
						next()
						return
					}
					let honest = ''
					await handler(
						{ originalUrl: '/', url: '/' },
						{
							statusCode: 200,
							setHeader: () => {},
							end: (body?: string) => {
								honest = body ?? ''
							},
						},
					)
					if (!honest.includes(HONEST_DERIVED)) {
						throw new Error(
							`The hydration-mismatch calibration could not find ${HONEST_DERIVED} in the ` +
								'payload the real handler produced for /, so it has nothing to corrupt and ' +
								'would hand the browser a page that hydrates cleanly. That would make the ' +
								'sink calibration vacuous.',
						)
					}
					if (!honest.includes('</head>')) {
						throw new Error(
							'The hydration-mismatch calibration cannot declare itself to the dev sink: the ' +
								'payload the real handler produced has no </head> to inject the calibration ' +
								'meta before.',
						)
					}
					const planted = honest
						.replace(HONEST_DERIVED, PLANTED_DERIVED)
						.replace('</head>', `${CALIBRATION_META}</head>`)
					if (planted === honest || !planted.includes(PLANTED_DERIVED)) {
						throw new Error('The hydration-mismatch calibration did not mutate the payload.')
					}
					if (!planted.includes(CALIBRATION_META)) {
						throw new Error('The hydration-mismatch calibration did not inject its own meta.')
					}
					res.statusCode = 200
					res.setHeader('Content-Type', 'text/html')
					res.end(planted)
				},
			)

			server.middlewares.use(handler)
		}
	},
}

/**
 * Reads the sink's own report off `<html>`.
 *
 * `src/dev-sink.ts` cannot throw — nothing in the page would catch it — so it
 * reflects its state onto three attributes, and this reads them back through the
 * shared contract's own `measureAttribute`. A missing attribute throws out of
 * `measureAttribute` rather than reading as clean.
 */
async function readDevSink(
	page: PageHandle,
): Promise<{ verdict: string | null; count: string | null; first: string | null }> {
	const html = await page.content()
	return {
		verdict: measureAttribute(html, 'data-frameless-dev-sink', 'data-frameless-dev-sink'),
		count: measureAttribute(
			html,
			'data-frameless-dev-diagnostics',
			'data-frameless-dev-diagnostics',
		),
		first: measureAttribute(
			html,
			'data-frameless-dev-diagnostics',
			'data-frameless-dev-diagnostic-1st',
		),
	}
}

/**
 * The dev-warning check witness itself cannot make.
 *
 * @async/witness 0.7.0 exposes `consoleErrors` and nothing else — no console
 * accessor on `PageHandle` at all — so `expect.page.outcome` is blind to
 * `console.warn`, which is how Vue reports `[Vue warn]: Hydration … mismatch`.
 * `src/dev-sink.ts` installs an in-page sink and reflects its state onto
 * `<html>`; this reads it back, so the demo lane measures rather than assumes.
 *
 * Two assertions, in this order, because the second is worthless without the
 * first: the sink must report itself **calibrated** — it planted a warn and an
 * error at install and captured each exactly once — and only then does a count
 * of zero mean "no warnings" rather than "nothing was watching".
 *
 * That self-calibration is still only rule 2 (the instrument asserts it ran).
 * Rule 4 — the instrument is calibrated against a KNOWN MEMBER of the set it
 * claims to establish — is `calibrateDevSink` below, which runs first.
 */
async function assertNoDevDiagnostics(page: PageHandle): Promise<string> {
	const { verdict, count, first } = await readDevSink(page)
	if (verdict !== 'calibrated') {
		throw new Error(
			`The dev-diagnostic sink reported ${verdict}, not "calibrated": it could not prove it ` +
				'captures a planted console.warn and console.error exactly once, so a zero count ' +
				'from it would mean nothing. See demos/vue-official/src/dev-sink.ts.',
		)
	}
	if (count !== '0') {
		throw new Error(
			`Vue raised ${count} dev console diagnostic(s) during this scenario; the first was ` +
				`${first ?? '(not captured)'}. A dev-only warning is a failure in this lane, not ` +
				'noise: Vue reports a hydration mismatch as console.warn and then PATCHES THE DOM ' +
				'to match the client, so the page looks correct while hydration is broken.',
		)
	}
	return `sink ${verdict} with ${count} dev console diagnostics`
}

/**
 * INSTRUMENT RULE 4, and the reason this lane's green is readable at all.
 *
 * Vue does not fail on a hydration mismatch. It warns, errors, and then patches
 * the DOM to match the client — so a Vue lane can be green on every observation
 * while hydration is genuinely mismatching on every scenario. The sink's own
 * install-time calibration proves it captures a console call *it plants itself*;
 * it proves nothing about whether a real Vue hydration warning reaches it
 * through this demo's actual wiring. Between the two there are at least three
 * ways to end up with a green vacuum: a sink imported after `mount()`, an
 * `app.config.warnHandler` set anywhere in the app (T002 ruling 4's named trap),
 * or a future Vue that routes the message somewhere other than `window.console`.
 *
 * So this plants a KNOWN MEMBER. `MISMATCH_PATH` serves the real S1 page with
 * `kit:2` rewritten to `kit:999` — markup a correct client render disagrees with
 * — and this requires:
 *
 *  1. the sink to report at least one diagnostic, and
 *  2. the first one to be Vue's own hydration-mismatch text, and
 *  3. the DOM to read `kit:2` afterwards.
 *
 * The third is not decoration. It is the demonstration that the page LOOKS
 * correct after a real mismatch, which is precisely why the console channel and
 * not the page is what has to be watched. If it ever read `kit:999`, the planted
 * page did not hydrate at all and arms 1 and 2 would be measuring something
 * else.
 *
 * Nothing here routes through `expect`: a deliberate mismatch also raises
 * `console.error("Hydration completed but contains mismatches.")`, and asserting
 * through `expect` on this page would record a permanent failure statement
 * against the run — the same reason `calibrateServedClientEntry` is hand-rolled.
 */
async function calibrateDevSink(
	browser: BrowserApi,
	expect: ExpectApi,
): Promise<Record<string, unknown>> {
	const page = await browser.visit(MISMATCH_PATH)
	// A passing assertion, used as the settle: the marker only appears once Vue
	// has flushed its mounted hooks, which is after hydration has completed and
	// therefore after any mismatch has been reported.
	await expect.page.attribute(page, 'html', 'data-frameless-activated', 'vue')

	const { verdict, count, first } = await readDevSink(page)
	if (verdict !== 'calibrated') {
		throw new Error(`The dev-diagnostic sink reported ${verdict} on the calibration page.`)
	}
	if (count === '0' || count === null) {
		throw new Error(
			`The dev-diagnostic sink captured ${count} diagnostics on a page whose server markup ` +
				`was deliberately corrupted (${HONEST_DERIVED} -> ${PLANTED_DERIVED}). A real Vue ` +
				'hydration mismatch therefore does NOT reach this sink, so a count of zero on the ' +
				'real scenarios means nothing. Look for an app.config.warnHandler, for the sink ' +
				'being imported after app.mount(), or for Vue having moved the message off ' +
				'window.console.',
		)
	}
	// `[Vue warn]` and the `warn:` level prefix are BOTH required, and that is
	// what makes this arm catch the trap T002 ruling 4 names. A mismatch also
	// raises `console.error("Hydration completed but contains mismatches.")`,
	// which contains the word "Hydration" too — so a check that only looked for
	// that word would still pass with an `app.config.warnHandler` swallowing the
	// warn half, which is the exact green vacuum this whole calibration exists to
	// rule out. The `warn:` prefix is written by the sink's own `reflect()`.
	const namesTheWarning =
		first !== null && first.startsWith('warn:') && first.includes('[Vue warn]')
	if (!namesTheWarning || !first.includes('Hydration')) {
		throw new Error(
			`The dev-diagnostic sink captured ${count} diagnostic(s) on the corrupted page but the ` +
				`first was ${first ?? '(not captured)'}, which is not Vue's own hydration WARNING. ` +
				'The calibration is only meaningful if what it caught is the class it claims to ' +
				'catch: a `[Vue warn]` at warn level. Catching only the companion console.error ' +
				'("Hydration completed but contains mismatches.") is what an app.config.warnHandler ' +
				'swallowing the warn channel looks like from here.',
		)
	}
	const derived = measureText(await page.content(), 'data-value="derived"')
	if (derived !== 'kit:2') {
		throw new Error(
			`After hydrating markup that said kit:999, the DOM reads ${JSON.stringify(derived)} ` +
				'rather than kit:2. The calibration assumes Vue patches the mismatch away — that ' +
				'assumption is what makes the console channel load-bearing — so if it no longer ' +
				'holds, this arm is measuring something other than a completed mismatched hydration.',
		)
	}
	return {
		devSinkCalibration:
			`served ${PLANTED_DERIVED}, sink captured ${count} diagnostic(s), first names ` +
			`Hydration, DOM patched back to ${derived}`,
	}
}

export default box(
	{
		name: 'vue-official — S1/S2/S3/S4/S5/S6 from emitted output',
		modes: ['dev'],
		tags: ['three-way'],
	},
	async ({ pipeline, browser, expect, receipt }) => {
		await pipeline.dev({
			config: (config) => ({
				...config,
				appType: 'custom',
				plugins: [...(config.plugins ?? []), demoSsr],
			}),
		})

		// FIRST, before any scenario: prove the sink sees a real Vue hydration
		// mismatch. Every green below is only readable as "hydration matched"
		// because this ran and passed.
		const devSinkCalibration = await calibrateDevSink(browser, expect)

		const activation = { kind: 'hydrate', framework: 'vue' } as const
		const results = []
		for (const scenario of scenarioIds) {
			// What the server actually sent, before any JS ran: the scaffold's own
			// client entry module and inert markup — no Qwik container, no
			// activation marker.
			const served = await browser.fetch(paths[scenario])
			const servedEvidence = await assertServedActivation({ served, expect, activation })
			// Instrument rule 3. The literal asserted above is measured from this
			// payload; this proves the same predicate rejects a payload without it,
			// so the check is one that has been seen to go red.
			const calibration = calibrateServedClientEntry({
				served,
				framework: activation.framework,
			})

			const page = await browser.visit(paths[scenario])
			// `served` is the same payload asserted above: S3 reads its
			// `server-rendered text` observation out of the server's own bytes.
			const result = await runScenario({ scenario, page, expect, activation, served })
			// Vue and Svelte only: the console-warning channel the witness API
			// cannot see. For Vue this is load-bearing rather than defensive — see
			// `calibrateDevSink`.
			const devDiagnostics = await assertNoDevDiagnostics(page)
			results.push({
				...result,
				evidence: {
					...servedEvidence,
					...calibration,
					...result.evidence,
					...devSinkCalibration,
					devDiagnostics,
				},
			})
		}

		receipt.note(JSON.stringify({ kind: 'three-way-results', framework: 'vue', results }))
	},
)
