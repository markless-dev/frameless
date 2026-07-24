/**
 * The three-way behavior contract.
 *
 * One shared IR compiles to React, Solid and Qwik. What follows is the
 * *observable* outcome the emitted output must produce for each scenario, and
 * all three official demo lanes run this exact sequence. Running one shared
 * contract is what makes the claim a comparison rather than three unrelated
 * tests: if React, Solid and Qwik all pass these steps, they behaved the same.
 *
 * It lives under demos/react-official only because it has to live inside one of
 * the three demo packages. demos/solid-official and demos/qwik import it by
 * relative path, exactly the way demos/ssr imports demos/ui-kit/scenarios.ts.
 */
import type { ExpectApi, PageHandle } from '@async/witness'

export type ScenarioId = 's1' | 's2' | 's3'

export const scenarioIds: readonly ScenarioId[] = ['s1', 's2', 's3']

/**
 * How each framework becomes interactive. React and Solid hydrate, so the lane
 * waits for the hydration marker their client entry sets before it clicks;
 * Qwik resumes, so there is nothing to wait for — qwikloader buffers the event
 * and pulls the handler on demand. That asymmetry is the thesis, not a defect,
 * and it is the only thing the three lanes do differently.
 */
export type Activation =
  | { readonly kind: 'hydrate'; readonly framework: 'react' | 'solid' }
  | { readonly kind: 'resume'; readonly framework: 'qwik' }

export async function waitForInteractive(
  page: PageHandle,
  expect: ExpectApi,
  activation: Activation,
): Promise<void> {
  if (activation.kind === 'hydrate') {
    await expect.page.attribute(page, 'html', 'data-frameless-activated', activation.framework)
    return
  }
  // Qwik: nothing to wait for. There is no hydration pass to finish, so the
  // only precondition is that the document is a resumable Qwik container. The
  // qwik lane separately asserts that the *served* payload is paused, which is
  // where the hydrate-vs-resume difference is actually observable.
  await expect.page.exists(page, '[q\\:container]')
}

/** S1 — render-once: a derived value and one state transition. */
export async function assertS1(page: PageHandle, expect: ExpectApi): Promise<string[]> {
  const observed: string[] = []
  await expect.page.exists(page, '[data-s1-root] [data-scenario="s1"]')
  await expect.page.text(page, '[data-value="derived"]', 'kit:2')
  observed.push('server-rendered derived = kit:2')
  await page.click('[data-action="increment"]')
  await expect.page.text(page, '[data-value="derived"]', 'kit:4')
  observed.push('after one increment click derived = kit:4')
  return observed
}

/** S2 — keyed list: identity-preserving reorder, removal, and clear. */
export async function assertS2(page: PageHandle, expect: ExpectApi): Promise<string[]> {
  const observed: string[] = []
  await expect.page.exists(page, '[data-scenario="s2"]')
  await expect.page.text(page, '[data-count="complete"]', '1/2')
  await expect.page.attribute(page, 'ul li:first-child', 'data-oracle-row-key', 'a')
  await expect.page.attribute(page, 'ul li:last-child', 'data-oracle-row-key', 'b')
  observed.push('server-rendered rows a,b with complete = 1/2')

  await page.click('[data-action="reorder"]')
  await expect.page.attribute(page, 'ul li:first-child', 'data-oracle-row-key', 'b')
  await expect.page.attribute(page, 'ul li:last-child', 'data-oracle-row-key', 'a')
  await expect.page.text(page, '[data-count="complete"]', '1/2')
  observed.push('after reorder rows are b,a and complete is still 1/2')

  await page.click('[data-remove="b"]')
  await expect.page.attribute(page, 'ul li:first-child', 'data-oracle-row-key', 'a')
  await expect.page.text(page, '[data-count="complete"]', '0/1')
  observed.push('after removing b only a remains and complete = 0/1')

  await page.click('[data-action="clear"]')
  await expect.page.exists(page, '[data-empty="true"]')
  await expect.page.text(page, '[data-count="complete"]', '0/0')
  observed.push('after clear the empty branch renders and complete = 0/0')
  return observed
}

/** S3 — event form: a handler that writes twice and settles on one value. */
export async function assertS3(page: PageHandle, expect: ExpectApi): Promise<string[]> {
  const observed: string[] = []
  await expect.page.exists(page, '[data-scenario="s3"] [data-callback-marker="present"]')
  await expect.page.attribute(page, '[data-action="text"]', 'value', 'hello')
  await expect.page.text(page, '[data-writes="true"]', '0')
  observed.push('server-rendered text = hello with writes = 0')

  await page.click('[data-action="submit"]')
  await expect.page.text(page, '[data-writes="true"]', '2')
  observed.push('after submit writes = 2')
  return observed
}

const assertions: Record<
  ScenarioId,
  (page: PageHandle, expect: ExpectApi) => Promise<string[]>
> = { s1: assertS1, s2: assertS2, s3: assertS3 }

/**
 * Runs one scenario end to end: wait for the framework to be able to react,
 * run the shared assertions, then require a clean page (no console errors, no
 * failed requests). A hydration mismatch or a resume failure surfaces as a
 * console error, so the clean-page check is what proves "no warnings".
 */
export async function runScenario(options: {
  readonly scenario: ScenarioId
  readonly page: PageHandle
  readonly expect: ExpectApi
  readonly activation: Activation
}): Promise<{ scenario: ScenarioId; framework: string; activation: string; observed: string[] }> {
  const { scenario, page, expect, activation } = options
  await waitForInteractive(page, expect, activation)
  const observed = await assertions[scenario](page, expect)
  await expect.page.outcome(page, { consoleErrors: 0, failedRequests: 0 })
  observed.push('no console errors and no failed requests')
  return {
    scenario,
    framework: activation.framework,
    activation: activation.kind,
    observed,
  }
}
