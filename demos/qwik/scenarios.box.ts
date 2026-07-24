import { box } from '@async/witness'
import { runScenario, scenarioIds } from '../react-official/three-way-contract.ts'

// The Qwik router normalizes nested routes to a trailing slash; visiting the
// canonical form keeps the lane free of a redirect navigation.
const paths = { s1: '/', s2: '/s2/', s3: '/s3/' } as const

export default box(
	{
		name: 'qwik — S1/S2/S3 from emitted output',
		modes: ['dev'],
		tags: ['three-way'],
	},
	async ({ pipeline, browser, expect, receipt }) => {
		// No config overlay and no middleware: qwikRouter() already renders on the
		// server in dev. This is the stock `pnpm create qwik` pipeline.
		await pipeline.dev()

		const results = []
		for (const scenario of scenarioIds) {
			// React and Solid ship markup plus a hydration pass; Qwik ships a paused
			// container and no hydration pass at all. Assert that on the payload the
			// server actually sent, before the browser touches it.
			const served = await browser.fetch(paths[scenario])
			await expect.response.matches(served, {
				status: 200,
				contains: 'q:container="paused"',
			})

			const page = await browser.visit(paths[scenario])
			results.push(
				await runScenario({
					scenario,
					page,
					expect,
					activation: { kind: 'resume', framework: 'qwik' },
				}),
			)
		}

		receipt.note(
			JSON.stringify({ kind: 'three-way-results', framework: 'qwik', results }),
		)
	},
)
