import { state } from '@markless/core';

// THE FIFTH APPLICATION IN THIS CORPUS - the HACKER NEWS ITEM PAGE - and THE
// RECURSION CARD. It rides the next ORDINAL slot for the reason S10-S13 record:
// ten-plus per-lane suites derive their `generated/` inventory from
// /^s(\d+)-[\w-]+\.json$/ and assert it EXACTLY, so a fourteenth artifact named
// anything else is rejected by construction. `scripts/e2e.mjs` still pins
// `threeWayScenarios` to the literal ['s1'..'s9'], so this app does NOT join the
// 6 x 9 three-way contract.
//
// ===========================================================================
// THE AXIS: RECURSION. NOTHING ELSE IN THE CORPUS IS SELF-REFERENTIAL.
// ===========================================================================
//
// `HnItem` NAMES ITSELF IN ITS OWN TEMPLATE. There is no fixed depth anywhere
// in this module: the tree that appears on screen is whatever the seeded
// `parentId` chain describes, and the instance count is 1 + one per comment.
// THIS IS THE MEASUREMENT, so read the three spellings and their verdicts:
//
//   SPELLING A - SAME-MODULE SELF-REFERENCE (what this module uses):
//       react EMITS · solid EMITS · qwik EMITS · angular EMITS
//       svelte REFUSES: "Svelte emitter has no lowering for a same-module
//         component reference (HnItem): a .svelte file declares exactly one
//         component, and a snippet cannot own state or a lifecycle"
//       vue REFUSES: "Vue emitter has no lowering for a same-module component
//         reference (HnItem): a .vue SFC declares exactly one component"
//       `resolveModuleSet` LINKS IT: a `module: 'self'` target is never added
//       to the cycle graph, so the linker's own cycle check does not fire.
//
//   SPELLING B - THE MODULE IMPORTS ITSELF UNDER AN ALIAS, which is how Svelte
//       and Vue spell recursion natively. MEASURED, and it is the EXACT
//       COMPLEMENT of spelling A:
//       react EMITS · solid EMITS · svelte EMITS (`import Self from
//         './comment.svelte'`) · vue EMITS
//       qwik REFUSES: "Qwik emitter has no lowering for a renamed ModuleImport:
//         Comment as Self"
//       angular REFUSES: "Angular emitter has no lowering for a renamed
//         ModuleImport: Comment as Self"
//       AND THE LINKER REFUSES IT OUTRIGHT: "Component-reference cycle:
//         src/comment.tsrx -> src/comment.tsrx". Un-aliased it never reaches the
//         linker at all - `import { Comment } from './comment.tsrx'` next to
//         `export function Comment` is "Identifier 'Comment' has already been
//         declared".
//       It is also UNSHIPPABLE IN THIS CORPUS'S LAYOUT: the emitted import
//       specifier is derived from the `.tsrx` specifier, so a module built from
//       `s14-hn-item.tsrx` would import `./s14-hn-item.svelte` while the
//       artifact on disk is `generated/S14.svelte`.
//
//   SPELLING C - TWO MODULES IN MUTUAL REFERENCE, A -> B -> A. MEASURED because
//       a single refusal is not a verdict on an axis: ALL SIX EMITTERS EMIT BOTH
//       MODULES, and the LINKER refuses the pair - "Component-reference cycle:
//       src/a.tsrx -> src/b.tsrx -> src/a.tsrx". So multi-module recursion is
//       closed in all six lanes, and it is closed at the LINKER rather than at
//       any emitter.
//
// SPELLING A IS THE ONE SHIPPED because it is the only spelling that both emits
// and links, and because it wins the two lanes (qwik, angular) that spelling B
// loses. NO FIXED-DEPTH UNROLL WAS NEEDED OR USED: the fallback on this card was
// conditioned on BOTH spellings refusing, and four lanes take spelling A.
//
// ===========================================================================
// THE FIFTEEN CONSTRAINTS. (1)-(13) are inherited from S10-S13 because the same
// lanes still enforce them; (14) and (15) were measured ON THIS SOURCE.
// ===========================================================================
//
// (1) NO SEED PROP. The comment forest is seeded IN THE COMPONENT, exactly as
//     S10-S13 seed their lists, and EVERY RECURSIVE INSTANCE SEEDS THE SAME
//     FOREST AND FILTERS IT BY `parent`. That is not a workaround for the array
//     limit alone - it is what lets the recursion carry only SCALARS across the
//     boundary (`parent: string`, `depth: number`), which is the only shape the
//     six emitters' IR-8 prop lowering accepts without a type this module cannot
//     prove resolvable in emitted output.
//     THE ARRAY LIMIT ITSELF IS NARROWER THAN S13 RECORDED, and it is worth
//     writing down because the next card will reach for it: `kids: string[]`
//     throws "has no IR-8 lowering for the type node TSArrayType" in react,
//     qwik, svelte and angular - but `kids: Array<string>` LOWERS IN FIVE LANES,
//     because `TSTypeReference` with type arguments IS in the accepted set and
//     `TSArrayType` simply is not. The limit is on the SPELLING, not on arrays.
//     It still cannot carry a comment: `Array<CommentNode>` prints a type name
//     the emitted module cannot resolve, and an inline `Array<{ id: string }>`
//     throws on `TSTypeLiteral` in all six.
//
// (2) THE PARENT FILTER IS A `hidden` BINDING ON THE ROW plus a BRANCH INSIDE
//     it, not a repeat over a filtered view. Repeating over a `computed` is
//     refused by Solid, and the row itself must stay one host (S13 constraint 2).
//     THE BRANCH IS ALSO WHAT MAKES THE RECURSION TERMINATE: the recursive
//     `<HnItem>` sits inside the true arm, so an instance is created for a real
//     child and for nothing else. Total instances = 1 + one per comment.
//
// (3) EVERY CLICKABLE IS A `<button type="button">` OR AN `<a>` WITH A REAL
//     `href`, and every inert link is `href="#/..."` - `href="#"` is refused by
//     the svelte gate (`a11y_invalid_attribute`).
//
// (4) NO TWO-WORD DOM EVENT IS AUTHORABLE AT ALL (DEFECTS.md 15).
//
// (5) NO STATE WRITE SITS INSIDE AN `if` (DEFECTS.md 8.1). Every write here is
//     top-level and unconditional.
//
// (6) EVERY STRING CELL IS A `''`-SENTINEL, never `state(null)`.
//
// (7) NO TOP-LEVEL SIDE-EFFECT CALL in the component body.
//
// (8) NO TEMPLATE TEXT NODE HAS WHITESPACE EDGES, so every `|` separator is its
//     own `<span class="hn-bar">|</span>` host and every gap on this page is a
//     flex `gap` in `demos/shared/hn-css/hn.css`.
//
// (9) THE AGES ARE LITERAL STRINGS. `Date` is a global and the Angular emitter
//     cannot NAME a global inside a transplanted body.
//
// (10) NO ELEMENT WITH A HANDLER MAY SIT BESIDE TEXT (S13 constraint 12, three
//     lanes at once). Every text run here has its own `<span>`.
//
// (11) A `<form>` CARRYING A `submit` HANDLER ALSO CARRIES A `click` TRACE, or
//     the Svelte emitter refuses the module for a suppression that changes
//     nothing (S13 constraint 13).
//
// (12) EVERY HANDLER READS ITS NEW VALUE FROM A `const` TAKEN BEFORE THE WRITE
//     (`next`, `text`), never from the cell it just wrote. The six lanes do not
//     agree on whether a post-write read sees the new value.
//
// (13) THE STORY LINK IS `preventDefault`ed.
//
// (14) INDENTATION IS REAL DOM NESTING, NOT A COMPUTED MARGIN. Each level's
//     `<ul class="hn-comments">` is a descendant of the previous level's
//     `.hn-cnest`, so `hn.css` indents with ONE rule and the rendered
//     indentation IS the recursion depth. A `depth`-driven margin would have
//     rendered identically while proving nothing, which is exactly the
//     substitution this card's oracle rejects. `depth` is carried anyway, but
//     only to (a) gate the masthead and the story header to the root instance
//     and (b) publish `data-depth` so the nesting can be ASSERTED off the
//     rendered image.
//
// (18) THERE IS NO `onTrace` PROP ON THIS MODULE AT ALL, AND IT IS THE FIRST
//     FIXTURE IN THE CORPUS WITHOUT ONE. FORCED BY A QWIK EMITTER DEFECT THAT,
//     LIKE (16), ONLY THE RECURSION AXIS COULD REACH. ISOLATED ON A PROBE:
//     the qwik emitter renames a function-typed prop to the `$`-suffixed QRL
//     spelling in the DECLARATION (`onTrace$: (...) => void`) and at every READ
//     (`props.onTrace$(...)`), but at a COMPONENT-REFERENCE call site it prints
//     the AUTHORED name:
//       <P depth={props.depth} onTrace={props.onTrace$} />
//     so the child is handed `onTrace` and looks for `onTrace$`. This lane's own
//     emitted-output typecheck reports it:
//       Type '{ parent: string; depth: number; onTrace: (...) => void; }' is
//       not assignable to type 'IntrinsicAttributes & Omit<{ ...; onTrace$:
//       (...) => void; }, `${string}$`> & _Only$<...>
//     AUTHORING THE PROP AS `onTrace$` DOES NOT HELP - the suffix is appended
//     UNCONDITIONALLY, giving `onTrace$$` in the declaration and still `onTrace$`
//     at the call site. There is NO spelling of a function prop that survives a
//     component boundary in this lane.
//     WHY NOTHING HAD HIT IT: the shipped composition corpus (M1-panel/M2-page)
//     forwards only DATA props, and every scenario before this one is a single
//     component, so no module in the repo had ever passed a callback across a
//     component boundary. A recursive component MUST forward every required prop
//     to itself, which is what makes recursion the thing that found it.
//     THE NARROWING: this page has no trace channel, and its oracle is the
//     RENDERED DOM instead - collapse, expand and the comment upvote each change
//     what is on screen and what `[hidden]` reports, which is a stronger
//     observation than a callback anyway. The consequence is that every INERT
//     control here is a plain `<a href="#/...">` with NO handler rather than a
//     preventDefault + trace pair, so a left click moves the fragment and
//     nothing else. NO EMITTER WAS TOUCHED.
//
// (16) NO SCALAR `state()` CELL IS READ INSIDE A HANDLER, AND NO CONTROLLED
//     INPUT EXISTS AT ALL - BOTH FORCED BY A SOLID EMITTER DEFECT THAT ONLY
//     APPEARS ONCE A MODULE CARRIES A SAME-MODULE COMPONENT REFERENCE. This is
//     the recursion axis producing a defect nothing else in the corpus could
//     have found, and it was ISOLATED on a minimal probe, not inferred from this
//     module: two sources identical except for one `@if (depth > 0) { <div><P
//     ... /></div> }` arm.
//       WITHOUT the self-reference: `const text = draft();` and the textarea
//         emits BOTH `value={draft()}` and `attr:value={draft()}`.
//       WITH it: `const text = draft()();` - a DOUBLE CALL, which this lane's
//         own emitted-output typecheck reports as "generated/S14.tsx: TS2349
//         This expression is not callable.   Type 'String' has no call
//         signatures." - and the `attr:value` pair is DROPPED, which this lane's
//         own dossier gate rejects as "Controlled text value requires onInput
//         and an identical attr:value pair" (policy `controlled-input`,
//         `T003 ruling 7`).
//     EVERY signal read inside a handler doubles; STORE reads do not (`comments`
//     is a `createStore` and every `.map` and spread over it lowers correctly),
//     and TEMPLATE reads do not. So the narrowing is: the comment forest stays a
//     store and carries all mutable state, while the story header's vote arrow
//     is an INERT trace like `hide`, `past` and `favorite` beside it, and THE
//     REPLY BOX THE REFERENCE CARRIES IS NOT HERE - a controlled `<textarea>`
//     needs a scalar cell and would be rejected by that lane's own gate.
//     NO EMITTER WAS TOUCHED. Recorded rather than repaired, which is this
//     board's standing instruction.
//
// (17) THE REPLY BOX'S REMOVAL ALSO RETIRED A MEASUREMENT WORTH KEEPING: while
//     it existed, `rows="6"` on the `<textarea>` made the react lane's
//     emitted-output typecheck report "generated/S14.tsx: TS2322 Type 'string'
//     is not assignable to type 'number'", because
//     `TextareaHTMLAttributes.rows` is `number` and this authoring surface has
//     no way to spell a STATIC NUMERIC attribute at all. S12 ships a textarea
//     and never set `rows`, so no earlier fixture had reached it.
//
// (15) COLLAPSE IS THE RECURSION'S OWN OBSERVABLE. `[-]` sets `collapsed` on the
//     comment, which hides the comment's text, its `reply` link and - the part
//     that matters - `.hn-cnest`, the element that HOLDS THE RECURSIVE INSTANCE.
//     The `kidsLabel` run appears in its place. A lane that had unrolled the
//     thread instead of recursing would still pass a screenshot; it would fail
//     the moment a collapse at depth 1 has to take a depth-4 descendant with it.
//     `kidsLabel` is LITERAL SEEDED DATA for constraint (9)'s reason - counting
//     descendants would need a filter over the forest in a template expression.
//
// WHAT IS DELIBERATELY NOT HERE. `.tsrx` has no routing construct, so this page
// does not navigate from the front page and `hide`, `past`, `favorite` and
// `reply` are INERT traces. `add comment` appends a TOP-LEVEL comment to the
// ROOT instance's own forest, which is also the cheapest proof that each
// recursive instance owns its state independently: the new row appears at depth
// 0 and nowhere else.
export function HnItem({ parent, depth }: {
	parent: string;
	depth: number;
}) @{
	let comments = state([
		{ id: 'c1', parentId: 'root', author: 'tptacek', age: '3 hours ago', text: 'The measurement is the interesting part, not the clone.', kidsLabel: '3 replies', collapsed: false, voted: false },
		{ id: 'c2', parentId: 'c1', author: 'pg', age: '2 hours ago', text: 'Agreed - a refusal you can quote is worth more than a guess.', kidsLabel: '2 replies', collapsed: false, voted: false },
		{ id: 'c3', parentId: 'c2', author: 'dang', age: '2 hours ago', text: 'It also has to be read off the real module, not off a probe.', kidsLabel: '1 reply', collapsed: false, voted: false },
		{ id: 'c4', parentId: 'c3', author: 'jl', age: '1 hour ago', text: 'That rule was bought with a defect, which is why it is written down.', kidsLabel: 'no replies', collapsed: false, voted: false },
		{ id: 'c5', parentId: 'c1', author: 'patio11', age: '2 hours ago', text: 'Nesting depth is the only thing on this page that cannot be faked.', kidsLabel: 'no replies', collapsed: false, voted: false },
		{ id: 'c6', parentId: 'root', author: 'sama', age: '4 hours ago', text: 'Does the thread actually recurse, or is it unrolled to a fixed depth?', kidsLabel: '4 replies', collapsed: false, voted: false },
		{ id: 'c7', parentId: 'c6', author: 'evanyou', age: '4 hours ago', text: 'It recurses - the component names itself in its own template.', kidsLabel: '3 replies', collapsed: false, voted: false },
		{ id: 'c8', parentId: 'c7', author: 'ryansolid', age: '3 hours ago', text: 'Two lanes refuse that spelling outright, and the message says why.', kidsLabel: '2 replies', collapsed: false, voted: false },
		{ id: 'c9', parentId: 'c8', author: 'mhevery', age: '3 hours ago', text: 'One file, one component - so the self-reference has nowhere to land.', kidsLabel: '1 reply', collapsed: false, voted: false },
		{ id: 'c10', parentId: 'c9', author: 'minimaxir', age: '2 hours ago', text: 'Five levels deep, and the indentation is real DOM nesting.', kidsLabel: 'no replies', collapsed: false, voted: false },
		{ id: 'c11', parentId: 'root', author: 'whoishiring', age: '5 hours ago', text: 'Collapse the subtree and the recursive instance goes with it.', kidsLabel: '1 reply', collapsed: false, voted: false },
		{ id: 'c12', parentId: 'c11', author: 'frameless', age: '5 hours ago', text: 'Every level seeds the same data and filters it by parent.', kidsLabel: 'no replies', collapsed: false, voted: false },
		{ id: 'c13', parentId: 'root', author: 'dang', age: '6 hours ago', text: 'Please keep the discussion on the axis being measured.', kidsLabel: '1 reply', collapsed: false, voted: false },
		{ id: 'c14', parentId: 'c13', author: 'jacquesm', age: '6 hours ago', text: 'The axis is recursion, and it has a verdict per lane now.', kidsLabel: 'no replies', collapsed: false, voted: false },
	]);

	<div class="hn-thread" data-thread={parent} data-depth={depth}>
		@if (depth === 0) {
			<div class="hn-itemhead" data-hn="itemhead">
				<header class="hn-head" data-hn="masthead">
					<a class="hn-logo" href="#/" data-hn="logo"><span class="hn-y">Y</span></a>
					<a class="hn-brand" href="#/" data-hn="brand">Hacker News</a>
					<a class="hn-login" href="#/login" data-hn="login">login</a>
				</header>
				<div class="hn-story" data-story="h1">
					<span class="hn-titleline">
						<button type="button" class="hn-vote" aria-label="upvote" data-vote="h1"></button>
						<a class="hn-storylink" href="https://github.com/markless-dev/frameless" data-title="h1">Emit six framework lanes from one authored source</a>
						<span class="hn-domain" data-domain="h1">(github.com)</span>
					</span>
					<span class="hn-subtext" data-subtext="h1">
						<span class="hn-score" data-points="h1">412</span>
						<span class="hn-scorelabel">points</span>
						<span class="hn-meta">by pg 3 hours ago</span>
						<span class="hn-bar">|</span>
						<a class="hn-act" href="#/hide" data-act="hide">hide</a>
						<span class="hn-bar">|</span>
						<a class="hn-act" href="#/past" data-act="past">past</a>
						<span class="hn-bar">|</span>
						<a class="hn-act" href="#/favorite" data-act="favorite">favorite</a>
						<span class="hn-bar">|</span>
						<span class="hn-act" data-act="count">128 comments</span>
					</span>
				</div>
							</div>
		} @else {
		}
		<ul class="hn-comments" data-comments={parent}>
			@for (const comment of comments; key comment.id) {
				<li class="hn-comment" data-comment={comment.id} hidden={comment.parentId !== parent}>
					@if (comment.parentId === parent) {
						<div class="hn-c" data-c={comment.id}>
							<div class="hn-chead">
								<button type="button" class="hn-vote" aria-label="upvote" data-cvote={comment.id} hidden={comment.voted} onClick={() => {
									comments = comments.map((entry) => entry.id === comment.id ? { id: entry.id, parentId: entry.parentId, author: entry.author, age: entry.age, text: entry.text, kidsLabel: entry.kidsLabel, collapsed: entry.collapsed, voted: true } : entry);
								}}></button>
								<span class="hn-cby" data-cby={comment.id}>{comment.author}</span>
								<span class="hn-cage">{comment.age}</span>
								<button type="button" class="hn-ctoggle" data-collapse={comment.id} hidden={comment.collapsed} onClick={() => {
									comments = comments.map((entry) => entry.id === comment.id ? { id: entry.id, parentId: entry.parentId, author: entry.author, age: entry.age, text: entry.text, kidsLabel: entry.kidsLabel, collapsed: true, voted: entry.voted } : entry);
								}}>[-]</button>
								<button type="button" class="hn-ctoggle" data-expand={comment.id} hidden={!comment.collapsed} onClick={() => {
									comments = comments.map((entry) => entry.id === comment.id ? { id: entry.id, parentId: entry.parentId, author: entry.author, age: entry.age, text: entry.text, kidsLabel: entry.kidsLabel, collapsed: false, voted: entry.voted } : entry);
								}}>[+]</button>
								<span class="hn-ckids" data-ckids={comment.id} hidden={!comment.collapsed}>{comment.kidsLabel}</span>
							</div>
							<div class="hn-ctext" data-ctext={comment.id} hidden={comment.collapsed}>
								<span class="hn-cbody">{comment.text}</span>
							</div>
							<div class="hn-creply" hidden={comment.collapsed}>
								<a class="hn-act" href="#/reply" data-reply={comment.id}>reply</a>
							</div>
							<div class="hn-cnest" data-cnest={comment.id} hidden={comment.collapsed}>
								<HnItem parent={comment.id} depth={depth + 1} />
							</div>
						</div>
					} @else {
					}
				</li>
			}
		</ul>
	</div>
}
