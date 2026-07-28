/**
 * The cross-framework behavior contract.
 *
 * One shared IR compiles to React, Solid, Qwik, Svelte, Vue and Angular. What
 * follows is the *observable* outcome the emitted output must produce for each
 * scenario,
 * and all six official demo lanes run this exact sequence. Running one shared
 * contract is what makes the claim a comparison rather than six unrelated
 * tests: if React, Solid, Qwik, Svelte, Vue and Angular all pass these steps,
 * they behaved the same. The `three-way` tag and the `three-way-results` note kind
 * are the wire protocol `scripts/e2e.mjs` reads and are deliberately left
 * unrenamed.
 *
 * Every string a lane records is *measured* — read back out of the artifact it
 * names, either the live DOM through `page.content()` or the served payload
 * through `EnvironmentResponse.text` — never a literal pushed alongside an
 * assertion. That matters because `scripts/e2e.mjs` diffs the six lanes'
 * recorded observations against each other: with literals the diff is
 * tautological and can only catch a lane skipping a scenario, while with
 * measured values it compares data the six frameworks actually produced.
 *
 * An observation must be read at the site its own name claims. `server-rendered
 * text` read out of the post-activation DOM was the fault this file was
 * repaired for; see `assertS3` and `measureServedAttribute`.
 *
 * It lives under demos/react-official only because it has to live inside one of
 * the demo packages. demos/solid-official, demos/qwik, demos/svelte-official,
 * demos/vue-official and demos/angular-official import it by relative path,
 * exactly the way demos/ssr imports demos/ui-kit/scenarios.ts.
 */
import type { EnvironmentResponse, ExpectApi, PageHandle } from '@async/witness'

export type ScenarioId = 's1' | 's2' | 's3' | 's4' | 's5' | 's6' | 's7' | 's9'

export const scenarioIds: readonly ScenarioId[] = ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's9']

/**
 * How each framework becomes interactive. React, Solid, Svelte, Vue and Angular
 * hydrate, so the lane waits for the hydration marker their client entry sets
 * before it clicks; Qwik resumes, so there is nothing to wait for — qwikloader buffers
 * the event and pulls the handler on demand. That asymmetry is the thesis, not
 * a defect, and it is the only thing the six lanes do differently.
 */
export type Activation =
  | {
      readonly kind: 'hydrate'
      readonly framework: 'react' | 'solid' | 'svelte' | 'vue' | 'angular'
    }
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
 *
 * The Vue literal was measured the same way and is deliberately NOT inherited
 * from react/solid: `create-vite-extra@5.0.2`'s `template-ssr-vue-ts` is a
 * TypeScript template, so its `index.html` names `/src/entry-client.ts`, and it
 * survives `vite.transformIndexHtml` verbatim in dev — read out of the payloads
 * `demos/vue-official` actually served for `/`, `/s2` and `/s3`, once each.
 * `demos/vue-official/scenarios.box.ts` calls `calibrateServedClientEntry` on
 * every scenario for the same reason the Svelte lane does.
 *
 * The Angular literal is the whole script tag, and it too was measured — read
 * out of the payloads `demos/angular-official` actually served for `/`, `/s2`
 * and `/s3`, once each. Angular owns its build, so the literal is a property of
 * the build the lane runs: `ng build --configuration development` leaves
 * `outputHashing` at its default of `none`, so the CLI's own `index.html`
 * transform emits `<script src="main.js" type="module"></script>` verbatim. The
 * `production` configuration sets `outputHashing: "all"` and would name a
 * content-hashed chunk instead, which is exactly why the lane declares its own
 * `build:e2e` script rather than reusing `build`. If Angular ever hashes in the
 * development configuration this assertion goes red, which is the intended
 * behaviour and not a reason to relax it to "any module script" — the paragraph
 * above rules that out in those words.
 */
const servedClientEntry: Readonly<Record<HydrateFramework, string>> = {
  react: '/src/entry-client.jsx',
  solid: '/src/entry-client.jsx',
  svelte: '@sveltejs/kit/src/runtime/client/entry.js',
  vue: '/src/entry-client.ts',
  angular: '<script src="main.js" type="module"></script>',
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
 * Vue records 0, *measured* — not inherited from react and solid on the grounds
 * that they run the same template family. `create-vite-extra`'s
 * `template-ssr-vue-ts` ships no router (that is one of the reasons T002 ruled
 * against Nuxt, which would have brought vue-router and pushed this to 1), and
 * `demos/vue-official` adds none: `src/App.vue` branches on a `url` prop that
 * `render(url)` and `window.location.pathname` supply. The number below was read
 * off the run, not derived from that.
 *
 * Angular records 0, and this is the one number on this table that was NOT
 * predictable from whether the lane ships a router. It does: `provideRouter` is
 * in the scaffold and `demos/angular-official` puts all three scenarios behind
 * real routes. It still records 0, because Angular's initial navigation adopts
 * the existing history entry without writing a new one — which is what the Qwik
 * and SvelteKit routers do NOT do. MEASURED, and the flip was measured too: with
 * `angular: 1` declared, the lane goes red with `navigations: expected 1,
 * observed 0`. That is this entry's two-sided calibration and it was taken on
 * this lane, not inherited from the two lanes that also record 0.
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
  vue: 0,
  angular: 0,
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

/**
 * The text of the element carrying `marker`, WITH ITS WHITESPACE INTACT.
 *
 * Deliberately NOT a parameter on `measureText`, and deliberately not a
 * refactor of it. `measureText` ends `.replace(/\s+/g, ' ').trim()`, which is
 * correct for every scenario whose observable is the VALUE rendered — S1's
 * `kit:2` reads the same however a framework laid the markup out, and five
 * scenarios' worth of recorded observation strings depend on that reading
 * staying byte-identical. It is also exactly the normalisation S6 exists to
 * measure, so a shared reader would have made this scenario unable to fail.
 *
 * The comment and tag stripping is retained and is not optional: React writes
 * `<!-- -->` between adjacent text children, Solid wraps every interpolation in
 * `<!--$-->…<!--/-->`, Qwik and Angular write their own markers, and
 * `1<!-- -->/<!-- -->2` and `1/2` have to measure the same. What must NOT be
 * stripped is whitespace, because whitespace is the observation.
 *
 * Two independent instruments end up on this scenario, which is the point: this
 * one reads the SERIALIZED DOM through `page.content()` and preserves
 * everything, while `expect.page.text` compares `el.textContent.trim()` in the
 * browser. Every S6 marker's text begins and ends with a non-space character, so
 * the trim in the second one removes nothing and the two must agree.
 */
export function measureExactText(html: string, marker: string): string {
  const { tag, afterOpen } = locate(html, marker)
  const close = html.indexOf(`</${tag}>`, afterOpen)
  if (close === -1) {
    throw new Error(`Cannot measure: no closing </${tag}> for ${marker}.`)
  }
  return html
    .slice(afterOpen + 1, close)
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]*>/g, '')
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
 * Every value of one key attribute in the string handed over, in document order.
 *
 * Deliberately NOT a refactor of `measureRowKeys` above. S4's inner rows carry
 * `data-oracle-cell-key` precisely so that S2's flat `data-oracle-row-key` read
 * keeps measuring exactly what it measured before a nested list existed; folding
 * the two into one reader would have made S2's observation depend on a function
 * S4 also drives. The duplication is the point.
 */
function measureKeyAttribute(html: string, attribute: string): string[] {
  return [...html.matchAll(new RegExp(`${attribute}="([^"]*)"`, 'g'))].map((match) => match[1])
}

/** Every OUTER group identity in the live DOM, in document order. */
export function measureGroupKeys(html: string): string[] {
  return measureKeyAttribute(html, 'data-oracle-group-key')
}

/**
 * Every row identity inside S5's branch arm, in document order.
 *
 * A THIRD key attribute, for the same reason S4 introduced the second one.
 * `measureRowKeys` matches `data-oracle-row-key` globally and `measureCellKeys`
 * matches `data-oracle-cell-key`; a scenario reusing either would silently join
 * that scenario's observation string, and S2's and S4's reads have to keep
 * measuring exactly what they measured before S5 existed.
 *
 * Unscoped on purpose, unlike `measureCellKeys`. S5's claim is not containment
 * but PRESENCE: the list lives inside the branch, so after the flip it is gone
 * from the document entirely and this reads `[]`. A scoped read would have to
 * locate a container that is not there and would throw where a measurement of
 * zero rows is the observation.
 */
export function measureBranchKeys(html: string): string[] {
  return measureKeyAttribute(html, 'data-oracle-branch-key')
}

/**
 * Every row identity in S6's list, in document order.
 *
 * A FOURTH key attribute, for the reason the second and third exist:
 * `measureRowKeys`, `measureCellKeys` and `measureBranchKeys` each match their
 * own attribute, so a scenario reusing one would silently join that scenario's
 * observation string, and S2's, S4's and S5's reads have to keep measuring
 * exactly what they measured before S6 existed.
 */
export function measureTextKeys(html: string): string[] {
  return measureKeyAttribute(html, 'data-oracle-text-key')
}

/**
 * The INNER row identities inside one named group's list, in document order.
 *
 * Scoped to that group's own `<ul data-rows="…">`, and the scoping is the whole
 * reason this reader exists. A flat read over `data-oracle-cell-key` cannot tell
 * "each group holds its own rows" — the containment relation a nested repeat
 * *is* — from "every group renders the same shared row list", and the second of
 * those is exactly the shape the shipped toolchain could already express before
 * a per-group nested list became compilable. Reading the keys per group is what
 * makes S4 measure the nesting rather than merely the presence of two loops.
 *
 * The first `</ul>` after the start tag is that group's own closing tag: the row
 * list contains `<li>` elements and nothing else, and every framework's
 * bookkeeping between them is comments, which carry no tags.
 */
export function measureCellKeys(html: string, group: string): string[] {
  const { afterOpen } = locate(html, `data-rows="${group}"`)
  const close = html.indexOf('</ul>', afterOpen)
  if (close === -1) {
    throw new Error(
      `Cannot measure: the row list for group ${group} has no closing </ul> in the HTML passed ` +
        'to this reader.',
    )
  }
  return measureKeyAttribute(html.slice(afterOpen + 1, close), 'data-oracle-cell-key')
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
 *    pin this — six lanes that all served the wrong string would still agree —
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
  // S4 clicks three buttons: one `select` inside the nested row, then `flip` and
  // `reorder` on the board. `_button_q_e_click_` is the segment prefix all three
  // share — the same structural read s2 makes, for the same reason.
  //
  // MEASURED off this lane's own `handlerSegments` evidence rather than
  // predicted from the emitted output, and the reading is worth quoting because
  // it is the first of its kind in this repo:
  //
  //   NestedBoard.jsx_NestedBoard_component_section_ul_li_ul_li_button_q_e_click_…
  //   NestedBoard.jsx_NestedBoard_component_section_button_q_e_click_…
  //   NestedBoard.jsx_NestedBoard_component_section_button_q_e_click_1_…
  //
  // `section_ul_li_ul_li_button` is a handler pulled on demand from inside TWO
  // nested keyed lists. Every previous segment in the corpus bottoms out at one
  // list at most (s2's is `section_ul_li_button`), because until a nested repeat
  // became compilable there was no deeper site to resume into.
  s4: { includes: '_button_q_e_click_', atLeast: 3 },
  // S5 issues six clicks across four DISTINCT handlers: `tick` and `pick`
  // inside the live arm, `toggle` on the board, `drop` inside the idle arm, and
  // then `tick` again once the live arm has been torn down and rebuilt.
  //
  // MEASURED off this lane's own `handlerSegments` evidence — four segments, in
  // click order, verbatim:
  //
  //   BranchBoard.jsx_BranchBoard_component_section_div_button_q_e_click_pnwm0Iro4cY.js
  //   BranchBoard.jsx_BranchBoard_component_section_div_ul_li_button_q_e_click_DmbcW4Vyi08.js
  //   BranchBoard.jsx_BranchBoard_component_section_button_q_e_click_FhhLDdsOJNA.js
  //   BranchBoard.jsx_BranchBoard_component_section_div_button_q_e_click_1_X4FkrWt0H4w.js
  //
  // The first two are handlers resumed from INSIDE a branch arm, and the fourth
  // — the idle arm's `drop` — is pulled out of a subtree the server never
  // rendered at all, since the idle arm did not exist until the client built
  // it. Every other segment in the corpus is resumed out of markup the server
  // sent; that one is the first that is not.
  //
  // SIX clicks, FOUR segments: the second `tick`, on the REBUILT arm, fetched
  // nothing. The rebuilt subtree's handler resolved from a QRL already imported
  // for the subtree that was destroyed, which is worth recording because it is
  // the answer to "did the rebuild rebind" being yes without a second fetch.
  s5: { includes: '_button_q_e_click_', atLeast: 4 },
  // S6 clicks three DISTINCT handlers: `tick` and `pad` on the board and one
  // `widen` inside a keyed row. `_button_q_e_click_` is the segment prefix all
  // three share — the same structural read s2, s4 and s5 make.
  //
  // MEASURED off this lane's own `handlerSegments` evidence — three segments, in
  // click order, verbatim:
  //
  //   WhitespaceBoard.jsx_WhitespaceBoard_component_section_button_q_e_click_C410pHxdYjw.js
  //   WhitespaceBoard.jsx_WhitespaceBoard_component_section_button_q_e_click_1_6HsIOE63DYU.js
  //   WhitespaceBoard.jsx_WhitespaceBoard_component_section_ul_li_button_q_e_click_imyNaruplkc.js
  //
  // THREE clicks, THREE segments, and that one-to-one is itself the reading: no
  // handler here shares a QRL with another, so each click paid for exactly its
  // own import. S5's six clicks pulled four segments; this scenario has no
  // rebuilt subtree to resolve a handler out of an already-imported QRL.
  s6: { includes: '_button_q_e_click_', atLeast: 3 },
  // S7 issues FOUR clicks across four distinct handlers, but only two of them
  // are `click`: the radio and the checkbox are `change` handlers, and they are
  // the first `change` handlers in this corpus any lane is ever asked to run
  // (S3 carries one and the contract never clicks it). `runScenario`'s
  // `handlerSegments` evidence filters on `_q_e_click_`, so a `change` QRL is
  // not counted here — that it was pulled at all is proven behaviourally, by
  // `picked` and `chosen` moving in this lane like they do in the other five.
  //
  // MEASURED off this lane's own `handlerSegments` evidence — two segments, in
  // click order, verbatim:
  //
  //   FormBoard.jsx_FormBoard_component_form_button_q_e_click_226Fd9wpp00.js
  //   FormBoard.jsx_FormBoard_component_form_button_q_e_click_1_HB6KOsk6TiI.js
  //
  // `_form_button_q_e_click_` rather than the `_button_q_e_click_` s2, s4, s5
  // and s6 share: S7's board is a `<form>`, not a `<section>`, so the structural
  // prefix genuinely differs and asserting the shared one would have been a
  // weaker read than this lane can support.
  s7: { includes: '_form_button_q_e_click_', atLeast: 2 },
  // S9 issues THREE clicks across three distinct handlers: one `seal` inside the
  // keyed repeat, then `lock` and `unlock` on the board.
  // `_button_q_e_click_` is the segment prefix all three share — the same
  // structural read s2, s4, s5 and s6 make, and NOT s7's `_form_button_…`: S9's
  // board is a `<section>`, so the narrower prefix would not match.
  s9: { includes: '_button_q_e_click_', atLeast: 3 },
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
 * - React, Solid, Svelte, Vue and Angular must send their own client entry
 *   module (nothing reacts until it runs) and must send **neither** `q:container` **nor** the
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
 * The six lanes reach this identically-observed outcome through visibly
 * different emitted forms — React and Solid keep the authored guard verbatim,
 * Qwik synthesises a `sync$()` guard from the IR's condition tree, Svelte and
 * Vue emit it in-body. Divergence in form with identity in behaviour is the
 * thesis, and
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
 * can read, and routing it through component state would put six frameworks'
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
 * site, same predicate, same exact string, all six lanes, no per-lane
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
 * of framework state in every lane". That is refuted. Its replacement — a table
 * naming react and qwik "frozen" and solid "signal-tracked" — was refuted too,
 * in two cells: it was labelled *measured*, but the only thing measured was an
 * emitted golden, which cannot decide what a framework does to the DOM at
 * hydration. Corrected again the same day, and this time every cell was measured
 * in Chromium against the four official demos, with two independent instruments
 * per lane and a control input outside each framework's root:
 *
 *   react   REWRITES it from client state at hydration  <- the only lane
 *   solid   not written at hydration; tracked only afterwards
 *   svelte  removed by `remove_input_defaults`, by design
 *   qwik    never written, at resume or on re-render
 *
 * React is the outlier and it is not an accident of the emitter: react-dom
 * 19.2.3 skips the *property* write while hydrating and then runs
 * `element.defaultValue = value` unconditionally, and `.defaultValue` on an
 * input *is* the `value` content attribute. Solid is the reverse — `attr:` is
 * genuinely signal-tracked (DEFECTS.md finding 5 stands; a post-activation edit
 * does move the attribute), but `solid-js/web`'s `setAttribute` and
 * `setProperty` both open with `if (isHydrating(node)) return`, so the
 * hydration-time write never happens. "Signal-tracked" and "written at
 * hydration" are different facts, and only the first was ever measured.
 *
 * The move is therefore a uniform TRADE, not a superset. It gains, in all four
 * lanes, the class "markup the server never sent"; it loses, in one lane, the
 * class "S3's `text` seeded wrong at hydration, React only". For solid, qwik and
 * svelte the gap below was *revealed* by the site correction; for react it was
 * *caused* by it.
 *
 * The trade is legitimate and is not to be re-litigated here: the name/site
 * mismatch it fixes (`server-rendered text` reported from `await page.content()`)
 * is provable from this file alone and predates the Svelte lane, and the lost
 * class was never a declared claim — it was the incidental byproduct of one
 * framework's internal hydration path. The full ruling is in
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
 * original oracle and still runs, and still passes, for all six frameworks
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
 * The nested list as the live DOM currently serializes it.
 *
 * `shape` is the observation that carries the nesting: it names, per group and
 * in document order, which inner rows that group holds. `measureCellKeys` reads
 * each list inside that group's own `<ul data-rows="…">`, so two groups
 * rendering the same shared row list — which is what an inner collection that
 * has stopped being sourced from the enclosing loop variable looks like —
 * produces a different string here even though the flat set of cell keys and
 * the `cells` count would both be unchanged.
 */
async function measureNesting(page: PageHandle): Promise<{
  groups: string
  shape: string
  selection: string
  cells: string
  on: string
}> {
  const html = await page.content()
  const groups = measureGroupKeys(html)
  return {
    groups: groups.join(','),
    shape: groups.map((group) => `${group}=[${measureCellKeys(html, group).join(',')}]`).join(' '),
    selection: measureText(html, 'data-selection="true"'),
    cells: measureText(html, 'data-count="cells"'),
    on: measureKeyAttribute(html, 'data-cell-on').join(','),
  }
}

/**
 * S4 — nested lists: a keyed list of groups, each holding its OWN keyed list of
 * rows, with a handler inside the inner loop that reads both loop variables.
 *
 * ## Why this scenario exists at all
 *
 * Until `packages/compiler/src/build.ts` learned to register an inner loop
 * variable whose collection is a member of the ENCLOSING loop variable, the
 * corpus could not express a nested list: `@markless/compiler` 0.1.1 leaves
 * `collectionGraphNodeId` unset for `group.rows`, the item was never bound, and
 * every read off `row` lowered to `reads: []` while five of six emitters printed
 * correct-LOOKING output over it, because they walk the template rather than the
 * reads. So every observation below has to be about the CONTAINMENT relation and
 * not about "two loops rendered". See `measureCellKeys`.
 *
 * ## The three transitions, and what each one isolates
 *
 * | step | what moves | what must not |
 * |---|---|---|
 * | `select` on an inner row | `selection`, `marked` | either list's order |
 * | `flip` | every group's INNER row order | the outer group order |
 * | `reorder` | the OUTER group order | any group's inner rows |
 *
 * `flip` and `reorder` are a pair on purpose: an emitter that had collapsed the
 * two levels into one — rendering a single shared row list under every group —
 * satisfies `reorder` perfectly and fails `flip`, and an emitter that had lost
 * the outer key does the reverse.
 *
 * ## `selection` is where the two loop variables are read together
 *
 * The authored handler assigns a template literal interpolating group.id and
 * then row.id, so the emitted call site has to carry BOTH loop variables.
 * Angular is the only lane that reifies that as an argument list —
 * `onH9Click(group, row, $event)` — and its ruling that enclosing `@for`
 * variables are passed OUTERMOST FIRST had no instance in this repo until this
 * scenario existed. Asserting the exact string `g1>r2` rather than merely "some
 * selection happened" is what gives that ruling a red site: swap the two
 * arguments and this reads `r2>g1`.
 *
 * The `on` reading is the second, independent half of the same fact. `marked` is
 * assigned `row.id` alone, so a call site with its arguments swapped marks a
 * GROUP id, no inner row matches, and no `data-cell-on` element exists at all.
 *
 * Nothing here reads `data-oracle-row-key`: S2 owns that attribute and this
 * scenario deliberately keys its inner rows with `data-oracle-cell-key` so that
 * S2's flat read is untouched by a nested list appearing in the corpus.
 */
export async function assertS4(page: PageHandle, expect: ExpectApi): Promise<string[]> {
  const observed: string[] = []
  await expect.page.exists(page, '[data-scenario="s4"]')
  await expect.page.text(page, '[data-count="cells"]', '3/2')
  await expect.page.text(page, '[data-selection="true"]', 'none')

  const initial = await measureNesting(page)
  requireNesting(initial, {
    groups: 'g1,g2',
    shape: 'g1=[r1,r2] g2=[r3]',
    step: 'as served',
  })
  observed.push(
    `server-rendered groups ${initial.groups} hold ${initial.shape} ` +
      `with cells = ${initial.cells} and selection = ${initial.selection}`,
  )

  // The inner row's handler, which reads BOTH loop variables.
  await page.click('[data-select="r2"]')
  await expect.page.text(page, '[data-selection="true"]', 'g1>r2')
  await expect.page.exists(page, '[data-cell-on="r2"]')
  const selected = await measureNesting(page)
  if (selected.on !== 'r2') {
    throw new Error(
      `after clicking [data-select="r2"] the cells reading data-cell-on are ` +
        `${JSON.stringify(selected.on)}, not "r2". \`marked\` is assigned the INNER loop ` +
        "variable's id alone, so anything else means the handler was handed something other " +
        'than the row it is attached to.',
    )
  }
  requireNesting(selected, {
    groups: 'g1,g2',
    shape: 'g1=[r1,r2] g2=[r3]',
    step: 'after selecting r2',
  })
  observed.push(`after selecting r2 selection = ${selected.selection} with the on cell ${selected.on}`)

  // INNER order moves, OUTER order does not.
  await page.click('[data-action="flip"]')
  await expect.page.attribute(page, '[data-rows="g1"] > li:first-child', 'data-oracle-cell-key', 'r2')
  const flipped = await measureNesting(page)
  requireNesting(flipped, {
    groups: 'g1,g2',
    shape: 'g1=[r2,r1] g2=[r3]',
    step: 'after flip',
  })
  observed.push(
    `after flip groups ${flipped.groups} hold ${flipped.shape} and selection is still ` +
      `${flipped.selection}`,
  )

  // OUTER order moves, every group keeps the inner rows it was holding.
  await page.click('[data-action="reorder"]')
  await expect.page.attribute(
    page,
    '[data-groups="true"] > li:first-child',
    'data-oracle-group-key',
    'g2',
  )
  const reordered = await measureNesting(page)
  requireNesting(reordered, {
    groups: 'g2,g1',
    shape: 'g2=[r3] g1=[r2,r1]',
    step: 'after reorder',
  })
  observed.push(
    `after reorder groups ${reordered.groups} hold ${reordered.shape} and cells = ${reordered.cells}`,
  )
  return observed
}

/**
 * The nesting assertion, hand-rolled for the same reason
 * `measureConditionalCancellation` is: the sentence a failure raises has to name
 * which of the two levels moved, and `expect.page.*` has no accessor that can
 * compare a per-group row list at all.
 *
 * Both halves are required and neither implies the other. `groups` alone passes
 * for an emitter that renders one shared row list under every group; `shape`
 * alone passes for an emitter that lost the outer key while keeping containment.
 */
function requireNesting(
  actual: { groups: string; shape: string },
  expected: { groups: string; shape: string; step: string },
): void {
  if (actual.groups !== expected.groups) {
    throw new Error(
      `${expected.step} the OUTER group order reads ${JSON.stringify(actual.groups)}, not ` +
        `${JSON.stringify(expected.groups)}.`,
    )
  }
  if (actual.shape !== expected.shape) {
    throw new Error(
      `${expected.step} the nested lists read ${JSON.stringify(actual.shape)}, not ` +
        `${JSON.stringify(expected.shape)}. Each group must hold its OWN rows: this string is ` +
        "read per group, inside that group's own <ul data-rows>, so a shared row list rendered " +
        'under every group changes it while the flat set of cell keys does not.',
    )
  }
}

/**
 * The branch as the live DOM currently serializes it.
 *
 * `arm` is the observation that carries the teardown. Exactly one arm may exist
 * at a time, so it is read as the JOINED list of every `data-arm` value in
 * document order rather than as a single lookup: an emitter that rendered both
 * arms — the failure mode where a guard has stopped being consulted — reads
 * `live,idle` here instead of throwing somewhere less legible.
 *
 * `ticks` and `seen` are the same two pieces of component state read through
 * whichever arm is mounted — `data-live-ticks` while the live arm exists and
 * `data-idle-ticks` after it has been destroyed. The marker is derived from the
 * arm rather than shared between the arms, and that is a measured constraint
 * rather than a naming preference: `packages/frameworks/solid/src/gate` rejects
 * an element subtree appearing verbatim in both arms of a `<Show>`
 * (`show-two-arm`, T003 ruling 5) and tells the author to hoist it out of the
 * branch. Hoisting is precisely what this scenario must not do, since the point
 * is that the projections live inside the subtree that gets torn down.
 *
 * If the two arms are ever mounted at once, the derived marker is not a name any
 * element carries — so both values read `(no single arm)` and `requireBranch`
 * fails on `arm` first, with the sentence that names the actual fault, instead
 * of on a reader that could not find its element.
 *
 * `rows` is unscoped and reads `[]` once the branch is torn down. That is a
 * measurement, not an absence: the keyed list lives inside the live arm, so its
 * disappearance is half of what teardown means.
 */
async function measureBranch(page: PageHandle): Promise<{
  arm: string
  rows: string
  size: string
  ticks: string
  seen: string
}> {
  const html = await page.content()
  const arms = measureKeyAttribute(html, 'data-arm')
  const throughArm = (name: string): string =>
    arms.length === 1 ? measureText(html, `data-${arms[0]}-${name}="true"`) : '(no single arm)'
  return {
    arm: arms.join(','),
    rows: `[${measureBranchKeys(html).join(',')}]`,
    size: measureText(html, 'data-count="size"'),
    ticks: throughArm('ticks'),
    seen: throughArm('seen'),
  }
}

/**
 * The branch assertion, hand-rolled for the same reason `requireNesting` is:
 * the sentence a failure raises has to name which half of teardown broke, and
 * `expect.page.*` has no accessor that can compare "which arm is mounted" at
 * all.
 */
function requireBranch(
  actual: { arm: string; rows: string; ticks: string; seen: string },
  expected: { arm: string; rows: string; ticks: string; seen: string; step: string },
): void {
  if (actual.arm !== expected.arm) {
    throw new Error(
      `${expected.step} the mounted arm reads ${JSON.stringify(actual.arm)}, not ` +
        `${JSON.stringify(expected.arm)}. Exactly one arm may exist at a time — a reading of ` +
        '"live,idle" means both arms are in the document, which is what a branch whose guard ' +
        'has stopped being consulted looks like.',
    )
  }
  if (actual.rows !== expected.rows) {
    throw new Error(
      `${expected.step} the branch rows read ${actual.rows}, not ${expected.rows}. The keyed ` +
        'list lives INSIDE the live arm, so it must be absent entirely while the idle arm is ' +
        'mounted and must be rebuilt from current state — not from the state it held when it ' +
        'was torn down — when the live arm comes back.',
    )
  }
  if (actual.ticks !== expected.ticks || actual.seen !== expected.seen) {
    throw new Error(
      `${expected.step} the arm projects ticks=${JSON.stringify(actual.ticks)} ` +
        `seen=${JSON.stringify(actual.seen)}, not ticks=${JSON.stringify(expected.ticks)} ` +
        `seen=${JSON.stringify(expected.seen)}. Both values are component state whose ONLY DOM ` +
        'projection is inside a branch arm, so this is the claim that destroying the subtree ' +
        'did not destroy the state behind it.',
    )
  }
}

/**
 * S5 — conditional branch teardown: a branch toggled at runtime, with a
 * populated arm on BOTH sides, that destroys and rebuilds a subtree holding a
 * keyed list and two event handlers.
 *
 * ## Why this scenario exists at all
 *
 * The corpus had branches before S5 and none of them ever tore anything down.
 * `s1`'s branch is selected by a STATIC prop (`visible={true}`, the same in
 * every lane's props) and cannot flip; `s2`'s `@else` arm is literally empty
 * and its `@if` arm is a static `<p>`. So no lane in this repo had ever been
 * observed destroying a populated subtree and rebuilding it — which is the axis
 * on which block-based renderers (Svelte, Vue, Angular's `@if`), reconciling
 * renderers (React, Solid) and a RESUMED one (Qwik) differ most.
 *
 * It is also the axis that fails silently. T020 found a guarded control that
 * stayed CORRECT while its guard had stopped being consulted; nothing in the
 * corpus could have caught the same class here, because nothing flipped.
 *
 * ## The five transitions, and what each one isolates
 *
 * | step | what must move | what must not |
 * |---|---|---|
 * | `tick` (inside the live arm) | `ticks` | the arm, the rows |
 * | `pick` (inside the list inside the arm) | `seen` | the arm, the rows |
 * | `toggle` | the mounted arm, the rows to `[]` | `ticks`, `seen` |
 * | `drop` (inside the IDLE arm) | `size` | the mounted arm, `ticks`, `seen` |
 * | `toggle` back | the mounted arm, the rows to the POST-drop list | `ticks`, `seen` |
 *
 * `drop` and the second `toggle` are a pair on purpose, and they are the pair
 * that makes this a teardown test rather than a visibility test. `drop` mutates
 * the collection whose only rendering lives in the arm that is currently GONE.
 * An emitter that rebuilt the arm from anything other than current state — a
 * cached subtree, the original prop, a snapshot taken at teardown — satisfies
 * every step above it and fails here, and it fails with the rows reading
 * `[k1,k2,k3]` where `[k2,k3]` is required.
 *
 * ## Why the last step is a second `tick`
 *
 * A rebuilt subtree that renders correctly but whose handlers were never
 * rebound is indistinguishable from a correct one until something is clicked
 * inside it. This matters most for the resumed lane: Qwik has to pull a QRL for
 * a button in a subtree the SERVER NEVER RENDERED, since the live arm was
 * destroyed and rebuilt on the client. Nothing else in the corpus asks that.
 *
 * ## Why no `<details>`
 *
 * Uncontrolled DOM state inside the torn-down arm would have given a "correctly
 * does NOT survive" reading, and it was deliberately left out: whether a
 * particular framework preserves a detached element is an implementation
 * detail, not a shared contract, and this scenario is compared byte-for-byte
 * across six lanes. The "does not survive" half is carried instead by `rows`
 * going to `[]` and coming back POST-drop, both of which are the same fact in
 * every renderer.
 *
 * Nothing here reads `data-oracle-row-key` or `data-oracle-cell-key`: S2 and S4
 * own those, and S5 keys its rows with `data-oracle-branch-key` so their reads
 * are untouched by a branch scenario joining the corpus.
 */
export async function assertS5(page: PageHandle, expect: ExpectApi): Promise<string[]> {
  const observed: string[] = []
  await expect.page.exists(page, '[data-scenario="s5"]')
  await expect.page.exists(page, '[data-arm="live"]')
  await expect.page.text(page, '[data-count="size"]', '3')
  await expect.page.text(page, '[data-live-ticks="true"]', '0')

  const initial = await measureBranch(page)
  requireBranch(initial, {
    arm: 'live',
    rows: '[k1,k2,k3]',
    ticks: '0',
    seen: 'none',
    step: 'as served',
  })
  observed.push(
    `server-rendered arm ${initial.arm} holds rows ${initial.rows} with size = ${initial.size}, ` +
      `ticks = ${initial.ticks} and seen = ${initial.seen}`,
  )

  // A handler INSIDE the arm that is about to be torn down.
  await page.click('[data-action="tick"]')
  await expect.page.text(page, '[data-live-ticks="true"]', '1')
  const ticked = await measureBranch(page)
  requireBranch(ticked, {
    arm: 'live',
    rows: '[k1,k2,k3]',
    ticks: '1',
    seen: 'none',
    step: 'after one tick',
  })
  observed.push(`after one tick inside the live arm ticks = ${ticked.ticks} and seen = ${ticked.seen}`)

  // A handler inside the keyed list inside the arm.
  await page.click('[data-pick="k2"]')
  await expect.page.text(page, '[data-live-seen="true"]', 'k2')
  const picked = await measureBranch(page)
  requireBranch(picked, {
    arm: 'live',
    rows: '[k1,k2,k3]',
    ticks: '1',
    seen: 'k2',
    step: 'after picking k2',
  })
  observed.push(`after picking k2 seen = ${picked.seen} and the rows are still ${picked.rows}`)

  // TEARDOWN. The live arm and everything in it is destroyed; the state behind
  // it must survive and the idle arm must project it.
  await page.click('[data-action="toggle"]')
  await expect.page.exists(page, '[data-arm="idle"]')
  const flipped = await measureBranch(page)
  requireBranch(flipped, {
    arm: 'idle',
    rows: '[]',
    ticks: '1',
    seen: 'k2',
    step: 'after the flip',
  })
  observed.push(
    `after the flip arm ${flipped.arm} holds rows ${flipped.rows} with ticks = ${flipped.ticks} ` +
      `and seen = ${flipped.seen}`,
  )

  // The collection changes while the subtree that renders it does not exist.
  await page.click('[data-action="drop"]')
  await expect.page.text(page, '[data-count="size"]', '2')
  const dropped = await measureBranch(page)
  requireBranch(dropped, {
    arm: 'idle',
    rows: '[]',
    ticks: '1',
    seen: 'k2',
    step: 'after dropping while the live arm is torn down',
  })
  observed.push(
    `after dropping while the live arm is torn down size = ${dropped.size} and arm ` +
      `${dropped.arm} still holds rows ${dropped.rows}`,
  )

  // REBUILD, from CURRENT state rather than from the state the arm held when it
  // was destroyed.
  await page.click('[data-action="toggle"]')
  await expect.page.exists(page, '[data-arm="live"]')
  await expect.page.attribute(
    page,
    '[data-branch-rows="true"] > li:first-child',
    'data-oracle-branch-key',
    'k2',
  )
  const rebuilt = await measureBranch(page)
  requireBranch(rebuilt, {
    arm: 'live',
    rows: '[k2,k3]',
    ticks: '1',
    seen: 'k2',
    step: 'after the flip back',
  })
  observed.push(
    `after the flip back arm ${rebuilt.arm} holds rows ${rebuilt.rows} with size = ` +
      `${rebuilt.size}, ticks = ${rebuilt.ticks} and seen = ${rebuilt.seen}`,
  )

  // The rebuilt subtree's handlers are live. For the resumed lane this is a QRL
  // pulled from markup the server never sent.
  await page.click('[data-action="tick"]')
  await expect.page.text(page, '[data-live-ticks="true"]', '2')
  const reticked = await measureBranch(page)
  requireBranch(reticked, {
    arm: 'live',
    rows: '[k2,k3]',
    ticks: '2',
    seen: 'k2',
    step: 'after one more tick in the rebuilt arm',
  })
  observed.push(
    `after one more tick in the rebuilt arm ticks = ${reticked.ticks} and rows are ${reticked.rows}`,
  )
  return observed
}

/**
 * The exact characters S6's five text sites currently carry, read through
 * `measureExactText` so that nothing is trimmed or collapsed on the way out.
 *
 * `pairs` is read per row, keyed by `data-oracle-text-key`, so the reading also
 * says WHICH row carried which characters. A renderer that updated one row's
 * separator and not the other's changes this string while a flat read of the
 * document's text would not.
 */
async function measureWhitespace(page: PageHandle): Promise<{
  ratio: string
  glue: string
  wrap: string
  mixed: string
  fixed: string
  pairs: string
}> {
  const html = await page.content()
  return {
    ratio: measureExactText(html, 'data-ratio="true"'),
    glue: measureExactText(html, 'data-glue="true"'),
    wrap: measureExactText(html, 'data-wrap="true"'),
    mixed: measureExactText(html, 'data-mixed="true"'),
    fixed: measureExactText(html, 'data-static="true"'),
    pairs: measureTextKeys(html)
      .map((key) => `${key}=${JSON.stringify(measureExactText(html, `data-pair="${key}"`))}`)
      .join(' '),
  }
}

/**
 * The whitespace assertion, hand-rolled for the same reason `requireNesting` and
 * `requireBranch` are: the sentence a failure raises has to name WHICH text site
 * moved and what a move there means, and `expect.page.*` cannot compare a string
 * without trimming its edges first.
 *
 * Every expected value is quoted with `JSON.stringify` in the message. That is
 * not decoration — a failure on this scenario is by construction a difference of
 * invisible characters, and `expected "a b" but got "a b"` is not a diagnostic.
 */
function requireWhitespace(
  actual: Record<string, string>,
  expected: Record<string, string> & { step: string },
): void {
  const why: Record<string, string> = {
    ratio:
      'two interpolations separated by a single "/" and nothing else. Anything between them ' +
      'was injected by a renderer, and this is the reading S2 nearly lost when a lane ' +
      'condensed `1/2` into `1 /2`.',
    glue:
      'a text run holding TWO ADJACENT interpolations with no separator at all. A ' +
      'pretty-printer that broke this run across lines and a template compiler that turned ' +
      'the line break into a space would both show up here and nowhere else.',
    wrap:
      'whitespace carried by the DATA, not by the template: leading, trailing and interior ' +
      'runs inside an interpolated value. Template whitespace is normalised by four of the ' +
      'six lanes; an interpolated value must not be, and this is the reading that says so.',
    mixed:
      'text, an inline element and text again with no whitespace anywhere between them. An ' +
      'emitter that put the inline element on its own line changes this and nothing else.',
    fixed:
      'a static text node whose interior single spaces must survive verbatim. It never ' +
      'changes for the whole scenario, so a move here is a renderer rewriting text it was ' +
      'never asked to touch.',
    pairs:
      'THREE adjacent interpolations inside a keyed row, with the middle one holding a value ' +
      'whose own edges are spaces. This is the deepest site in the scenario and the only one ' +
      'inside a repeat.',
  }
  for (const [key, want] of Object.entries(expected)) {
    if (key === 'step') continue
    if (actual[key] === want) continue
    throw new Error(
      `${expected.step} the ${key} text reads ${JSON.stringify(actual[key])}, not ` +
        `${JSON.stringify(want)}. That site is ${why[key]}`,
    )
  }
}

/**
 * S6 — whitespace-sensitive text: the exact characters between and around
 * interpolations, as served and across three updates.
 *
 * ## Why this scenario exists at all
 *
 * The corpus's only text/interpolation adjacency was S2's
 * `{complete}/{todos.length}`, and it very nearly broke: Vue's SFC compiler
 * defaults to `whitespace: 'condense'` and would have rendered `1/2` as `1 /2`
 * had the emitter broken that run across lines, while Angular's `parseTemplate`
 * keeps a lone newline verbatim and would have produced `1\n/2` from the SAME
 * layout. Two lanes, two different wrong answers, from one authored string. That
 * is measured, not hypothetical — the Angular lane refuted the Vue lane's
 * measurement of this exact shape.
 *
 * So this scenario puts five differently-shaped text runs in one component and
 * asserts their characters exactly. Nothing here is about a value being right;
 * every reading is about what is, or is not, between the values.
 *
 * ## What the fixture may and may not contain, and why
 *
 * Every static text node in `s6-whitespace-text.tsrx` is `trim()`-stable. That
 * is a MEASURED constraint, not a style: the Angular emitter's `escapeText`
 * THROWS on template text whose own edges are whitespace, and the Vue gate's
 * `condense-stable-text` rejects the emitted result of the same shape. So a
 * space next to an interpolation cannot be authored in the template at all, and
 * every space this scenario needs beside a value is carried by the DATA instead
 * — `label` for `wrap`, the `joiner` state for `pairs`.
 *
 * That split is the scenario's sharpest claim, because the two halves are not
 * treated alike: template whitespace is normalised by four of the six lanes,
 * interpolated whitespace by none of them. `wrap` and `pairs` are where the
 * second half is asserted.
 *
 * ## The three transitions, and what each one isolates
 *
 * | step | what must move | what must not |
 * |---|---|---|
 * | `tick` | `ratio`, `glue`, `mixed` | `wrap`, `fixed`, `pairs` |
 * | `pad` | `wrap`, and ONLY by whitespace | everything else |
 * | `widen` (inside a keyed row) | `pairs` | `glue`, `fixed` |
 *
 * `pad` is the one that could not be written any other way. It replaces the
 * interpolated value with the same value plus one leading and one trailing
 * space, so the update is INVISIBLE to any comparison that trims — including
 * `measureText`, which every other scenario in this file reads through. A
 * renderer that diffed text after normalising it would satisfy every other step
 * and produce no change at all here.
 *
 * `widen` is the same claim one level deeper and at a site that is genuinely
 * shared: it sets a single component-level separator that BOTH rows interpolate
 * between their own two values, so `pairs` moves in both rows at once and a
 * lane that rebuilt only the clicked row reads a mixed string.
 *
 * Nothing here reads `data-oracle-row-key`, `data-oracle-cell-key` or
 * `data-oracle-branch-key`: S2, S4 and S5 own those, and S6 keys its rows with
 * `data-oracle-text-key`.
 */
export async function assertS6(page: PageHandle, expect: ExpectApi): Promise<string[]> {
  const observed: string[] = []
  await expect.page.exists(page, '[data-scenario="s6"]')
  await expect.page.text(page, '[data-ratio="true"]', '1/2')
  await expect.page.text(page, '[data-glue="true"]', 'start1pxend')

  const initial = await measureWhitespace(page)
  requireWhitespace(initial, {
    ratio: '1/2',
    glue: 'start1pxend',
    wrap: '[ wide  load ]',
    mixed: 'apxz',
    fixed: 'one two three',
    pairs: 'w1="a|b" w2="c|d"',
    step: 'as served',
  })
  observed.push(
    `server-rendered ratio ${JSON.stringify(initial.ratio)}, glue ${JSON.stringify(initial.glue)}, ` +
      `wrap ${JSON.stringify(initial.wrap)}, mixed ${JSON.stringify(initial.mixed)}, static ` +
      `${JSON.stringify(initial.fixed)} and pairs ${initial.pairs}`,
  )

  // Two values change at once, and they are projected at three different kinds
  // of site: between a "/" separator, glued to another interpolation, and inside
  // an inline element. The update must not widen any of them.
  await page.click('[data-action="tick"]')
  await expect.page.text(page, '[data-glue="true"]', 'start2emend')
  const ticked = await measureWhitespace(page)
  requireWhitespace(ticked, {
    ratio: '2/2',
    glue: 'start2emend',
    wrap: '[ wide  load ]',
    mixed: 'aemz',
    fixed: 'one two three',
    pairs: 'w1="a|b" w2="c|d"',
    step: 'after one tick',
  })
  observed.push(
    `after one tick ratio ${JSON.stringify(ticked.ratio)}, glue ${JSON.stringify(ticked.glue)} ` +
      `and mixed ${JSON.stringify(ticked.mixed)} with wrap still ${JSON.stringify(ticked.wrap)}`,
  )

  // A text update whose ENTIRE content is whitespace. Everything that trims
  // sees no change here at all.
  await page.click('[data-action="pad"]')
  await expect.page.text(page, '[data-wrap="true"]', '[  wide  load  ]')
  const padded = await measureWhitespace(page)
  requireWhitespace(padded, {
    ratio: '2/2',
    glue: 'start2emend',
    wrap: '[  wide  load  ]',
    mixed: 'aemz',
    fixed: 'one two three',
    pairs: 'w1="a|b" w2="c|d"',
    step: 'after padding the note',
  })
  observed.push(
    `after padding the note wrap ${JSON.stringify(padded.wrap)} and static still ` +
      `${JSON.stringify(padded.fixed)}`,
  )

  // A handler inside a keyed row sets a separator both rows interpolate, and the
  // new separator's own edges are spaces.
  await page.click('[data-widen="w2"]')
  await expect.page.text(page, '[data-pair="w2"]', 'c w2 d')
  const widened = await measureWhitespace(page)
  requireWhitespace(widened, {
    ratio: '2/2',
    glue: 'start2emend',
    wrap: '[  wide  load  ]',
    mixed: 'aemz',
    fixed: 'one two three',
    pairs: 'w1="a w2 b" w2="c w2 d"',
    step: 'after widening w2',
  })
  observed.push(
    `after widening w2 pairs ${widened.pairs} and glue still ${JSON.stringify(widened.glue)}`,
  )
  return observed
}


/**
 * Every row identity in S7's control list, in document order.
 *
 * A FIFTH key attribute, for the reason the second, third and fourth exist:
 * `measureRowKeys`, `measureCellKeys`, `measureBranchKeys` and `measureTextKeys`
 * each match their own attribute globally, so a scenario reusing one would
 * silently join that scenario's observation string, and S2's, S4's, S5's and
 * S6's reads have to keep measuring exactly what they measured before S7
 * existed.
 */
export function measureFormKeys(html: string): string[] {
  return measureKeyAttribute(html, 'data-oracle-form-key')
}

/**
 * S7's controls and attributes as the live DOM currently serializes them.
 *
 * EVERY reading here is an `attribute`-kind binding or a text projection, and
 * that is a MEASURED constraint rather than a preference. S7's `checked`
 * bindings — the two radios and the checkbox inside the keyed repeat — lower to
 * `kind: 'property'`, and what a property binding does to the serialized
 * `checked` attribute splits the six lanes FOUR ways. Measured on this tree, at
 * this scenario, in a real browser (see the T030 note):
 *
 *   react, angular  the server writes `checked`, and it never moves again
 *   solid, qwik     the server does NOT write it; activation adds it, then frozen
 *   svelte          the server writes it and hydration DELETES it (`remove_input_defaults`)
 *   vue             the server does not write it; activation adds it AND TRACKS state
 *
 * So a `checked` reading cannot be part of a cross-lane observation string. It
 * is not silently dropped: what each control DID is observed instead, through
 * `picked` and `chosen`, which are text projections of the state those handlers
 * write. This is the same trade `assertS3` records for `value`, one axis wider.
 */
async function measureForm(page: PageHandle): Promise<{
  size: string
  notes: string
  picked: string
  chosen: string
  tags: string
  lock: string
  held: string
  ariaDisabled: string
}> {
  const html = await page.content()
  const attribute = (marker: string, name: string): string =>
    JSON.stringify(measureAttribute(html, marker, name))
  return {
    size: attribute('data-control="size"', 'data-size'),
    notes: attribute('data-control="notes"', 'data-notes'),
    picked: measureText(html, 'data-picked="true"'),
    chosen: measureText(html, 'data-chosen="true"'),
    tags: measureFormKeys(html).join(','),
    lock: attribute('data-action="lock"', 'data-lock'),
    held: attribute('data-guard="true"', 'data-held'),
    ariaDisabled: attribute('data-guard="true"', 'aria-disabled'),
  }
}

/**
 * The form assertion, hand-rolled for the same reason `requireNesting`,
 * `requireBranch` and `requireWhitespace` are: the sentence a failure raises has
 * to name WHICH reading moved and what a move there means, and `expect.page.*`
 * has no accessor that can compare an absent attribute against a present one at
 * all — `null` and `"false"` and `""` are three different outcomes and only a
 * reader that keeps them distinct can say which one it got.
 *
 * Every value is quoted with `JSON.stringify` in both the record and the
 * message, because an attribute reading of `null` (absent) and one of `""`
 * (present and empty) are the two halves of the divergence this scenario exists
 * to measure, and `expected  but got ` is not a diagnostic.
 */
function requireForm(
  actual: Record<string, string>,
  expected: Record<string, string> & { step: string },
): void {
  const why: Record<string, string> = {
    size:
      'the `<select>`\'s state, projected through an `attribute`-kind binding. It is the one ' +
      'reading a select can carry across all six lanes: a `value` binding on a select lowers to ' +
      '`kind: \'property\'` and the six lanes disagree four ways about whether it reaches the ' +
      'served attribute at all.',
    notes: 'the `<textarea>`\'s state, projected the same way and for the same reason.',
    picked:
      'which radio the group holds, as TEXT. The radios themselves bind `checked`, a property ' +
      'binding no cross-lane reading can use, so this is where a radio click becomes observable.',
    chosen:
      'the joined ids of every CHECKED row in the keyed repeat, as TEXT. A checkbox inside a ' +
      'repeat is the deepest control in the scenario, and this is the only portable evidence ' +
      'that the click reached the row it was attached to.',
    tags: 'the keyed rows themselves. They never change, so a move here is a repeat rebuilding itself.',
    lock:
      'a dynamic attribute that is ABSENT in one state and carries a string in the other. ' +
      'Present-versus-absent is the half of the boolean-attribute axis every lane agrees on.',
    held: 'the second present-versus-absent reading, on the same element as `ariaDisabled`.',
    ariaDisabled:
      'the THIRD state of the boolean-attribute axis: present with the literal "false". A ' +
      'genuine HTML boolean attribute cannot be spelled portably here — Angular lowers an ' +
      '`attribute`-kind binding to `[attr.x]`, whose runtime writes `renderStringify(value)` ' +
      'and so serves `disabled="false"` where the other five serve nothing at all. `aria-*` is ' +
      'the spelling all six agree on, and this reading is what pins that agreement.',
  }
  for (const [key, want] of Object.entries(expected)) {
    if (key === 'step') continue
    if (actual[key] === want) continue
    throw new Error(
      `${expected.step} the ${key} reading is ${JSON.stringify(actual[key])}, not ` +
        `${JSON.stringify(want)}. That reading is ${why[key]}`,
    )
  }
}

/**
 * S7 — full form controls folded with boolean and dynamic attributes: a
 * `<select>`, a `<textarea>`, a radio group and a keyed group of checkboxes, on
 * one host that also carries every state a dynamic attribute can be in.
 *
 * ## Why this scenario exists at all
 *
 * The corpus had exactly TWO control types before S7, both in S3 and both an
 * `<input>`: one text and one checkbox. No radio, no select, no textarea, no
 * group of checkboxes, and no `disabled`, `hidden` or `aria-*` anywhere. That
 * these diverge is not a hypothesis — in one night this repo hit React's
 * `defaultValue` attribute rewrite, Svelte's `remove_input_defaults` and Solid's
 * `attr:`, three frameworks behaving three ways on the ONE control that was
 * tested.
 *
 * The Angular board's R1 — whether a property binding reaches the served
 * attribute — is this axis, and it too was measured on one control. S7 is where
 * it gets a population: three `checked` bindings across two control types, one
 * of them inside a keyed repeat.
 *
 * ## The two axes, and why they share a host
 *
 * FORM CONTROLS are `kind: 'property'` bindings (`checked` here; `value` is
 * S3's). BOOLEAN AND DYNAMIC ATTRIBUTES are `kind: 'attribute'` bindings. Both
 * live on the same host machinery and both are decided by the same per-lane
 * renderer, so folding them is what lets one scenario show that the two kinds
 * behave completely differently: every `attribute` reading below is identical in
 * all six lanes, and no `property` reading is identical in any two adjacent
 * ones.
 *
 * ## The three states of a dynamic attribute, all asserted
 *
 * | reading | as served | after `lock` |
 * |---|---|---|
 * | `lock`, `held` | ABSENT | present, carrying a string |
 * | `ariaDisabled` | present, carrying `"false"` | present, carrying `"true"` |
 *
 * Absent, present-with-`"false"`, present-with-a-value. `ariaDisabled` is bound
 * to a BOOLEAN and is the only spelling of that binding all six lanes agree on;
 * the same expression on a genuine HTML boolean attribute does not agree, and
 * the T030 note records what each lane did with it.
 *
 * ## The four transitions, and what each one isolates
 *
 * | step | what must move | what must not |
 * |---|---|---|
 * | click radio `r2` | `picked` | `chosen`, `size`, `notes` |
 * | click checkbox `t1` (inside the keyed repeat) | `chosen` | `picked`, `tags` |
 * | `resize` | `size` and `notes` | `picked`, `chosen` |
 * | `lock` | `lock`, `held`, `ariaDisabled` | every control reading |
 *
 * The first two are a pair on purpose. Both are `change` handlers on controls
 * whose only binding is `checked`, and they are the first `change` handlers in
 * the corpus that any lane is ever asked to run — S3 carries one and the
 * contract never clicks it. For the RESUMED lane that means a QRL pulled for a
 * `change` event rather than a `click`, which nothing else here asks for.
 *
 * `resize` is deliberately a BUTTON and not a real selection change: `PageHandle`
 * exposes `click` and nothing else, so a `<select>` cannot be driven from a
 * witness lane at all. What it proves is the half that matters for this axis
 * anyway — that a select's and a textarea's projections re-render from state.
 *
 * Nothing here reads `data-oracle-row-key`, `data-oracle-cell-key`,
 * `data-oracle-branch-key` or `data-oracle-text-key`: S2, S4, S5 and S6 own
 * those, and S7 keys its rows with `data-oracle-form-key`.
 */
export async function assertS7(
  page: PageHandle,
  expect: ExpectApi,
  served: EnvironmentResponse,
): Promise<string[]> {
  const observed: string[] = []
  await expect.page.exists(page, '[data-scenario="s7"]')
  await expect.page.text(page, '[data-picked="true"]', 'r1')
  await expect.page.text(page, '[data-chosen="true"]', 't2')

  // The server's own bytes, asserted exactly and calibrated two-sided on each
  // call. Both are `attribute`-kind bindings, which is the only kind that
  // reaches a served attribute identically in all six lanes.
  const servedSize = measureServedAttribute({
    served,
    marker: 'data-control="size"',
    name: 'data-size',
    equals: 's',
  })
  const servedNotes = measureServedAttribute({
    served,
    marker: 'data-control="notes"',
    name: 'data-notes',
    equals: 'draft',
  })

  const initial = await measureForm(page)
  requireForm(initial, {
    size: '"s"',
    notes: '"draft"',
    picked: 'r1',
    chosen: 't2',
    tags: 't1,t2',
    lock: 'null',
    held: 'null',
    ariaDisabled: '"false"',
    step: 'as served',
  })
  observed.push(
    `server-rendered size = ${servedSize} and notes = ${servedNotes} with picked ` +
      `${initial.picked}, chosen ${initial.chosen}, tags ${initial.tags}, lock ${initial.lock} ` +
      `and aria-disabled ${initial.ariaDisabled}`,
  )

  // A radio in a named group. Its only binding is `checked`, so the click is
  // observable through the text projection of the state it writes.
  await page.click('[data-pick="r2"]')
  await expect.page.text(page, '[data-picked="true"]', 'r2')
  const picked = await measureForm(page)
  requireForm(picked, {
    size: '"s"',
    notes: '"draft"',
    picked: 'r2',
    chosen: 't2',
    tags: 't1,t2',
    lock: 'null',
    held: 'null',
    ariaDisabled: '"false"',
    step: 'after picking r2',
  })
  observed.push(`after picking r2 picked = ${picked.picked} with chosen still ${picked.chosen}`)

  // A checkbox INSIDE the keyed repeat. `t1` starts unchecked and `t2` starts
  // checked, so this both adds a row to `chosen` and proves the two checkboxes
  // are not sharing one value.
  await page.click('[data-tag="t1"]')
  await expect.page.text(page, '[data-chosen="true"]', 't1+t2')
  const tagged = await measureForm(page)
  requireForm(tagged, {
    size: '"s"',
    notes: '"draft"',
    picked: 'r2',
    chosen: 't1+t2',
    tags: 't1,t2',
    lock: 'null',
    held: 'null',
    ariaDisabled: '"false"',
    step: 'after checking t1',
  })
  observed.push(
    `after checking t1 chosen = ${tagged.chosen} and the tags are still ${tagged.tags}`,
  )

  // The select's and the textarea's projections re-render from state.
  await page.click('[data-action="resize"]')
  await expect.page.attribute(page, '[data-control="size"]', 'data-size', 'l')
  const resized = await measureForm(page)
  requireForm(resized, {
    size: '"l"',
    notes: '"final"',
    picked: 'r2',
    chosen: 't1+t2',
    tags: 't1,t2',
    lock: 'null',
    held: 'null',
    ariaDisabled: '"false"',
    step: 'after resizing',
  })
  observed.push(
    `after resizing size = ${resized.size} and notes = ${resized.notes} with chosen still ` +
      `${resized.chosen}`,
  )

  // Two attributes go from ABSENT to present, and a third goes from "false" to
  // "true" without ever being absent.
  await page.click('[data-action="lock"]')
  await expect.page.attribute(page, '[data-action="lock"]', 'data-lock', 'on')
  const locked = await measureForm(page)
  requireForm(locked, {
    size: '"l"',
    notes: '"final"',
    picked: 'r2',
    chosen: 't1+t2',
    tags: 't1,t2',
    lock: '"on"',
    held: '"held"',
    ariaDisabled: '"true"',
    step: 'after locking',
  })
  observed.push(
    `after locking lock = ${locked.lock}, data-held = ${locked.held} and aria-disabled = ` +
      `${locked.ariaDisabled}`,
  )
  return observed
}

/**
 * Every row identity in S9's field list, in document order.
 *
 * A SIXTH key attribute, for the reason the second through fifth exist:
 * `measureRowKeys`, `measureCellKeys`, `measureBranchKeys`, `measureTextKeys`
 * and `measureFormKeys` each match their own attribute globally, so a scenario
 * reusing one would silently join that scenario's observation string, and S2's,
 * S4's, S5's, S6's and S7's reads have to keep measuring exactly what they
 * measured before S9 existed.
 */
export function measureAttrKeys(html: string): string[] {
  return measureKeyAttribute(html, 'data-oracle-attr-key')
}

/**
 * Whether one element's START TAG carries an attribute AT ALL, by any spelling.
 *
 * Deliberately NOT `measureAttribute`, and the difference is the whole point.
 * `measureAttribute` matches `name="value"` and therefore cannot see a bare,
 * valueless `disabled` — which is exactly how an HTML boolean attribute is
 * spelled in a served payload by any lane whose SSR serializer writes the
 * minimized form. Reading absence with a reader that is blind to one of the
 * present spellings would report "absent" for a lane that served it, which is
 * the single result this scenario exists to be able to report.
 *
 * So this matches the NAME at an attribute boundary and nothing else, and it
 * therefore catches `disabled`, `disabled=""` and `disabled="false"` alike.
 */
function startTagCarriesAttribute(startTag: string, name: string): boolean {
  return new RegExp(`\\s${name}(?=[\\s=>/])`).test(startTag)
}

/**
 * Requires that the bytes the SERVER sent carry no such attribute on the marked
 * element, and calibrates that requirement two-sided on every single call.
 *
 * This is the half of S9 that `measureAttribute` cannot express. S9's claim is
 * that a boolean content attribute lowered to `kind: 'property'` is ABSENT until
 * state says otherwise, and an absence has to be read where the claim is made:
 * in the server's own output, before any JavaScript ran. A live-DOM read after
 * activation would confuse "the lane never served it" with "the lane served it
 * and then removed it", and those are different facts about the lowering.
 *
 * The negative arm mutates the EVIDENCE, never the predicate: it injects
 * `name=""` into the marked element's own start tag — the payload the server
 * really sent, otherwise untouched — and requires the read to reject it. A check
 * on an absence is the easiest kind to leave vacuous, because it passes by
 * default on any payload at all, including an empty one; this is what stops that.
 *
 * The failure message quotes the offending start tag VERBATIM, because if any
 * lane ever trips it the string itself is the finding: it would mean the shipped
 * boolean-attribute lowering does not reach that lane's serializer, and the
 * exact bytes are what a reader needs to tell `disabled=""` from
 * `disabled="false"` — a present-but-empty attribute and a stringified `false`
 * are two different defects with two different causes.
 */
export function forbidServedAttribute(options: {
  readonly served: EnvironmentResponse
  readonly marker: string
  readonly name: string
}): number {
  const { served, marker, name } = options
  const text = served.text
  if (!text.includes(marker)) {
    throw new Error(
      `Cannot check for ${name}: the payload served for ${served.path} carries no ${marker}. ` +
        'This reads the bytes the server sent, before any JavaScript ran, so a missing marker ' +
        'means the server never rendered the element — not that the attribute is absent.',
    )
  }
  const { open, afterOpen } = locate(text, marker)
  const startTag = text.slice(open, afterOpen + 1)
  if (startTagCarriesAttribute(startTag, name)) {
    throw new Error(
      `The payload served for ${served.path} carries ${name} on ${marker}, where a boolean ` +
        'content attribute bound to a FALSE state must be absent entirely. The start tag the ' +
        `server sent is, verbatim: ${JSON.stringify(startTag)}`,
    )
  }
  // Two-sided: the same predicate, run against the same payload with the
  // attribute injected into that one start tag, must reject.
  const injected = `${startTag.slice(0, -1)} ${name}="">`
  if (!startTagCarriesAttribute(injected, name)) {
    throw new Error(
      `The absent-${name} check for ${marker} cannot go red: a start tag with ${name}="" ` +
        'injected into it still reads as absent. A check on an absence passes by default on ' +
        'any payload at all, so one never observed rejecting is not a check.',
    )
  }
  return startTag.split(name).length - 1
}

/**
 * S9's boolean attributes as the live DOM currently serializes them.
 *
 * Every boolean reading here is `null` (absent) or `""` (present and empty), and
 * that two-valued outcome is the observation. `page.content()` serializes the
 * live DOM, so a lane that set the DOM PROPERTY and a lane that set the content
 * attribute both read `""` here — which is correct and is the point: the claim
 * is about the state the six lanes end up in, not about which API each one used
 * to get there. Whether the SERVER sent it is a different question, read at a
 * different site by `forbidServedAttribute`.
 */
async function measureBooleans(page: PageHandle): Promise<{
  gate: string
  note: string
  stage: string
  sealed: string
  steps: string
  fields: string
  f1: string
  f2: string
}> {
  const html = await page.content()
  const attribute = (marker: string, name: string): string =>
    JSON.stringify(measureAttribute(html, marker, name))
  return {
    gate: attribute('data-gate="true"', 'disabled'),
    note: attribute('data-note="true"', 'required'),
    stage: attribute('data-gate="true"', 'data-stage'),
    sealed: measureText(html, 'data-sealed="true"'),
    steps: measureText(html, 'data-steps="true"'),
    fields: measureAttrKeys(html).join(','),
    f1: attribute('data-field="f1"', 'disabled'),
    f2: attribute('data-field="f2"', 'disabled'),
  }
}

/**
 * The boolean-attribute assertion, hand-rolled for the same reason
 * `requireNesting`, `requireBranch`, `requireWhitespace` and `requireForm` are:
 * the sentence a failure raises has to name WHICH reading moved and what a move
 * there means, and `expect.page.*` has no accessor that can compare an absent
 * attribute against a present one at all.
 *
 * Every value is quoted with `JSON.stringify`, because `null` (absent) and `""`
 * (present and empty) are the two halves of the axis this scenario exists to
 * measure and `expected  but got ` is not a diagnostic. A third value showing up
 * here — `"false"` or `"disabled"` or `"true"` — is a lane whose serializer
 * stringified the bound value instead of minimizing it, and the quoting is what
 * makes that legible rather than invisible.
 */
function requireBooleans(
  actual: Record<string, string>,
  expected: Record<string, string> & { step: string },
): void {
  const why: Record<string, string> = {
    gate:
      'THE AXIS. A real HTML boolean content attribute, bound to state, lowered to ' +
      "`kind: 'property'` by the repair T049 shipped. Absent means the lane served or kept " +
      'nothing at all; `""` means the lane minimized a true value. Any other string means the ' +
      'lowering did not reach that lane and the value was stringified instead.',
    note:
      'the SECOND name in the boolean class, on a different element and a different tag, ' +
      'driven by the same state. One name agreeing could be a coincidence of that name; two ' +
      'names on two tags is the class behaving as a class. `required` rather than `hidden`, ' +
      'MEASURED: qwik serves `hidden="true"` where the other five serve `""`, because ' +
      "@qwik.dev/core's own `isBooleanAttr` table lists `disabled` and omits `hidden`.",
    stage:
      'an `attribute`-kind binding on the SAME element as `gate`, and the contrast that makes ' +
      'this scenario about the KIND rather than about the element. It carries a string in both ' +
      'states while `gate` is absent in one — Angular emits `[disabled]` beside ' +
      '`[attr.data-stage]` in one start tag, and these two readings are what pin that.',
    sealed:
      'the joined ids of every SEALED row in the keyed repeat, as TEXT. It is the portable ' +
      'evidence that the seal click reached the row it was attached to, independent of the ' +
      'boolean attribute that click also drives.',
    steps:
      'the number of board-level clicks the handlers have committed. It is what makes the ' +
      'post-unlock reading waitable: an attribute going ABSENT never "becomes true" and so ' +
      'cannot be awaited, while this counter does.',
    fields: 'the keyed rows themselves. They never change, so a move here is a repeat rebuilding itself.',
    f1:
      'the boolean attribute on the row that is NEVER sealed. It must stay absent for the ' +
      'whole scenario; a `""` here is one row\'s state reaching every row.',
    f2:
      'the boolean attribute on the row that IS sealed — the same axis as `gate`, but INSIDE a ' +
      'keyed repeat, where the bound value is a member of the loop variable rather than a ' +
      'component-level state cell.',
  }
  for (const [key, want] of Object.entries(expected)) {
    if (key === 'step') continue
    if (actual[key] === want) continue
    throw new Error(
      `${expected.step} the ${key} reading is ${JSON.stringify(actual[key])}, not ` +
        `${JSON.stringify(want)}. That reading is ${why[key]}`,
    )
  }
}

/**
 * S9 — the dynamic HTML boolean content attribute, in all six lanes.
 *
 * ## Why this scenario exists at all
 *
 * T024 folded "boolean and dynamic attributes" into S7, and S7 could not carry
 * the construct: a dynamic `disabled` had no portable spelling then, so the
 * fixture substituted `aria-disabled` and asserted a PROXY for the axis. T041
 * then ruled the construct MIS-LOWERED rather than unspellable — `disabled` was
 * reaching the IR as `kind: 'attribute'`, so Angular emitted `[attr.disabled]`,
 * whose runtime writes `renderStringify(false)` and serves `disabled="false"`,
 * which in Angular's own server DOM DISABLES the control the other five lanes
 * leave enabled. T049 shipped the lowering.
 *
 * That left `docs/DEFECTS.md` entry 10 open for exactly one reason, in its own
 * words: the repair was proven at the compiler and at the emitter and IN NO
 * SERVED PAYLOAD. No scenario bound a boolean content attribute, so nothing
 * observed the six lanes agreeing at runtime — a shipped compiler capability
 * with zero corpus instances, which is the same "a rule with no instances is
 * folklore" condition this board used to justify landing S4. **This scenario is
 * that entry's own named close trigger.**
 *
 * ## The axis, and why it is not S7's
 *
 * S7's axis is that a dynamic attribute is dynamic: absent, `"false"` and a
 * value are three states, measured on `data-*` and `aria-*` bindings the six
 * lanes already agreed on. S7 proves the READER keeps `null` and `"false"`
 * apart. S9 proves the LOWERING makes six lanes agree at runtime on a genuine
 * boolean content attribute — a binding whose IR kind is `property`, not
 * `attribute`. Different kind, different site, no duplication.
 *
 * ## What is asserted, and where
 *
 * | reading | as served | after lock | after unlock |
 * |---|---|---|---|
 * | `gate`, `note` | ABSENT | `""` | ABSENT |
 * | `stage` | `"open"` | `"locked"` | `"open"` |
 *
 * The absence is read TWICE and at two different sites, because they are two
 * different claims. `forbidServedAttribute` reads the server's own bytes and
 * says the lane never sent it; `measureBooleans` reads the live DOM and says the
 * lane does not hold it after activation. A lane that served `disabled=""` and
 * then removed it during hydration would pass the second and fail the first, and
 * that lane's lowering would be broken.
 *
 * ## Why `disabled` and `required`, and not the other twelve
 *
 * `build.ts` admits fourteen names and FOUR are excluded here, each on a
 * measurement rather than on taste.
 *
 * `readonly`, `autofocus` and `autoplay` are not portable through the REACT
 * lane: react-dom 19.2.3 serves nothing for all three in BOTH states and raises
 * `Invalid DOM property`, because React's canonical props are `readOnly`,
 * `autoFocus` and `autoPlay` and no emitter in this repo carries a casing map.
 * That would additionally trip `runScenario`'s `consoleErrors: 0`.
 *
 * `hidden` is not portable through the QWIK lane, and this scenario is what
 * measured it: with `hidden` bound here, five lanes served `hidden=""` after the
 * lock click and qwik served `hidden="true"`. `@qwik.dev/core`'s own
 * `isBooleanAttr` table lists 21 names, INCLUDING `disabled` and EXCLUDING
 * `hidden`, so it minimizes the first and stringifies the second. The element is
 * still hidden either way, so this is a SERIALIZATION divergence and not a
 * behavioural one — the class T041 §2.3 named — and it is NOT an upstream matter:
 * Qwik's table is Qwik's own and this repo's oracle is the thing that asserts
 * bytes. It is recorded as a finding rather than worked around silently.
 *
 * `disabled` and `required` are what remain, and both were measured: react-dom
 * and the domino build Angular serializes from agree on every value, and
 * `required` is in qwik's, vue's and svelte's boolean tables as well.
 *
 * ## Why the boolean inside the repeat
 *
 * `gate` binds a component-level state cell. `f1`/`f2` bind a member of the LOOP
 * VARIABLE, which is a different path through the emitters, and sealing exactly
 * one of two identically-seeded rows is what separates "the boolean reached its
 * own row" from "every button in the repeat reflects the same value". Both rows
 * start `false`, so nothing is served initially anywhere.
 *
 * Nothing here reads `data-oracle-row-key`, `-cell-key`, `-branch-key`,
 * `-text-key` or `-form-key`: S2, S4, S5, S6 and S7 own those, and S9 keys its
 * rows with `data-oracle-attr-key`.
 */
export async function assertS9(
  page: PageHandle,
  expect: ExpectApi,
  served: EnvironmentResponse,
): Promise<string[]> {
  const observed: string[] = []
  await expect.page.exists(page, '[data-scenario="s9"]')
  await expect.page.text(page, '[data-gate="true"]', 'gate')
  await expect.page.text(page, '[data-sealed="true"]', 'none')

  // The server's own bytes. Three boolean bindings that are all FALSE in the
  // initial state, so the payload must carry none of them — asserted at the
  // element, not merely somewhere in the response, and calibrated on each call.
  const servedGate = forbidServedAttribute({
    served,
    marker: 'data-gate="true"',
    name: 'disabled',
  })
  const servedNote = forbidServedAttribute({
    served,
    marker: 'data-note="true"',
    name: 'required',
  })
  const servedField = forbidServedAttribute({
    served,
    marker: 'data-field="f2"',
    name: 'disabled',
  })

  const initial = await measureBooleans(page)
  requireBooleans(initial, {
    gate: 'null',
    note: 'null',
    stage: '"open"',
    sealed: 'none',
    steps: '0',
    fields: 'f1,f2',
    f1: 'null',
    f2: 'null',
    step: 'as served',
  })
  observed.push(
    `server-rendered gate carries disabled ${servedGate} times, note carries required ` +
      `${servedNote} times and field f2 carries disabled ${servedField} times, with the live ` +
      `gate ${initial.gate}, note ${initial.note}, stage ${initial.stage}, fields ` +
      `${initial.fields} and sealed ${initial.sealed}`,
  )

  // ABSENT -> PRESENT. This is the transition entry 10 named, and it is awaited
  // on the attribute itself because a boolean attribute appearing DOES become
  // true.
  await page.click('[data-action="lock"]')
  await expect.page.attribute(page, '[data-gate="true"]', 'disabled', '')
  const locked = await measureBooleans(page)
  requireBooleans(locked, {
    gate: '""',
    note: '""',
    stage: '"locked"',
    sealed: 'none',
    steps: '1',
    fields: 'f1,f2',
    f1: 'null',
    f2: 'null',
    step: 'after locking',
  })
  observed.push(
    `after locking gate = ${locked.gate}, note = ${locked.note} and stage = ${locked.stage} ` +
      `with the fields still ${locked.f1} and ${locked.f2}`,
  )

  // PRESENT -> ABSENT. Removal is the other half of the axis and it is NOT
  // implied by the half above: a lane that wrote the attribute once and never
  // reconciled it would pass every reading up to here.
  //
  // Awaited through `steps` rather than through the attribute, deliberately.
  // `expect.page.attribute` blocks until a condition becomes true, and "the
  // attribute is gone" never becomes true, so it cannot be waited for. `steps`
  // is written by the SAME handler in the same render, so reading 2 back means
  // the unlock commit has landed and the absence below is evidence rather than
  // a race — the ordering `assertS3` establishes for its cancellation arms.
  await page.click('[data-action="unlock"]')
  await expect.page.text(page, '[data-steps="true"]', '2')
  const unlocked = await measureBooleans(page)
  requireBooleans(unlocked, {
    gate: 'null',
    note: 'null',
    stage: '"open"',
    sealed: 'none',
    steps: '2',
    fields: 'f1,f2',
    f1: 'null',
    f2: 'null',
    step: 'after unlocking',
  })
  observed.push(
    `after unlocking gate = ${unlocked.gate}, note = ${unlocked.note} and stage = ` +
      `${unlocked.stage} with steps = ${unlocked.steps}`,
  )

  // The same axis INSIDE the keyed repeat, on exactly one of two identically
  // seeded rows.
  await page.click('[data-seal="f2"]')
  await expect.page.attribute(page, '[data-field="f2"]', 'disabled', '')
  const sealed = await measureBooleans(page)
  requireBooleans(sealed, {
    gate: 'null',
    note: 'null',
    stage: '"open"',
    sealed: 'f2',
    steps: '2',
    fields: 'f1,f2',
    f1: 'null',
    f2: '""',
    step: 'after sealing f2',
  })
  observed.push(
    `after sealing f2 the fields read f1 = ${sealed.f1} and f2 = ${sealed.f2} with sealed = ` +
      `${sealed.sealed} and the gate still ${sealed.gate}`,
  )
  return observed
}

/**
 * Every scenario is handed both sites — the live page and the payload the
 * server sent for it — and reads each observation from the one it names. S1, S2,
 * S4, S5 and S6 observe only live state and declare two parameters; S3, S7 and
 * S9 observe both.
 */
const assertions: Record<
  ScenarioId,
  (page: PageHandle, expect: ExpectApi, served: EnvironmentResponse) => Promise<string[]>
> = {
  s1: assertS1,
  s2: assertS2,
  s3: assertS3,
  s4: assertS4,
  s5: assertS5,
  s6: assertS6,
  s7: assertS7,
  s9: assertS9,
}

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
 * `demos/svelte-official/src/hooks.client.ts` and the T004 note.
 *
 * It matters more still for Vue, and for a different reason. Vue does not fail
 * on a hydration mismatch: it raises `[Vue warn]: Hydration … mismatch` on
 * `console.warn`, `Hydration completed but contains mismatches.` on
 * `console.error`, and then **patches the DOM to match the client** — so the
 * `console.error` half would trip `consoleErrors: 0` below, but the half that
 * names the element and both values would not, and the page would look correct
 * either way. `demos/vue-official/src/dev-sink.ts` installs the same sink, and
 * `demos/vue-official/scenarios.box.ts` additionally calibrates it against a
 * DELIBERATELY corrupted server payload before it trusts a count of zero.
 *
 * Angular is the third, and its warning is the one that would be easiest to miss
 * and worst to miss. If the client decides the server sent no hydration
 * annotations it warns NG0505 on `console.warn` — once — and then renders the
 * entire application from scratch. Nothing fails. Every observation below still
 * passes, because a client-rendered Angular page is indistinguishable from a
 * hydrated one once it has settled, and the activation-neutrality negatives in
 * `assertServedActivation` are about the SERVED payload, which is unaffected. So
 * "Angular hydrated" would rest on nothing at all without the sink.
 * `demos/angular-official/src/dev-sink.ts` installs it and
 * `demos/angular-official/scenarios.box.ts` calibrates it by serving the real S1
 * page with Angular's own `<script id="ng-state">` deleted.
 *
 * React, Solid and Qwik have no equivalent sink and are unchanged.
 *
 * Two checks are parameterised by activation because the frameworks genuinely
 * differ, and leaving either silent is what let the resume claim rest on a
 * substring:
 *
 * - `navigations`: React, Solid, Vue and Angular record 0, Qwik and Svelte
 *   record 1. Each page — in all six frameworks — issues exactly **one**
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
