/**
 * The cross-framework behavior contract.
 *
 * One shared IR compiles to React, Solid, Qwik and Svelte. What follows is the
 * *observable* outcome the emitted output must produce for each scenario, and
 * all four official demo lanes run this exact sequence. Running one shared
 * contract is what makes the claim a comparison rather than four unrelated
 * tests: if React, Solid, Qwik and Svelte all pass these steps, they behaved
 * the same. The `three-way` tag and the `three-way-results` note kind are the
 * wire protocol `scripts/e2e.mjs` reads and are deliberately left unrenamed.
 *
 * Every string a lane records is *measured* — read back out of the live DOM
 * through `page.content()` — never a literal pushed alongside an assertion.
 * That matters because `scripts/e2e.mjs` diffs the three lanes' recorded
 * observations against each other: with literals the diff is tautological and
 * can only catch a lane skipping a scenario, while with measured values it
 * compares data the three frameworks actually produced.
 *
 * It lives under demos/react-official only because it has to live inside one of
 * the demo packages. demos/solid-official, demos/qwik and demos/svelte-official
 * import it by relative path, exactly the way demos/ssr imports
 * demos/ui-kit/scenarios.ts.
 */
import type { EnvironmentResponse, ExpectApi, PageHandle } from '@async/witness'

export type ScenarioId = 's1' | 's2' | 's3'

export const scenarioIds: readonly ScenarioId[] = ['s1', 's2', 's3']

/**
 * How each framework becomes interactive. React, Solid and Svelte hydrate, so
 * the lane waits for the hydration marker their client entry sets before it
 * clicks; Qwik resumes, so there is nothing to wait for — qwikloader buffers
 * the event and pulls the handler on demand. That asymmetry is the thesis, not
 * a defect, and it is the only thing the four lanes do differently.
 */
export type Activation =
  | { readonly kind: 'hydrate'; readonly framework: 'react' | 'solid' | 'svelte' }
  | { readonly kind: 'resume'; readonly framework: 'qwik' }

export type HydrateFramework = Extract<Activation, { kind: 'hydrate' }>['framework']

/** The attribute a hydrating demo's client sets once activation ran. */
const ACTIVATION_MARKER = 'data-frameless-activated'

/**
 * The client-entry module string each hydrating lane's server must have sent.
 *
 * This is **not** an activation-neutrality claim — the two negatives in
 * `assertServedActivation` are. It is a *lane-identity* claim: proof that the
 * payload the browser received is inert markup plus a module that has not run
 * yet. React and Solid share the literal only because their scaffolds happen to
 * name their entry identically; SvelteKit owns its client entry and cannot
 * produce `/src/entry-client.jsx` at all, so the literal is per lane.
 *
 * Parameterised, not relaxed. The assertion is still an exact substring of the
 * served payload, so each lane makes the identical claim at its own literal;
 * softening it to "any module script" would have been a weakening and is not
 * what happened here. React's and Solid's asserted strings are byte-unchanged.
 *
 * A **total** `Record` is what makes this required rather than optional: adding
 * a framework to `HydrateFramework` without adding its literal is a type error,
 * so no lane can silently opt out. There is no default and no `??` fallback.
 *
 * The Svelte literal was *measured*, not guessed — read out of what
 * `vite dev` actually served for `/` at @sveltejs/kit 2.70.1 (the resolution of
 * the scaffold's `^2.63.0`), where SvelteKit's inline bootstrap imports
 * `.../@sveltejs/kit/src/runtime/client/entry.js` before calling `kit.start`.
 * `demos/svelte-official/scenarios.box.ts` calls `calibrateServedClientEntry`
 * on every run to prove the check can still go red.
 */
const servedClientEntry: Readonly<Record<HydrateFramework, string>> = {
  react: '/src/entry-client.jsx',
  solid: '/src/entry-client.jsx',
  svelte: '@sveltejs/kit/src/runtime/client/entry.js',
}

/**
 * Main-frame navigations each lane must record *after* the initial load.
 *
 * Every lane issues exactly one `resourceType: 'Document'` request — asserted
 * separately in `runScenario` — so a non-zero count here is a client router
 * writing a same-URL history entry as it takes over, never a reload. React and
 * Solid ship no router and record 0. Qwik's router records 1. SvelteKit's
 * records 1 for the same reason, *measured*: its single navigation is to the
 * identical URL the page was opened at (`http://127.0.0.1:5173/` → the same),
 * alongside exactly one Document request, which is `kit.start` adopting the
 * initial history entry.
 *
 * Declared per lane and asserted exactly, never relaxed to "any number". That
 * matters most for the lane that needed the widening: a Svelte reload would
 * also show up as a navigation, and only an exact expected count distinguishes
 * "the router adopted the page" from "the page reloaded under us". React's,
 * Solid's and Qwik's numbers are byte-unchanged from `resume ? 1 : 0`.
 *
 * Total `Record`, for the same reason as `servedClientEntry`: a new framework
 * must declare a number or the code does not compile.
 */
const expectedNavigations: Readonly<Record<Activation['framework'], number>> = {
  react: 0,
  solid: 0,
  qwik: 1,
  svelte: 1,
}

/**
 * The predicate behind the served-client-entry claim.
 *
 * `expect.response.matches(served, { contains })` is `response.text.includes(contains)`
 * (@async/witness 0.7.0). Naming it here lets the negative control below drive
 * the *same* predicate without routing a deliberate failure through `expect`,
 * which would record a permanent `assertion failed` statement against the run
 * and flag the box contested even though the box caught it.
 */
function payloadCarriesClientEntry(text: string, entry: string): boolean {
  return text.includes(entry)
}

/**
 * Instrument rule 3, two-sided: a served-payload literal never observed failing
 * is not a check.
 *
 * The positive arm runs the same predicate the assertion runs. The negative arm
 * mutates the *evidence* rather than the literal — it deletes every occurrence
 * of the entry from the payload the server really sent and requires the
 * predicate to reject it. That is the failure this check exists to catch: if
 * SvelteKit stops serving that module, or serves a bundled chunk instead, the
 * lane goes red rather than passing on a string nobody watches.
 */
export function calibrateServedClientEntry(options: {
  readonly served: EnvironmentResponse
  readonly framework: HydrateFramework
}): Record<string, unknown> {
  const entry = servedClientEntry[options.framework]
  const text = options.served.text
  if (!payloadCarriesClientEntry(text, entry)) {
    throw new Error(
      `The payload served for ${options.served.path} does not contain ${entry}, so the ` +
        `${options.framework} lane cannot be identified by its client entry.`,
    )
  }
  const withoutEntry = text.split(entry).join('')
  if (withoutEntry.length === text.length) {
    throw new Error(`Negative control did not mutate the payload for ${entry}.`)
  }
  if (payloadCarriesClientEntry(withoutEntry, entry)) {
    throw new Error(
      `The served-client-entry check for ${options.framework} cannot go red: a payload with ` +
        `every occurrence of ${entry} removed still satisfies it.`,
    )
  }
  return {
    servedClientEntry: entry,
    servedClientEntryOccurrences: text.split(entry).length - 1,
    negativeControl: `payload with ${entry} deleted is rejected`,
  }
}

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
 * - React, Solid and Svelte must send their own client entry module (nothing
 *   reacts until it runs) and must send **neither** `q:container` **nor** the
 *   activation marker: their output is inert until hydration commits. The two
 *   negatives are the neutrality claims and are identical for every lane; only
 *   the entry literal is per lane, and only because the scaffolds name it
 *   differently. See `servedClientEntry`.
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

  await expect.response.matches(served, {
    contains: servedClientEntry[activation.framework],
  })
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

/** How long a not-yet-cancelled default action is given to show itself. */
const CANCELLATION_SETTLE_MS = 2_000

/**
 * The Document requests this page has issued, read after the browser has had a
 * bounded chance to act on a click that carried a default action.
 *
 * `page.click` returns once the click is dispatched, not once anything the click
 * *started* has finished, so reading the network log straight afterwards races a
 * navigation that has been kicked off but not yet committed. Measured in the
 * Qwik lane, the submit's Document request lands ~35ms after the click returns —
 * comfortably late enough for an immediate read to see a clean page and report a
 * pass. Every `expect.page.*` primitive waits *until* a condition becomes true,
 * and "no navigation happened" never becomes true, so the wait has to be here.
 *
 * It exits as soon as a second Document request appears, so the deadline is only
 * ever paid by a lane that genuinely cancelled.
 */
async function settleAfterCancellableClick(page: PageHandle) {
  const deadline = Date.now() + CANCELLATION_SETTLE_MS
  let documents = await documentRequests(page)
  while (documents.length === 1 && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 25))
    documents = await documentRequests(page)
  }
  return documents
}

async function documentRequests(page: PageHandle) {
  const requests = await page.networkRequests()
  return requests.filter((request) => request.resourceType === 'Document')
}

/**
 * S3 — event form: a handler that writes twice and settles on one value, then a
 * handler that cancels a real default action.
 *
 * The cancellation step is deliberately last. Everything above it is S3's
 * original oracle and still runs, and still passes, for all three frameworks
 * before anything is submitted — the channel below is added, not traded.
 *
 * Why it is here at all: until now the only `preventDefault()` in the corpus sat
 * on a `<button type="button">`, which has no activation behavior, so no target
 * had ever been asked to avert a default action. The analyzer's cancellation
 * check reads `event.defaultPrevented`, which records only that the call *was
 * made* — a late handler that calls it after the browser already navigated still
 * sets the flag. `[data-action="cancel-submit"]` is a `<button type="submit">`
 * inside the form, so its default action is a real GET navigation to the current
 * URL, and the only thing standing between the click and a reload is the
 * handler running *during* dispatch.
 *
 * The analyzer's S3 action list never clicks it (`packages/analyzer/src/scenarios.ts`).
 * That is load-bearing: the `missing-prevent-default` mutant deliberately drops
 * the call, and a calibration lane that submitted for real would navigate the
 * vitest page away instead of reporting a divergence.
 */
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

  // Cancellation, observed behaviorally rather than through a flag.
  await page.click('[data-action="cancel-submit"]')
  const documents = await settleAfterCancellableClick(page)
  if (documents.length !== 1) {
    throw new Error(
      `clicking [data-action="cancel-submit"] left ${documents.length} Document requests on ` +
        'this page; exactly one means the form submit never reached the network. The ' +
        "handler's entire body is event.preventDefault(), so a second Document request " +
        'means the default action ran before the handler did.',
    )
  }
  // The page survived the click: still the same document, still the state the
  // submit handler left behind. A reload would rebuild the form from the server
  // and reset writes to 0, so reading 2 back is the second, independent signal.
  await expect.page.exists(page, '[data-scenario="s3"]')
  await expect.page.text(page, '[data-writes="true"]', '2')
  observed.push(
    `after cancel-submit ${documents.length} document request served this page and ` +
      `writes = ${measureText(await page.content(), 'data-writes="true"')}`,
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
 * console error, so the clean-page check is what catches those.
 *
 * What it does **not** catch: `console.warn`. @async/witness 0.7.0 exposes
 * `consoleErrors` only, and `PageHandle` has no console accessor at all, so no
 * witness lane can observe a warning. That matters for Svelte, which reports
 * `ownership_invalid_mutation` and `state_unsafe_mutation` as warnings.
 * `demos/svelte-official` therefore installs its own in-page sink and reflects
 * the count onto an attribute this contract can read; see
 * `demos/svelte-official/src/hooks.client.ts` and the T004 note. React, Solid
 * and Qwik have no equivalent sink and are unchanged.
 *
 * Two checks are parameterised by activation because the frameworks genuinely
 * differ, and leaving either silent is what let the resume claim rest on a
 * substring:
 *
 * - `navigations`: React and Solid record 0, Qwik and Svelte record 1. Each
 *   page — in all four frameworks — issues exactly **one**
 *   `resourceType: 'Document'` request, asserted below, so the routed lanes'
 *   extra navigation is a client router taking over a same-URL history entry
 *   and **not** a reload. Declared per lane in `expectedNavigations` and
 *   asserted exactly, never relaxed.
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
    navigations: expectedNavigations[activation.framework],
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
    navigations: expectedNavigations[activation.framework],
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
