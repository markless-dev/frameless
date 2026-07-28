import { box } from '@async/witness'
import {
	assertServedActivation,
	runScenario,
	scenarioIds,
} from '../react-official/three-way-contract.ts'

// The Qwik router normalizes nested routes to a trailing slash; visiting the
// canonical form keeps the lane free of a redirect navigation.
const paths = { s1: '/', s2: '/s2/', s3: '/s3/', s4: '/s4/', s5: '/s5/', s6: '/s6/', s7: '/s7/' } as const

export default box(
	{
		name: 'qwik — S1/S2/S3/S4/S5/S6/S7 from emitted output',
		modes: ['dev'],
		tags: ['three-way'],
	},
	async ({ pipeline, browser, expect, receipt }) => {
		// No config overlay and no middleware: qwikRouter() already renders on the
		// server in dev. This is the stock `pnpm create qwik` pipeline.
		await pipeline.dev()

		const activation = { kind: 'resume', framework: 'qwik' } as const
		const results = []
		for (const scenario of scenarioIds) {
			// React and Solid ship markup plus a hydration pass; Qwik ships a paused
			// container whose handlers are already named in the markup as QRLs, and
			// no hydration pass at all. Assert that on the payload the server
			// actually sent, before the browser touches it.
			const served = await browser.fetch(paths[scenario])
			const servedEvidence = await assertServedActivation({ served, expect, activation })

			// The live half of the proof lives in runScenario: qsymbol events name
			// the handler QRLs the clicks pulled on demand, and the container
			// transitions paused -> resumed.
			const page = await browser.visit(paths[scenario])
			// `served` is the same payload asserted above: S3 reads its
			// `server-rendered text` observation out of the server's own bytes.
			const result = await runScenario({ scenario, page, expect, activation, served })
			results.push({ ...result, evidence: { ...servedEvidence, ...result.evidence } })
		}

		receipt.note(
			JSON.stringify({ kind: 'three-way-results', framework: 'qwik', results }),
		)
	},
)
