/**
 * The three-way behavior contract.
 *
 * One shared IR compiles to React, Solid and Qwik. What follows is the
 * *observable* outcome the emitted output must produce for each scenario, and
 * all three official demo lanes run this exact sequence. Running one shared
 * contract is what makes the claim a comparison rather than three unrelated
 * tests: if React, Solid and Qwik all pass these steps, they behaved the same.
 *
 * Every string a lane records is *measured* — read back out of the live DOM
 * through `page.content()` — never a literal pushed alongside an assertion.
 * That matters because `scripts/e2e.mjs` diffs the three lanes' recorded
 * observations against each other: with literals the diff is tautological and
 * can only catch a lane skipping a scenario, while with measured values it
 * compares data the three frameworks actually produced.
 *
 * It lives under demos/react-official only because it has to live inside one of
 * the three demo packages. demos/solid-official and demos/qwik import it by
 * relative path, exactly the way demos/ssr imports demos/ui-kit/scenarios.ts.
 */
import type { EnvironmentResponse, ExpectApi, PageHandle } from '@async/witness'

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

/** The attribute React's and Solid's client entries set once activation ran. */
const ACTIVATION_MARKER = 'data-frameless-activated'

// ---------------------------------------------------------------------------
// Measurement
//
// `PageHandle` deliberately exposes no `evaluate`, so a lane reads the live DOM
// back through `page.content()` — a different path from `expect.page.text`,
// which compares the browser's own trimmed textContent. Reading through the
// serialized DOM means a framework that produced the right text via visibly
// different markup still shows up in the cross-lane diff.
// ---------------------------------------------------------------------------

function locate(html: string, marker: string): { tag: string; open: number; afterOpen: number } {
  const at = html.indexOf(marker)
  if (at === -1) {
    throw new Error(`Cannot measure: the live DOM carries no ${marker}.`)
  }
  const open = html.lastIndexOf('<', at)
  const name = /^<([a-zA-Z][a-zA-Z0-9-]*)/.exec(html.slice(open, open + 64))
  if (open === -1 || !name) {
    throw new Error(`Cannot measure: ${marker} is not inside a start tag.`)
  }
  const afterOpen = html.indexOf('>', at)
  if (afterOpen === -1) {
    throw new Error(`Cannot measure: unterminated start tag for ${marker}.`)
  }
  return { tag: name[1], open, afterOpen }
}

/**
 * The text of the element carrying `marker`, with the framework's own hydration
 * bookkeeping removed: React writes `<!--$-->` boundaries and Solid and Qwik
 * split interpolations across comment nodes, so `1<!--x-->/<!--x-->2` and `1/2`
 * must measure the same. Anything else — different text, extra elements with
 * text of their own — survives and diffs.
 */
export function measureText(html: string, marker: string): string {
  const { tag, afterOpen } = locate(html, marker)
  const close = html.indexOf(`</${tag}>`, afterOpen)
  if (close === -1) {
    throw new Error(`Cannot measure: no closing </${tag}> for ${marker}.`)
  }
  return html
    .slice(afterOpen + 1, close)
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** The value of one attribute on the element carrying `marker`. */
export function measureAttribute(html: string, marker: string, name: string): string | null {
  const { open, afterOpen } = locate(html, marker)
  const found = new RegExp(`\\s${name}="([^"]*)"`).exec(html.slice(open, afterOpen))
  return found ? found[1] : null
}

/** Every keyed row identity in the live DOM, in document order. */
export function measureRowKeys(html: string): string[] {
  return [...html.matchAll(/data-oracle-row-key="([^"]*)"/g)].map((match) => match[1])
}

// ---------------------------------------------------------------------------
// Activation evidence
// ---------------------------------------------------------------------------

/**
 * The lazily-pulled handler segment each scenario's clicks must produce.
 *
 * Qwik's qwikloader emits a `qsymbol` DOM event carrying the QRL symbol every
 * time it has to *import* a handler, and it only ever imports one in response
 * to a real event. Asserting these is what makes "Qwik resumes" affirmative
 * evidence rather than the mere presence of `q:container="paused"`, which every
 * Qwik SSR page emits whether or not resumption works.
 *
 * The substrings are deliberately hash-free: the emitted symbol carries a
 * content hash (`..._q_e_click_9Q3eIyNu4eE`) that changes whenever the emitter
 * output changes, but the structural prefix names the element the handler is
 * attached to and is what actually proves *which* handler was pulled.
 *
 * S2's count is 3 because S2 clicks three different buttons. Its `add` button
 * is never clicked and its segment is never fetched — the on-demand claim is
 * exactly that asymmetry.
 */
export const resumeSymbols: Record<
  ScenarioId,
  { readonly includes: string; readonly atLeast: number }
> = {
  s1: { includes: '_component_div_section_button_q_e_click_', atLeast: 1 },
  s2: { includes: '_button_q_e_click_', atLeast: 3 },
  s3: { includes: '_component_form_button_q_e_click_', atLeast: 1 },
}

function forbidInServedPayload(served: EnvironmentResponse, fragments: string[]): void {
  const present = fragments.filter((fragment) => served.text.includes(fragment))
  if (present.length > 0) {
    throw new Error(
      `The payload served for ${served.path} must not contain ${present.join(' or ')}: ` +
        'that string is only ever produced by client-side activation, so its presence in ' +
        'the server response would mean the demo is not proving what it claims.',
    )
  }
}

/**
 * What the *server* sent, before any JavaScript ran. This is where hydrate and
 * resume actually differ, and each side is asserted both ways round:
 *
 * - Qwik must send a paused container and at least one `q-e:click` QRL
 *   attribute — markup that already names its handlers, with nothing to run.
 * - React and Solid must send a client entry module (nothing reacts until it
 *   runs) and must send **neither** `q:container` **nor** the activation
 *   marker: their output is inert until hydration commits.
 *
 * NOTE for anyone documenting this: in @qwik.dev/core 2.0.0-beta.38 the
 * serialized handler attribute is `q-e:click`, not the `on:click` of Qwik 1.
 */
export async function assertServedActivation(options: {
  readonly served: EnvironmentResponse
  readonly expect: ExpectApi
  readonly activation: Activation
}): Promise<Record<string, unknown>> {
  const { served, expect, activation } = options
  await expect.response.matches(served, { status: 200, contentType: 'text/html' })

  if (activation.kind === 'resume') {
    await expect.response.matches(served, { contains: 'q:container="paused"' })
    await expect.response.matches(served, { contains: 'q-e:click="' })
    forbidInServedPayload(served, [ACTIVATION_MARKER])
    return {
      servedContainer: /q:container="([^"]*)"/.exec(served.text)?.[1] ?? null,
      servedClickQrls: (served.text.match(/q-e:click="[^"]*"/g) ?? []).length,
    }
  }

  await expect.response.matches(served, { contains: '/src/entry-client.jsx' })
  forbidInServedPayload(served, ['q:container', ACTIVATION_MARKER])
  return { servedContainer: null, servedClickQrls: 0 }
}

/**
 * Waits until the framework can react, and arms the resume evidence.
 *
 * For Qwik, `trackEvents('qsymbol')` must happen *before* the first click so
 * that every handler import the clicks cause is observed; qwikloader resolves a
 * handler only from an event, so an import seen after this point is by
 * construction an on-demand one.
 */
export async function waitForInteractive(
  page: PageHandle,
  expect: ExpectApi,
  activation: Activation,
): Promise<void> {
  if (activation.kind === 'hydrate') {
    await expect.page.attribute(page, 'html', ACTIVATION_MARKER, activation.framework)
    // The counterpart of the served-payload negative: a hydrating framework
    // never grows a Qwik container, live or served.
    await expect.page.attribute(page, 'html', 'q:container', null)
    return
  }
  // Qwik: no hydration pass to wait for. The document is already a resumable
  // container; what has to be proven is that the handlers are still absent and
  // get pulled on demand, which the tracked qsymbol events below establish.
  await expect.page.exists(page, '[q\\:container]')
  await page.trackEvents('qsymbol')
}

/** S1 — render-once: a derived value and one state transition. */
export async function assertS1(page: PageHandle, expect: ExpectApi): Promise<string[]> {
  const observed: string[] = []
  await expect.page.exists(page, '[data-s1-root] [data-scenario="s1"]')
  await expect.page.text(page, '[data-value="derived"]', 'kit:2')
  observed.push(
    `server-rendered derived = ${measureText(await page.content(), 'data-value="derived"')}`,
  )

  await page.click('[data-action="increment"]')
  await expect.page.text(page, '[data-value="derived"]', 'kit:4')
  observed.push(
    `after one increment click derived = ${measureText(await page.content(), 'data-value="derived"')}`,
  )
  return observed
}

/** The keyed-list state as the live DOM currently serializes it. */
async function measureList(page: PageHandle): Promise<{ keys: string; complete: string }> {
  const html = await page.content()
  return {
    keys: measureRowKeys(html).join(','),
    complete: measureText(html, 'data-count="complete"'),
  }
}

/** S2 — keyed list: identity-preserving reorder, removal, and clear. */
export async function assertS2(page: PageHandle, expect: ExpectApi): Promise<string[]> {
  const observed: string[] = []
  await expect.page.exists(page, '[data-scenario="s2"]')
  await expect.page.text(page, '[data-count="complete"]', '1/2')
  await expect.page.attribute(page, 'ul li:first-child', 'data-oracle-row-key', 'a')
  await expect.page.attribute(page, 'ul li:last-child', 'data-oracle-row-key', 'b')
  const initial = await measureList(page)
  observed.push(`server-rendered rows ${initial.keys} with complete = ${initial.complete}`)

  await page.click('[data-action="reorder"]')
  await expect.page.attribute(page, 'ul li:first-child', 'data-oracle-row-key', 'b')
  await expect.page.attribute(page, 'ul li:last-child', 'data-oracle-row-key', 'a')
  await expect.page.text(page, '[data-count="complete"]', '1/2')
  const reordered = await measureList(page)
  observed.push(
    `after reorder rows are ${reordered.keys} and complete is still ${reordered.complete}`,
  )

  await page.click('[data-remove="b"]')
  await expect.page.attribute(page, 'ul li:first-child', 'data-oracle-row-key', 'a')
  await expect.page.text(page, '[data-count="complete"]', '0/1')
  const removed = await measureList(page)
  observed.push(`after removing b only ${removed.keys} remains and complete = ${removed.complete}`)

  await page.click('[data-action="clear"]')
  await expect.page.exists(page, '[data-empty="true"]')
  await expect.page.text(page, '[data-count="complete"]', '0/0')
  const cleared = await page.content()
  observed.push(
    `after clear the ${measureText(cleared, 'data-empty="true"')} branch renders and ` +
      `complete = ${measureText(cleared, 'data-count="complete"')}`,
  )
  return observed
}

/** S3 — event form: a handler that writes twice and settles on one value. */
export async function assertS3(page: PageHandle, expect: ExpectApi): Promise<string[]> {
  const observed: string[] = []
  await expect.page.exists(page, '[data-scenario="s3"] [data-callback-marker="present"]')
  await expect.page.attribute(page, '[data-action="text"]', 'value', 'hello')
  await expect.page.text(page, '[data-writes="true"]', '0')
  const initial = await page.content()
  observed.push(
    `server-rendered text = ${measureAttribute(initial, 'data-action="text"', 'value')} ` +
      `with writes = ${measureText(initial, 'data-writes="true"')}`,
  )

  await page.click('[data-action="submit"]')
  await expect.page.text(page, '[data-writes="true"]', '2')
  observed.push(
    `after submit writes = ${measureText(await page.content(), 'data-writes="true"')}`,
  )
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
 *
 * Two checks are parameterised by activation because the frameworks genuinely
 * differ, and leaving either silent is what let the resume claim rest on a
 * substring:
 *
 * - `navigations`: React and Solid record 0, Qwik records 1. Each page — in all
 *   three frameworks — issues exactly **one** `resourceType: 'Document'`
 *   request, asserted below, so Qwik's extra navigation is the Qwik router
 *   pushing a same-URL history entry and **not** a reload. Benign, but now
 *   asserted per framework instead of left unexplained.
 * - `events.qsymbol`: Qwik only. The handler QRLs the clicks pulled, by name.
 */
export async function runScenario(options: {
  readonly scenario: ScenarioId
  readonly page: PageHandle
  readonly expect: ExpectApi
  readonly activation: Activation
}): Promise<{
  scenario: ScenarioId
  framework: string
  activation: string
  observed: string[]
  evidence: Record<string, unknown>
}> {
  const { scenario, page, expect, activation } = options
  await waitForInteractive(page, expect, activation)
  const observed = await assertions[scenario](page, expect)

  const requests = await page.networkRequests()
  const documents = requests.filter((request) => request.resourceType === 'Document')
  if (documents.length !== 1) {
    throw new Error(
      `${activation.framework} ${scenario} issued ${documents.length} Document requests; ` +
        'exactly one means the page was never reloaded.',
    )
  }
  observed.push(`${documents.length} document request served this page`)

  const evidence: Record<string, unknown> = {
    documentRequests: documents.length,
    navigations: activation.kind === 'resume' ? 1 : 0,
  }

  if (activation.kind === 'resume') {
    // The resume transition, observed. The served payload was `paused` (see
    // assertServedActivation); the same container now reads `resumed`.
    // Asserting both ends is strictly stronger than asserting either.
    await expect.page.attribute(page, 'html', 'q:container', 'resumed')
    const live = await page.content()
    evidence.liveContainer = /q:container="([^"]*)"/.exec(live)?.[1] ?? null
    evidence.handlerSegments = requests
      .map((request) => request.url)
      .filter((url) => url.includes('_q_e_click_'))
      .map((url) => url.slice(url.lastIndexOf('/') + 1))
  }

  await expect.page.outcome(page, {
    navigations: activation.kind === 'resume' ? 1 : 0,
    consoleErrors: 0,
    failedRequests: 0,
    ...(activation.kind === 'resume'
      ? {
          events: {
            qsymbol: {
              atLeast: resumeSymbols[scenario].atLeast,
              detailIncludes: resumeSymbols[scenario].includes,
            },
          },
        }
      : {}),
  })
  observed.push('no console errors and no failed requests')

  return {
    scenario,
    framework: activation.framework,
    activation: activation.kind,
    observed,
    evidence,
  }
}
