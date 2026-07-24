import { box } from '@async/witness'
import { createSsrHandler } from './ssr-handler.js'
import { assertServedActivation, runScenario, scenarioIds } from './three-way-contract.ts'

const paths = { s1: '/', s2: '/s2', s3: '/s3' } as const

/**
 * Serves the demo through the pipeline's own Vite dev server using the demo's
 * own SSR handler. server.js and this lane share createSsrHandler(), so the
 * lane exercises the same render path `pnpm --dir demos/react-official dev`
 * does — no second harness exists to drift.
 */
const demoSsr = {
	name: 'frameless-demo-ssr',
	configureServer(server: { middlewares: { use: (handler: unknown) => void } }) {
		return () => {
			server.middlewares.use(createSsrHandler({ vite: server, base: '/' }))
		}
	},
}

export default box(
	{
		name: 'react-official — S1/S2/S3 from emitted output',
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

		const activation = { kind: 'hydrate', framework: 'react' } as const
		const results = []
		for (const scenario of scenarioIds) {
			// What the server actually sent, before any JS ran: a client entry
			// module and inert markup — no Qwik container, no activation marker.
			const served = await browser.fetch(paths[scenario])
			const servedEvidence = await assertServedActivation({ served, expect, activation })

			const page = await browser.visit(paths[scenario])
			const result = await runScenario({ scenario, page, expect, activation })
			results.push({ ...result, evidence: { ...servedEvidence, ...result.evidence } })
		}

		receipt.note(
			JSON.stringify({ kind: 'three-way-results', framework: 'react', results }),
		)
	},
)
