import { spawn } from 'node:child_process'
import { readdirSync, statSync } from 'node:fs'
import { createServer, request as httpRequest } from 'node:http'
import type { IncomingMessage, ServerResponse } from 'node:http'
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

const paths = { s1: '/', s2: '/s2', s3: '/s3', s4: '/s4', s5: '/s5', s6: '/s6' } as const

/**
 * The calibration route. Not part of the three scenarios and never compared
 * across lanes — it exists only so this box can prove its own dev-warning sink
 * catches a REAL Angular hydration diagnostic before it is trusted to report
 * zero. See `calibrateDevSink`.
 *
 * It is a QUERY on `/`, not a path of its own, and that is load-bearing: a path
 * the router does not know renders nothing at all. MEASURED — the first attempt
 * used `/__frameless-hydration-state-deleted`, and `<app-root>` came back
 * carrying an empty `<router-outlet>`, so every downstream arm would have been
 * asserting against a blank page. The query form matches `path: ''` in
 * `src/app/app.routes.ts`, so this really is the S1 page.
 */
const MISMATCH_PATH = '/?frameless-calibration=hydration-state-deleted'

/**
 * Angular's serialized hydration annotations, and how the calibration route
 * removes them.
 *
 * `<script id="ng-state" type="application/json">{"__nghData__":[…]}</script>`
 * is what `provideClientHydration()` reads on the client to decide whether the
 * server sent hydratable markup at all. Delete it and Angular takes the branch
 * at @angular/core 22.0.8 `fesm2022/core.mjs:594` and warns NG0505 — which is
 * the KNOWN MEMBER this lane's sink has to be shown catching.
 */
const NG_STATE_OPEN = '<script id="ng-state" type="application/json">'
const SCRIPT_CLOSE = '</script>'

/**
 * How the calibration page declares itself to `src/dev-sink.ts`.
 *
 * NG0505 arrives on `console.warn`, so unlike the Vue lane's mismatch this
 * control raises no `console.error` — but the suppression is kept anyway,
 * because it is the sink's own documented mechanism and because a future
 * Angular that added an error half would silently turn this control into a
 * contested pass. See the CALIBRATION_META comment in `src/dev-sink.ts`; the
 * three scenario pages never carry it and are completely unaffected.
 */
const CALIBRATION_META = '<meta name="frameless-calibration" content="hydration-state-deleted">'

/** The built output this lane serves, and the source it must be newer than. */
const distDirectory = new URL('./dist/angular-official/', import.meta.url)
const serverEntry = new URL('server/server.mjs', distDirectory)

function newestModifiedUnder(directory: URL): number {
	let newest = 0
	for (const entry of readdirSync(directory, { withFileTypes: true })) {
		const child = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, directory)
		newest = Math.max(
			newest,
			entry.isDirectory() ? newestModifiedUnder(child) : statSync(child).mtimeMs,
		)
	}
	return newest
}

/**
 * INSTRUMENT RULE 2: the harness asserts its own preconditions.
 *
 * Angular owns its build. `pnpm --dir demos/angular-official build:e2e` runs
 * `copy-emitted` and then the official `ng build --configuration development`,
 * and `scripts/e2e.mjs` runs it immediately before this box. Everything below
 * reads that output, so a stale `dist/` would let this lane pass on emitted
 * components that no longer exist. Reading `src/` back and requiring the server
 * bundle to be strictly newer is what makes that impossible rather than
 * unlikely.
 */
function assertBuiltOutputIsFresh(): { serverBundleAgeMs: number } {
	let bundle: ReturnType<typeof statSync>
	try {
		bundle = statSync(serverEntry)
	} catch (cause) {
		throw new Error(
			`demos/angular-official has no built server bundle at ${serverEntry.pathname}. This ` +
				'lane serves the output of the official `ng build`, so it must run ' +
				'`pnpm --dir demos/angular-official build:e2e` first — scripts/e2e.mjs does.',
			{ cause },
		)
	}
	const newestSource = newestModifiedUnder(new URL('./src/', import.meta.url))
	if (newestSource > bundle.mtimeMs) {
		throw new Error(
			'demos/angular-official/src is newer than its built server bundle, so this lane would ' +
				'serve output that predates the emitted components under test. Re-run ' +
				'`pnpm --dir demos/angular-official build:e2e`.',
		)
	}
	return { serverBundleAgeMs: Math.round(Date.now() - bundle.mtimeMs) }
}

/**
 * ANGULAR RUNS IN ITS OWN PROCESS, and that is a measurement result, not taste.
 *
 * The first shape tried here was the Vue lane's: import the built server bundle
 * and mount its `reqHandler` as connect middleware inside the witness dev
 * server. It renders correctly — and then kills the run. MEASURED, at
 * @angular/platform-server 22.0.8: the first SSR render REPLACES
 * `globalThis.Event` and `globalThis.CustomEvent` with the DOM implementation
 * platform-server installs. `globalThis.WebSocket` and `globalThis.EventTarget`
 * are left alone, so Node's own undici WebSocket — which is how @async/witness
 * talks CDP to Chromium — then rejects its own events with
 *
 *   TypeError [ERR_INVALID_ARG_TYPE]: The "event" argument must be an instance
 *   of Event. Received an instance of Event
 *
 * and the browser connection dies mid-run. Two realms, one global name. Nothing
 * about that is Angular misbehaving: `platform-server` is designed to own the
 * process it renders in, and this lane was asking it to share one with a
 * browser driver.
 *
 * So the Angular server is started the way the scaffold itself starts it —
 * `node dist/angular-official/server/server.mjs`, which is exactly what
 * `pnpm --dir demos/angular-official serve:ssr:angular-official` runs, taking
 * its port from `PORT` through the scaffold's own `src/server.ts` — and the
 * witness dev server proxies to it. Vite is transport and nothing else here.
 *
 * It also settles the vendored-Vite question structurally rather than by policy:
 * `@angular/build` pins Vite 7.3.6 as an exact dependency and the workspace
 * catalog pins 8.0.16, and after this they never share a process at all. The
 * divergence is asserted rather than assumed — see
 * `packages/frameworks/angular/test/toolchain.test.ts`.
 */
type AngularServer = { origin: string; stop: () => void }

async function pickFreePort(): Promise<number> {
	const probe = createServer()
	await new Promise<void>((resolve) => probe.listen(0, '127.0.0.1', resolve))
	const address = probe.address()
	if (address === null || typeof address === 'string') {
		throw new Error('Could not reserve a port for the Angular SSR server.')
	}
	const { port } = address
	await new Promise<void>((resolve) => probe.close(() => resolve()))
	return port
}

/**
 * Starts the built Angular server and waits until it answers.
 *
 * The readiness loop is a PRECONDITION, not a quiescence bound: it never makes a
 * failing observation pass, it only refuses to proceed against a server that is
 * not up, and it fails loudly with the child's own stderr when it gives up.
 */
async function startAngularServer(): Promise<AngularServer> {
	const port = await pickFreePort()
	const origin = `http://127.0.0.1:${port}`
	const child = spawn(process.execPath, [serverEntry.pathname], {
		cwd: new URL('./', import.meta.url).pathname,
		env: {
			...process.env,
			PORT: String(port),
			// Angular's OWN runtime configuration point, read by
			// `AngularNodeAppEngine`'s constructor through `getAllowedHostsFromEnv()`
			// (@angular/ssr 22.0.8 `fesm2022/node.mjs:10` and `:286`).
			//
			// The scaffold ships `security.allowedHosts: []` in angular.json, and the
			// built engine then rejects EVERY request with a 400 — measured, on the
			// pristine build, for `localhost`, `127.0.0.1` and an arbitrary host
			// alike. That is the scaffold behaving as designed: the list names the
			// origin the app is actually served from and a deployment fills it in.
			// Using the documented env var rather than editing angular.json keeps the
			// scaffold's own build configuration byte-identical.
			NG_ALLOWED_HOSTS: 'localhost,127.0.0.1',
		},
		stdio: ['ignore', 'pipe', 'pipe'],
	})
	let output = ''
	child.stdout.on('data', (chunk: Buffer) => {
		output += chunk.toString()
	})
	child.stderr.on('data', (chunk: Buffer) => {
		output += chunk.toString()
	})
	let exited: string | null = null
	child.on('exit', (code, signal) => {
		exited = `exited with code ${code} signal ${signal}`
	})

	const stop = () => {
		if (!child.killed) child.kill()
	}
	process.once('exit', stop)

	const deadline = Date.now() + 30_000
	for (;;) {
		if (exited !== null) {
			stop()
			throw new Error(
				`The Angular SSR server ${exited} before it answered. Its output was:\n${output}`,
			)
		}
		try {
			const probe = await fetch(`${origin}/`)
			if (probe.ok) {
				await probe.text()
				return { origin, stop }
			}
		} catch {
			// Not listening yet.
		}
		if (Date.now() > deadline) {
			stop()
			throw new Error(
				`The Angular SSR server at ${origin} did not answer within 30s. Its output was:\n${output}`,
			)
		}
		await new Promise((resolve) => setTimeout(resolve, 50))
	}
}

/**
 * Serves the demo through the OFFICIAL Angular server, over a proxy.
 *
 * `dist/angular-official/server/server.mjs` is the scaffold's own `src/server.ts`
 * after `ng build`: an express app that serves `dist/.../browser` statically and
 * hands everything else to `AngularNodeAppEngine`. Nothing in this repo renders
 * Angular; there is no hand-rolled Angular SSR pipeline anywhere, which
 * `docs/goals/frameless-qwik-v1` records the cost of.
 *
 * Registered in the PRE hook, so Angular answers every request before Vite's own
 * middlewares see it.
 *
 * The calibration middleware sits in front and answers exactly one path; every
 * other request, including all three scenario paths, reaches the stock server
 * untouched.
 */
const angularSsr = {
	name: 'frameless-angular-ssr',
	async configureServer(server: {
		middlewares: { use: (handler: unknown) => void }
		httpServer?: { once: (event: string, listener: () => void) => void } | null
	}) {
		const angular = await startAngularServer()
		server.httpServer?.once('close', angular.stop)

		// INSTRUMENT RULE 4: plant an instance the sink should find. This asks the
		// real server, over a real socket, for the real S1 page and then deletes
		// Angular's own serialized hydration state from it, so the browser receives
		// markup `provideClientHydration()` refuses to hydrate. Every step of the
		// mutation is asserted to have landed — a search literal that silently
		// fails to match is this repo's own recorded failure mode.
		server.middlewares.use(
			async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
				const url = req.url ?? ''
				if (url !== MISMATCH_PATH && !url.startsWith(`${MISMATCH_PATH}?`)) {
					next()
					return
				}
				// Every failure below answers the request with a 500 carrying its own
				// reason rather than throwing out of the middleware. A throw here
				// leaves the socket open and the lane hangs until the whole run times
				// out, which turns a precise finding into an unreadable stall; the box
				// fetches this path and asserts on it before it visits it.
				try {
					const honest = await (await fetch(`${angular.origin}/`)).text()
					const stateAt = honest.indexOf(NG_STATE_OPEN)
					if (stateAt === -1) {
						throw new Error(
							`could not find ${NG_STATE_OPEN} in the payload the real handler produced ` +
								'for /, so there is nothing to delete and the browser would receive a page ' +
								'that hydrates normally, making the sink calibration vacuous',
						)
					}
					const stateEnd = honest.indexOf(SCRIPT_CLOSE, stateAt)
					if (stateEnd === -1) {
						throw new Error('found no </script> closing ng-state')
					}
					if (!honest.includes('</head>')) {
						throw new Error(
							'cannot declare itself to the dev sink: the payload has no </head> to inject ' +
								'the calibration meta before',
						)
					}
					const planted = (
						honest.slice(0, stateAt) + honest.slice(stateEnd + SCRIPT_CLOSE.length)
					).replace('</head>', `${CALIBRATION_META}</head>`)
					if (planted.includes(NG_STATE_OPEN)) {
						throw new Error('did not remove ng-state')
					}
					if (planted.length >= honest.length) {
						throw new Error('did not shrink the payload')
					}
					if (!planted.includes(CALIBRATION_META)) {
						throw new Error('did not inject its own meta')
					}
					res.statusCode = 200
					res.setHeader('Content-Type', 'text/html')
					res.end(planted)
				} catch (error) {
					res.statusCode = 500
					res.setHeader('Content-Type', 'text/plain')
					res.end(
						`The hydration-state calibration ${error instanceof Error ? error.message : String(error)}.`,
					)
				}
			},
		)

		// The proxy. Method, path, headers and body are forwarded verbatim — the
		// original `Host` included, so Angular's own host validation sees the origin
		// the browser really used rather than one this file invented.
		server.middlewares.use((req: IncomingMessage, res: ServerResponse) => {
			const upstream = httpRequest(
				`${angular.origin}${req.url ?? '/'}`,
				{ method: req.method, headers: req.headers },
				(response) => {
					res.writeHead(response.statusCode ?? 502, response.headers)
					response.pipe(res)
				},
			)
			upstream.on('error', (error: Error) => {
				res.statusCode = 502
				res.setHeader('Content-Type', 'text/plain')
				res.end(`The Angular SSR server at ${angular.origin} could not be reached: ${error.message}`)
			})
			req.pipe(upstream)
		})
	},
}

/**
 * M4, asserted rather than assumed: the marker the shared contract waits for was
 * written while the routed scenario was already in the DOM.
 *
 * `src/app/app.ts` sets `data-frameless-activated-with` immediately before it
 * sets `data-frameless-activated`, recording what it saw. This reads it back.
 * MEASURED: the root component's `afterNextRender` records `scenario-absent` on
 * the client-render control page while `ApplicationRef.isStable` records
 * `scenario-present` on every page, which is why the lane is on `isStable`. This
 * check is what keeps that a fact about the current build rather than a note
 * about one run in July.
 *
 * Called on every page the lane opens, including the calibration page, because
 * the calibration page is where the two candidates actually differ.
 */
async function assertMarkerFollowedTheScenario(page: PageHandle): Promise<string> {
	const witness = measureAttribute(
		await page.content(),
		'data-frameless-activated-with',
		'data-frameless-activated-with',
	)
	if (witness !== 'scenario-present') {
		throw new Error(
			`The activation marker for ${page.route} was written with ${witness}: Angular reported ` +
				'the application settled while the routed scenario was not yet in the DOM, so the ' +
				'contract would start clicking a page that has nothing to click. The permitted ' +
				'repair is a STRONGER SIGNAL in src/app/app.ts, never a wait or a timeout.',
		)
	}
	return `activation marker written with ${witness}`
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
 * `console.warn`, which is how Angular reports NG0505: "hydration was requested
 * on the client, but there was no serialized information present in the server
 * response, thus hydration was not enabled". That warning is precisely the
 * failure this lane could not otherwise see, because a client-rendered page
 * satisfies every observation in the shared contract.
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
				'from it would mean nothing. See demos/angular-official/src/dev-sink.ts.',
		)
	}
	if (count !== '0') {
		throw new Error(
			`Angular raised ${count} dev console diagnostic(s) during this scenario; the first was ` +
				`${first ?? '(not captured)'}. A dev-only warning is a failure in this lane, not ` +
				'noise: NG0505 means the client threw the server markup away and rendered from ' +
				'scratch, which every other observation in this contract would still call green.',
		)
	}
	return `sink ${verdict} with ${count} dev console diagnostics`
}

/**
 * INSTRUMENT RULE 4, and the reason this lane's green is readable at all.
 *
 * Angular does not fail when hydration is skipped. It warns once, on
 * `console.warn`, and then renders the whole application on the client — so an
 * Angular lane can be green on every observation while no hydration happened at
 * all. The sink's own install-time calibration proves it captures a console call
 * *it plants itself*; it proves nothing about whether a real Angular diagnostic
 * reaches it through this demo's actual wiring. Between the two there are at
 * least three ways to end up with a green vacuum: a sink imported after
 * `bootstrapApplication`, a production build in which `ngDevMode` is compiled
 * out and the branch never runs, or a future Angular that routes the message
 * somewhere other than `window.console`.
 *
 * So this plants a KNOWN MEMBER. `MISMATCH_PATH` serves the real S1 page with
 * Angular's `<script id="ng-state">` deleted — markup `provideClientHydration()`
 * refuses to hydrate — and this requires:
 *
 *  1. the sink to report at least one diagnostic, and
 *  2. the first one to be Angular's own NG0505 hydration warning, at warn
 *     level, and
 *  3. the page to still render correctly afterwards.
 *
 * The third is not decoration. It is the demonstration that the page LOOKS
 * correct with hydration disabled, which is precisely why the console channel
 * and not the page is what has to be watched.
 *
 * Nothing here routes through `expect` for its negative facts: a deliberate
 * control must not record a permanent statement against the run, which
 * `demos/react-official/three-way-contract.ts` already ruled out in those words
 * for `calibrateServedClientEntry`.
 */
async function calibrateDevSink(
	browser: BrowserApi,
	expect: ExpectApi,
): Promise<Record<string, unknown>> {
	// INSTRUMENT RULE 2, before anything is read from a browser: the planted page
	// has to be the page this claims to serve. Fetching it first turns any
	// failure in the middleware into a one-line assertion here instead of a
	// browser waiting on a marker that will never appear.
	const plantedPayload = await browser.fetch(MISMATCH_PATH)
	await expect.response.matches(plantedPayload, { status: 200, contentType: 'text/html' })
	if (plantedPayload.text.includes(NG_STATE_OPEN) || !plantedPayload.text.includes(CALIBRATION_META)) {
		throw new Error(
			`The payload served for ${MISMATCH_PATH} is not the planted one: ng-state present = ` +
				`${plantedPayload.text.includes(NG_STATE_OPEN)}, calibration meta present = ` +
				`${plantedPayload.text.includes(CALIBRATION_META)}. The control has to be the thing ` +
				'it claims to be before anything is concluded from it.',
		)
	}

	const page = await browser.visit(MISMATCH_PATH)
	// A passing assertion, used as the settle: the marker only appears once
	// ApplicationRef.isStable has gone true, which is after Angular finished
	// deciding whether to hydrate and therefore after NG0505 would have been
	// raised. See src/app/app.ts.
	await expect.page.attribute(page, 'html', 'data-frameless-activated', 'angular')
	// This page is the ONE place the two M4 candidates differ, so the ordering
	// check runs here first and hardest.
	const markerOrdering = await assertMarkerFollowedTheScenario(page)

	const { verdict, count, first } = await readDevSink(page)
	if (verdict !== 'calibrated') {
		throw new Error(`The dev-diagnostic sink reported ${verdict} on the calibration page.`)
	}
	if (count === '0' || count === null) {
		throw new Error(
			`The dev-diagnostic sink captured ${count} diagnostics on a page whose serialized ` +
				'hydration state was deliberately deleted. A real Angular hydration diagnostic ' +
				'therefore does NOT reach this sink, so a count of zero on the real scenarios means ' +
				'nothing. Look for the sink being imported after bootstrapApplication, for the lane ' +
				'serving an optimized build in which ngDevMode is compiled out, or for Angular ' +
				'having moved the message off window.console.',
		)
	}
	// `warn:` and `NG0505` are BOTH required. The level prefix is what makes this
	// arm catch a sink that only ever sees the error channel — witness already
	// watches errors, so an error-only sink would add nothing while looking
	// identical from here. The code is what makes it Angular's OWN hydration
	// diagnostic rather than any warning that happened to fire first.
	const namesTheWarning = first !== null && first.startsWith('warn:') && first.includes('NG0505')
	if (!namesTheWarning) {
		throw new Error(
			`The dev-diagnostic sink captured ${count} diagnostic(s) on the page with its hydration ` +
				`state deleted, but the first was ${first ?? '(not captured)'}, which is not ` +
				"Angular's own NG0505 hydration WARNING. The calibration is only meaningful if what " +
				'it caught is the class it claims to catch: a warn-level NG0505.',
		)
	}
	const derived = measureText(await page.content(), 'data-value="derived"')
	if (derived !== 'kit:2') {
		throw new Error(
			`With hydration disabled the DOM reads ${JSON.stringify(derived)} rather than kit:2. ` +
				'The calibration assumes Angular renders the same page on the client — that ' +
				'assumption is what makes the console channel load-bearing — so if it no longer ' +
				'holds, this arm is measuring something other than a completed non-hydration.',
		)
	}
	return {
		devSinkCalibration:
			`served / with <script id="ng-state"> deleted, sink captured ${count} diagnostic(s), ` +
			`first is a warn-level NG0505, DOM still reads ${derived}`,
		markerOrderingOnClientRender: markerOrdering,
	}
}

export default box(
	{
		name: 'angular-official — S1/S2/S3/S4/S5/S6 from emitted output',
		modes: ['dev'],
		tags: ['three-way'],
	},
	async ({ pipeline, browser, expect, receipt }) => {
		const freshness = assertBuiltOutputIsFresh()

		await pipeline.dev({
			config: (config) => ({
				...config,
				appType: 'custom',
				plugins: [...(config.plugins ?? []), angularSsr],
			}),
		})

		// FIRST, before any scenario: prove the sink sees a real Angular hydration
		// diagnostic. Every green below is only readable as "hydration ran" because
		// this ran and passed.
		const devSinkCalibration = await calibrateDevSink(browser, expect)

		const activation = { kind: 'hydrate', framework: 'angular' } as const
		const results = []
		for (const scenario of scenarioIds) {
			// What the server actually sent, before any JS ran: the built client
			// entry module and inert markup — no Qwik container, no activation
			// marker.
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
			// Angular's SSR writes the IR's `value` PROPERTY binding into the served
			// `value="hello"` ATTRIBUTE — measured, not assumed, and the reason
			// [value] was not "repaired" to [attr.value].
			const result = await runScenario({ scenario, page, expect, activation, served })
			// M4: the marker `runScenario` just waited on was written after the
			// routed scenario reached the DOM. Asserted on every page.
			const markerOrdering = await assertMarkerFollowedTheScenario(page)
			// Angular, Vue and Svelte only: the console-warning channel the witness
			// API cannot see. For Angular this is load-bearing rather than
			// defensive — see `calibrateDevSink`.
			const devDiagnostics = await assertNoDevDiagnostics(page)
			results.push({
				...result,
				evidence: {
					...servedEvidence,
					...calibration,
					...result.evidence,
					...freshness,
					...devSinkCalibration,
					markerOrdering,
					devDiagnostics,
				},
			})
		}

		receipt.note(JSON.stringify({ kind: 'three-way-results', framework: 'angular', results }))
	},
)
