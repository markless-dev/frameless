import { Component } from '@angular/core';

import { HnItem } from '../emitted/HnItem';

/**
 * The /hn-item route, and one of this lane's wrapper components.
 *
 * It exists for the reason `./todomvc-page.ts` records: to link a stylesheet on
 * this route and no other. Putting the `<link>` in `src/index.html` or in
 * angular.json's `styles` array would make it GLOBAL, and `hn.css` restyles
 * `body`, so it would change the geometry of the nine s1-s9 scenarios that
 * `pnpm e2e` compares byte for byte across six lanes. All the other lanes serving
 * this page put the link in their route wiring for the same reason, so the pages
 * stay like for like. It links the SAME sheet /hn links - one sheet, this
 * repository's own work, nothing copied from news.ycombinator.com.
 *
 * ---------------------------------------------------------------------------
 * THIS ROUTE IS THE FOURTH LANE ON THE RECURSION PAGE, AND IT ARRIVED LAST FOR A
 * REASON THAT WAS NEVER AN EMITTER REFUSAL.
 *
 * `HnItem` NAMES ITSELF: the emitted component renders `<frameless-hn-item>`
 * inside its own template, so the thread on screen is whatever the seeded
 * `parentId` chain describes and NO DEPTH IS FIXED ANYWHERE. The indentation is
 * real DOM nesting, not a computed margin - each level's `<ul>` is a descendant
 * of the previous level's `.hn-cnest`.
 *
 * Only FOUR of the six lanes get this far. svelte and vue REFUSE a same-module
 * component reference outright - a `.svelte` file and a `.vue` SFC each declare
 * exactly one component, so the self-reference has nowhere to land. Recorded
 * verbatim in packages/frameworks/{svelte,vue}/test/unbuilt-scenarios.ts.
 *
 * THIS LANE WAS THE THIRD KIND OF ABSENCE, AND IT IS NOW RESOLVED. The emitter
 * always took S14 and produced a correct recursive component; the lane's OWN
 * DOSSIER GATE rejected the result, because the decorator carries `imports:
 * [HnItem]` and `imports` was not in `BASELINE_FORM_INVENTORY`. That was the
 * dossier working as designed rather than a defect. frameless-app-axes-v1 T009
 * ruled ADMIT at floor 14.0 with evidence `unverified`, and the derived
 * `ANGULAR_BASELINE_FLOOR` did not move: it reads 19.0 before and 19.0 after,
 * because the floor is a MAX reduce over the inventory and the sole 19.0 entry is
 * `component-metadata:(no standalone key)`.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS PAGE'S EVIDENCE IS A BROWSER AND NOT A COMPILER.
 *
 * ANGULAR 22.0.8 IGNORES THE `imports` ENTRY THIS COMPONENT CARRIES. Measured by
 * T009 against this demo's own tsconfig plus `strictTemplates`:
 * `@angular/compiler-cli` reports ZERO diagnostics WITH `imports: [HnItem]` and
 * ZERO WITHOUT it, and the compiled `defineComponent` carries
 * `dependencies: [HnItem]` in BOTH arms - because
 * `StandaloneComponentScopeReader` seeds a component's own scope and then skips a
 * self-entry with `if (seen.has(ref.node)) continue;`. The control is two-sided:
 * a SIBLING selector and an UNKNOWN element both draw `NG-998001`, and a planted
 * unknown member draws `NG2339`, so the instrument does go red.
 *
 * SO THE GATE, `tsc` AND AOT ARE ALL GREEN AND ALL BLIND HERE, and the only real
 * verdict on this lane is the rendered DOM: fifteen recursive instances, nesting
 * depth four, and collapsing `c1` removing `c4` - a depth-3 descendant no handler
 * names. That is recorded in
 * docs/goals/frameless-app-axes-v1/notes/T014-angular-s14.md.
 *
 * WHAT WORKS: collapse `[-]` and expand `[+]` on any comment - which take the
 * whole recursive subtree with them - and the per-comment upvote arrow.
 * WHAT IS INERT AND NOT FAKED: the story vote arrow, `hide`, `past`, `favorite`,
 * `reply` and the masthead links.
 * AND THE SENTENCE THAT FOLLOWED THAT LIST WAS A NON-SEQUITUR, corrected by
 * frameless-app-fidelity-v1 T002/T006. It read "`.tsrx` has no routing construct,
 * SO this page is not reachable from /hn by clicking." THE PREMISE IS TRUE -
 * packages/compiler/src/schema.ts declares no route node kind - AND THE "SO" IS
 * FALSE. /hn's comments links already emitted `preventDefault()` plus
 * `onTrace('comments', { id }, event)`, so the destination was named and typed
 * all along; the missing piece was a SINK, and `./hn-page.ts` now dispatches it
 * through this lane's own `Router`. THIS PAGE IS REACHED BY CLICKING.
 * THAT IS A FOUR-LANE CLAIM: svelte and vue emit no `HnItem` at all.
 * WHAT IS ABSENT: the reference's reply BOX - see the fixture's constraint (16).
 *
 * NO TRACE CHANNEL, AND THAT IS ALSO A MEASUREMENT. S14 is the only module in the
 * corpus with no `onTrace` prop, because a recursive component must forward every
 * required prop to itself and the qwik emitter cannot forward a FUNCTION prop
 * across a component boundary in any spelling. This wrapper therefore passes NO
 * trace, unlike every other wrapper in this file's directory.
 *
 * `parent` and `depth` are spelled HERE rather than as route `data` because they
 * are the recursion's own parameters and are the same in all four lanes;
 * `withComponentInputBinding()` would work equally, but the other three lanes
 * write `<HnItem parent="root" depth={0} />` at the call site and this keeps the
 * four readable side by side.
 *
 * NOTHING HERE IS EMITTED OUTPUT and nothing here is app code: this component
 * renders the emitted `<frameless-hn-item>` and one `<link>`.
 */
@Component({
  selector: 'app-hn-item-page',
  imports: [HnItem],
  template: `
    <link rel="stylesheet" href="/hn-css/hn.css" />
    <frameless-hn-item parent="root" [depth]="0" />
  `,
})
export class HnItemPage {}
