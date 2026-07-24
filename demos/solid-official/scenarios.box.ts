import { box } from '@async/witness'
import { runScenario, scenarioIds } from '../react-official/three-way-contract.ts'
import { createSsrHandler } from './ssr-handler.js'

const paths = { s1: '/', s2: '/s2', s3: '/s3' } as const

/**
 * Serves the demo through the pipeline's own Vite dev server using the demo's
 * own SSR handler. server.js and this lane share createSsrHandler(), so the
 * lane exercises the same render path `pnpm --dir demos/solid-official dev`
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
		name: 'solid-official — S1/S2/S3 from emitted output',
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

		const results = []
		for (const scenario of scenarioIds) {
			const page = await browser.visit(paths[scenario])
			results.push(
				await runScenario({
					scenario,
					page,
					expect,
					activation: { kind: 'hydrate', framework: 'solid' },
				}),
			)
		}

		receipt.note(
			JSON.stringify({ kind: 'three-way-results', framework: 'solid', results }),
		)
	},
)
