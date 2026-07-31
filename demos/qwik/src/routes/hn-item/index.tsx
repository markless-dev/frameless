import { component$ } from "@qwik.dev/core";
import { HnItem } from "../../emitted/HnItem.jsx";

// THE FIFTH APPLICATION - the HACKER NEWS ITEM PAGE - and THE RECURSION PAGE.
// `HnItem` NAMES ITSELF: the emitted component renders `<HnItem>` inside its
// own template, so the thread on screen is whatever the seeded `parentId`
// chain describes and NO DEPTH IS FIXED ANYWHERE. The indentation you see is
// real DOM nesting, not a computed margin - each level's `<ul>` is a
// descendant of the previous level's `.hn-cnest`.

// THREE OF SIX LANES SERVE THIS PAGE, and the three absences are the
// measurement this page exists for:
//   svelte and vue REFUSE a same-module component reference outright - a
//     `.svelte` file and a `.vue` SFC each declare exactly one component, so
//     the self-reference has nowhere to land. Recorded verbatim in
//     packages/frameworks/{svelte,vue}/test/unbuilt-scenarios.ts.
//   angular EMITS a correct recursive component and its OWN GATE REJECTS the
//     result: the decorator must carry `imports: [HnItem]` for the selector
//     to resolve, and `imports` is not in that lane's BASELINE_FORM_INVENTORY.
//     Recorded in packages/frameworks/angular/test/ungated-scenarios.ts.

// WHAT WORKS: collapse `[-]` and expand `[+]` on any comment - which take the
// whole recursive subtree with them - and the per-comment upvote arrow.
// WHAT IS INERT AND NOT FAKED: the story vote arrow, `hide`, `past`,
// `favorite`, `reply` and the masthead links. `.tsrx` has no routing
// construct, so this page is not reachable from /hn by clicking.
// WHAT IS ABSENT: the reference's reply BOX. A controlled `<textarea>` needs
// a scalar cell, and the Solid emitter mis-lowers every scalar read inside a
// handler once a module carries a same-module component reference - see
// packages/compiler/test/fixtures/s14-hn-item.tsrx constraint (16), which
// isolates it on a two-source probe.

// IT LINKS THE SAME `hn-css/hn.css` /hn does - one sheet, this repository's
// own work, nothing copied from news.ycombinator.com - and links it HERE
// rather than globally because it restyles `body`, which would move the
// geometry of the nine s1-s9 scenarios `pnpm e2e` compares across six lanes.
// NO TRACE CHANNEL, AND THAT IS ALSO A MEASUREMENT. S14 is the only module in
// the corpus with no `onTrace` prop: a recursive component must forward every
// required prop to itself, and the qwik emitter cannot forward a FUNCTION
// prop across a component boundary in any spelling - it declares and reads
// `onTrace$` and prints `onTrace` at the call site. The oracle for this page
// is the RENDERED DOM instead, which is stronger anyway: collapse, expand and
// the comment upvote each change what is on screen. See constraint (18).
export default component$(() => (
  <>
    <link rel="stylesheet" href="/hn-css/hn.css" />
    <HnItem parent="root" depth={0} />
  </>
));
