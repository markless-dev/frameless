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
 * Every string a lane records is *measured* — read back out of the artifact it
 * names, either the live DOM through `page.content()` or the served payload
 * through `EnvironmentResponse.text` — never a literal pushed alongside an
 * assertion. That matters because `scripts/e2e.mjs` diffs the four lanes'
 * recorded observations against each other: with literals the diff is
 * tautological and can only catch a lane skipping a scenario, while with
 * measured values it compares data the four frameworks actually produced.
 *
 * An observation must be read at the site its own name claims. `server-rendered
 * text` read out of the post-activation DOM was the fault this file was
 * repaired for; see `assertS3` and `measureServedAttribute`.
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
//
// These readers take a *string*, so they are site-agnostic on purpose: the same
// three run over the live DOM and over `EnvironmentResponse.text`, the bytes the
// server sent before any JavaScript ran. Which site a reading came from is part
// of what the reading means, and it is the caller — never the reader — that
// knows. So no message down here may name a site, and every caller must name
// the one it handed over. See `measureServedAttribute`.
// ---------------------------------------------------------------------------

function locate(html: string, marker: string): { tag: string; open: number; afterOpen: number } {
  const at = html.indexOf(marker)
  if (at === -1) {
    throw new Error(
      `Cannot measure: the HTML passed to this reader carries no ${marker}. ` +
        'The reader is site-agnostic — it runs over both the live DOM and the served ' +
        'payload — so the caller names which one it handed over.',
    )
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

/**
 * One attribute, read out of the bytes the **server** sent, asserted exactly,
 * and calibrated two-sided on every single call.
 *
 * This exists because `measureAttribute` cannot say where its string came from
 * and an observation named `server-rendered` has to come from the server. It
 * takes the whole `EnvironmentResponse` rather than `served.text` so that every
 * message it raises can name the payload it read, which is the half of the
 * repair that outlives the specific attribute.
 *
 * Three checks, in order, and each one is load-bearing:
 *
 * 1. The marker is in the payload at all. A missing marker here means the
 *    server never rendered the element, which is a different failure from
 *    activation having removed it, and the message says so.
 * 2. The attribute reads exactly `equals`. Cross-lane equality alone cannot
 *    pin this — four lanes that all served the wrong string would still agree —
 *    so the exact assertion has to be here, at the same site, for every lane.
 * 3. **Instrument rule 3, two-sided**, and run on every call rather than once
 *    from a box, so no lane can hold the check and skip its calibration. Both
 *    negative arms mutate the *evidence* — the payload the server really sent —
 *    never the literal:
 *
 *    - **Payload-wide.** Every `name="equals"` deleted; the same read must stop
 *      returning `equals`. This is `calibrateServedClientEntry`'s arm, and it
 *      carries the same two vacuity guards, because a control that always
 *      passes by construction proves nothing.
 *    - **Scoped.** `name="equals"` deleted from the marked element's start tag
 *      *only*, with every other occurrence in the payload left intact; the read
 *      must still reject. This one is not tautological: it is what separates
 *      "the marked element carries the attribute" from "the string appears
 *      somewhere in the bytes", and it is exactly the discrimination an
 *      unscoped `contains` check would silently lose.
 *
 * It deliberately does not route through `expect.response.matches`. That would
 * add a receipt statement that can never fail independently of check 2 — and a
 * check that cannot go red is not a check. `forbidInServedPayload` is hand-
 * rolled on the served payload for the same reason.
 */
export function measureServedAttribute(options: {
  readonly served: EnvironmentResponse
  readonly marker: string
  readonly name: string
  readonly equals: string
}): string {
  const { served, marker, name, equals } = options
  const text = served.text
  if (!text.includes(marker)) {
    throw new Error(
      `Cannot measure ${name}: the payload served for ${served.path} carries no ${marker}. ` +
        'This reads the bytes the server sent, before any JavaScript ran, so a missing ' +
        'marker means the server never rendered the element — not that activation removed it.',
    )
  }
  const found = measureAttribute(text, marker, name)
  if (found !== equals) {
    throw new Error(
      `The payload served for ${served.path} carries ${name}=${JSON.stringify(found)} on ` +
        `${marker}, not ${JSON.stringify(equals)}. This is the server's own output: the ` +
        'string has to be in the bytes the server sent, not merely in the DOM afterwards.',
    )
  }
  const occurrence = `${name}="${equals}"`
  const withoutAttribute = text.split(occurrence).join('')
  if (withoutAttribute.length === text.length) {
    throw new Error(
      `Negative control did not mutate the payload served for ${served.path}: it carries no ` +
        `literal ${occurrence} to delete. The control assumes the read and the deletion agree ` +
        'on what the attribute looks like; if `measureAttribute` stops requiring that verbatim ' +
        'substring, this fires rather than letting the control go vacuous unnoticed.',
    )
  }
  if (measureAttribute(withoutAttribute, marker, name) === equals) {
    throw new Error(
      `The served-${name} check for ${marker} cannot go red: a payload with every ` +
        `${occurrence} deleted still reads ${equals}. A payload read never observed failing ` +
        'is not a check.',
    )
  }
  // Scoped arm: strip the attribute from the marked element's own start tag and
  // leave the rest of the payload alone. A read that is really about this
  // element rejects; one satisfied by the string appearing anywhere does not.
  const { open, afterOpen } = locate(text, marker)
  const scopedNegative =
    text.slice(0, open) +
    text.slice(open, afterOpen + 1).split(occurrence).join('') +
    text.slice(afterOpen + 1)
  if (scopedNegative.length === text.length) {
    throw new Error(
      `Negative control did not mutate the start tag carrying ${marker} in the payload served ` +
        `for ${served.path}: ${occurrence} is not inside it, so the scoped control proves nothing.`,
    )
  }
  if (measureAttribute(scopedNegative, marker, name) === equals) {
    throw new Error(
      `The served-${name} check for ${marker} is not scoped to that element: deleting ` +
        `${occurrence} from its start tag still reads ${equals}, so the check would pass on a ` +
        'payload that carries the string somewhere else entirely.',
    )
  }
  return found
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
 * The two-sided conditional-cancellation probe, and why it is shaped this way.
 *
 * `[data-action="cancel-submit"]` below proves *unconditional* cancellation. It
 * cannot distinguish a correct handler from one that cancels **always**, and an
 * always-cancel handler is not hypothetical: it is the exact Solid bug found
 * behind that emitter's own validator, where `normalizeHandler` unshifted an
 * unconditional `preventDefault()` and a conditional policy fired regardless of
 * its guard. A one-sided assertion would have called that correct.
 *
 * So S3 carries two `<details>`, whose `<summary>` handlers differ in **one
 * integer literal** and nothing else:
 *
 * | control | authored guard | a single click |
 * |---|---|---|
 * | `[data-action="cancel-open"]` | `event.detail === 1` | satisfied — cancels |
 * | `[data-action="allow-open"]`  | `event.detail === 2` | not satisfied — does not cancel |
 *
 * Both arms are required, and each fails a different bug: an always-cancel
 * emitter leaves `unguarded` closed, a never-cancel emitter opens `guarded`.
 * Because the only difference between the two handlers is that literal, neither
 * bug can hide behind a structural asymmetry between the controls.
 *
 * The four lanes reach this identically-observed outcome through visibly
 * different emitted forms — React and Solid keep the authored guard verbatim,
 * Qwik synthesises a `sync$()` guard from the IR's condition tree, Svelte emits
 * it in-body. Divergence in form with identity in behaviour is the thesis, and
 * this is the first scenario that tests it on a *conditional*.
 *
 * ## Why `<details>` rather than a form submit or a checkbox
 *
 * The default action has to be *real*, observable through the serialized DOM,
 * and non-destructive — the negative arm deliberately lets its default action
 * run, so it must not navigate the page away mid-scenario the way a second
 * `type="submit"` would. A `<summary>` click's default action toggles the
 * `open` **content attribute** on its `<details>`, which `page.content()`
 * serializes; a checkbox's `checked` is a property no sanctioned witness API
 * can read, and routing it through component state would put four frameworks'
 * synthetic `change` semantics between the guard and the observation. Nothing
 * here binds state, so no framework re-renders these nodes and no lane can
 * "repair" a toggle after the fact.
 *
 * ## Why the assertions are ordered the way they are
 *
 * A summary's activation behaviour runs synchronously at the end of dispatch,
 * so a *failure* to cancel shows up immediately, while an absence of the `open`
 * attribute never "becomes true" and so cannot be waited for. The unguarded arm
 * is therefore clicked second and awaited first: `expect.page.attribute` blocks
 * until `unguarded` really opened, and only then is `guarded` read. The guarded
 * click is by then strictly older than a toggle that has already been observed
 * to land, which is what makes reading `null` evidence rather than a race.
 *
 * That ordering also covers the lane this exists for. Strip `syncPolicy` from
 * S3's IR and Qwik re-emits the pre-fix shape — the guard riding a lazily
 * fetched QRL — and the toggle happens at dispatch, ~100ms before the segment
 * arrives, so `guarded` is already open by the time this reads it.
 */
async function measureConditionalCancellation(
  page: PageHandle,
  expect: ExpectApi,
): Promise<string> {
  await page.click('[data-action="cancel-open"]')
  await page.click('[data-action="allow-open"]')

  // Positive arm first: it is the one that becomes true, so awaiting it is also
  // the settle the negative arm below needs.
  await expect.page.attribute(page, '[data-cancel="unguarded"]', 'open', '')

  const html = await page.content()
  const guarded = measureAttribute(html, 'data-cancel="guarded"', 'open')
  const unguarded = measureAttribute(html, 'data-cancel="unguarded"', 'open')
  if (guarded !== null) {
    throw new Error(
      'clicking [data-action="cancel-open"] left its <details> open, so the guarded ' +
        "handler did not cancel the summary's default action during dispatch. Its whole " +
        'body is `if (event.detail === 1) event.preventDefault()` and a single click ' +
        'carries detail 1, so the guard was satisfied and the cancellation still did not ' +
        'reach the browser in time.',
    )
  }
  if (unguarded !== '') {
    throw new Error(
      'clicking [data-action="allow-open"] left its <details> closed, so a handler guarded ' +
        'on `event.detail === 2` cancelled a click carrying detail 1. That is cancellation ' +
        'firing unconditionally — the guard was discarded somewhere between the IR and the ' +
        'emitted output.',
    )
  }
  return (
    `after conditional clicks guarded details reads open=${JSON.stringify(guarded)} ` +
    `and unguarded details reads open=${JSON.stringify(unguarded)}`
  )
}

/**
 * S3 — event form: a handler that writes twice and settles on one value, then a
 * handler that cancels a real default action.
 *
 * ## What is measured, and where
 *
 * Two independent things, at two different sites, and the sites are the point:
 *
 * - `text` is read out of the **served payload** — the bytes the server sent
 *   for this path, before any JavaScript ran. The observation is called
 *   `server-rendered text`, so the server is where it has to be read.
 * - `writes` is read out of the **live DOM**. It is live state: it starts at 0,
 *   the submit handler drives it to 2, and surviving the cancelled submit at 2
 *   is the second, independent signal that no reload happened. Reading it
 *   anywhere else would be the same mistake in the other direction.
 *
 * ## Why the `text` site moved
 *
 * It used to be read from `page.content()` — the *post-activation* DOM — while
 * being reported as `server-rendered`. The name and the measurement site
 * disagreed, and that was true of this file before a fourth lane existed; it
 * only surfaced when Svelte became the first framework in the repo whose
 * hydration deletes the `value` attribute by design (`remove_input_defaults`,
 * guarded by `if (!hydrating) return`, which is why the direct-mount browser
 * lanes never saw it).
 *
 * Reading the served payload is **stronger on the class this repo is about**
 * (see the correction below — it is a uniform trade, not a superset): a
 * lane that client-side-rendered the input from scratch, sending nothing, would
 * still show `value="hello"` in the live DOM and pass the old read. Under this
 * one the string must be in the server's own bytes. That is this repo's whole
 * thesis — inert markup plus activation — measured at the site the thesis is
 * about, which `assertServedActivation` already fetches. It is uniform: same
 * site, same predicate, same exact string, all four lanes, no per-lane
 * declaration inside the compared observations.
 *
 * ## What is no longer observed, and when to re-open
 *
 * After the move, **no lane observes S3's `text` in the live DOM at all**.
 * Emitted S3 surfaces `text` only through `value={text}`, an input *property*
 * after activation, and no sanctioned witness API can read a DOM property:
 * `PageHandle` exposes no `evaluate` and `expect.page.*` has no property
 * accessor. S3's live coverage of `text` therefore narrows to the submit
 * handler's `onTrace` payload, which the analyzer lane checks.
 *
 * Corrected 2026-07-27. This paragraph used to end "the old read never witnessed
 * client state either, since the attribute survives the SSR parse independently
 * of framework state in every lane". That is refuted by our own emitted output.
 * Per lane, what the old live-DOM read actually saw after activation:
 *
 *   react   frozen SSR markup, never rewritten
 *   qwik    frozen SSR markup, never rewritten
 *   svelte  removed by `remove_input_defaults`, by design
 *   solid   `attr:value={text()}` — a SIGNAL-TRACKED content attribute
 *
 * `packages/frameworks/solid/generated/S3.jsx:20` emits `attr:value={text()}`
 * beside `value={text()}`; `attr:` is Solid's documented "write the content
 * attribute" namespace and it tracks. That is what DEFECTS.md finding 5
 * measured. So in the Solid lane the old read DID witness post-hydration state:
 * a mis-seeded `text` would have rewritten the attribute and gone red.
 *
 * The move is therefore a uniform TRADE, not a superset. It gains, in all four
 * lanes, the class "markup the server never sent"; it loses, in one lane, the
 * class "S3's `text` seeded wrong at hydration, Solid only". For react, qwik and
 * svelte the gap below was *revealed* by the site correction; for solid it was
 * *caused* by it.
 *
 * The trade is legitimate and is not to be re-litigated here: the name/site
 * mismatch it fixes (`server-rendered text` reported from `await page.content()`)
 * is provable from this file alone and predates the Svelte lane, and the lost
 * class was never a declared claim — it was the incidental byproduct of one
 * framework's `attr:` idiom. The full ruling is in
 * `docs/goals/frameless-svelte-v1/notes/T006-value-attribute-ruling.md`.
 *
 * Re-open when any of: `@async/witness` exposes a property or `evaluate`
 * accessor on `PageHandle`; the corpus grows a scenario rendering state as
 * *text* rather than only as an input value; or a state-seeding hydration bug
 * is suspected in any lane — that last trigger IS the lost class named above.
 *
 * (Latent twin, recorded so it is not rediscovered as a new finding: Svelte's
 * `remove_input_defaults` strips `checked` identically. S3's checkbox carries
 * `checked={checked}` and is not asserted, so there is no impact today.)
 *
 * ## Cancellation
 *
 * The cancellation step is deliberately last. Everything above it is S3's
 * original oracle and still runs, and still passes, for all four frameworks
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
 *
 * ## Conditional cancellation
 *
 * That step still only proves the *unconditional* case, and would pass against
 * a handler that cancels always. `measureConditionalCancellation` runs after it
 * and is two-sided; see its own doc comment for the design and for why neither
 * arm alone is a check. It is the last step in S3 for the same reason the
 * unconditional one is: everything above it has already run and passed.
 *
 * Its controls are outside the analyzer's S3 action list too, and additionally
 * outside its reach: the guards read `event.detail`, which a real browser sets
 * to 1 for a user click and a constructed `MouseEvent` leaves at 0. This
 * distinction only exists in a real browser driving real activation behaviour,
 * which is exactly why the behavioural lane and not the calibration lane owns
 * it.
 */
export async function assertS3(
  page: PageHandle,
  expect: ExpectApi,
  served: EnvironmentResponse,
): Promise<string[]> {
  const observed: string[] = []
  await expect.page.exists(page, '[data-scenario="s3"] [data-callback-marker="present"]')
  await expect.page.text(page, '[data-writes="true"]', '0')
  // The server's own bytes, asserted exactly and calibrated two-sided on this
  // call. The live DOM below is a different site and answers a different
  // question — see this function's doc comment.
  const servedText = measureServedAttribute({
    served,
    marker: 'data-action="text"',
    name: 'value',
    equals: 'hello',
  })
  const initial = await page.content()
  observed.push(
    `server-rendered text = ${servedText} ` +
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

  // Conditional cancellation, two-sided. Last, for the same reason the
  // unconditional step is: everything above has already run and passed.
  observed.push(await measureConditionalCancellation(page, expect))
  return observed
}

/**
 * Every scenario is handed both sites — the live page and the payload the
 * server sent for it — and reads each observation from the one it names. S1 and
 * S2 observe only live state and declare two parameters; S3 observes both.
 */
const assertions: Record<
  ScenarioId,
  (page: PageHandle, expect: ExpectApi, served: EnvironmentResponse) => Promise<string[]>
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
 *
 * `served` is **required**, for the reason `servedClientEntry` is a total
 * `Record`: an optional field is a silent opt-out, and a scenario that reads
 * the served payload cannot be handed `undefined` and fall back to the live DOM
 * without recreating the exact fault this contract was repaired for. It is the
 * same `EnvironmentResponse` each box already fetched for
 * `assertServedActivation`, so no lane pays for a second request, and every
 * call site already has it in scope.
 */
export async function runScenario(options: {
  readonly scenario: ScenarioId
  readonly page: PageHandle
  readonly expect: ExpectApi
  readonly activation: Activation
  readonly served: EnvironmentResponse
}): Promise<{
  scenario: ScenarioId
  framework: string
  activation: string
  observed: string[]
  evidence: Record<string, unknown>
}> {
  const { scenario, page, expect, activation, served } = options
  await waitForInteractive(page, expect, activation)
  const observed = await assertions[scenario](page, expect, served)

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
