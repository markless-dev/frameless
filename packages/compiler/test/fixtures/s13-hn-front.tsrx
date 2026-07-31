import { state } from '@markless/core';

// THE FOURTH APPLICATION IN THIS CORPUS - the HACKER NEWS FRONT PAGE - authored
// ONCE and attempted in all six lanes. It rides the next ORDINAL slot for the
// reason S10, S11 and S12 record: ten-plus per-lane suites derive their
// `generated/` inventory from `/^s(\d+)-[\w-]+\.json$/` and assert it EXACTLY,
// so a thirteenth artifact named anything else is rejected by construction.
// `scripts/e2e.mjs` still pins `threeWayScenarios` to the literal ['s1'..'s9'],
// so this app does NOT join the 6 x 9 three-way contract - browsable first.
//
// THE AXIS THIS MODULE MEASURES IS "DATA WITHOUT A DOOR", and the door is shut
// BEFORE this module starts. FETCH-ON-RENDER IS UNREACHABLE IN EVERY LANE: there
// is no lifecycle hook in this authoring surface at all, and `computed(async ...)`
// is closed by a pincer upstream of every emitter (frameless-app-suite-v1 T001).
// SO THE FRONT PAGE CANNOT LOAD ON APPEAR. The story list is seeded IN THE
// COMPONENT exactly as S10, S11 and S12 seed theirs, which is stated here rather
// than implied because a reader who sees a Hacker News clone will otherwise
// assume it talks to the Firebase API and read the absence as an oversight. It is
// not an oversight; it is the measurement.
//
// THE FOURTEEN CONSTRAINTS BELOW ARE MEASURED. (1)-(8) are inherited from S10/
// S11/S12 because the same lanes still enforce them; (9)-(14) were measured ON
// THIS SOURCE, and (12), (13) and (14) were each bought with a REFUSAL this
// module hit on an emit attempt - (12) and (13) on its first, (14) on T006's.
//
// (1) NO SEED PROP. IR-8 has no lowering for `TSArrayType` - react, svelte and
//     angular each throw "has no IR-8 lowering for the type node TSArrayType" -
//     so the stories are seeded in the component and all six lanes start from
//     byte-identical data with no host wiring to keep in step.
//
// (2) THE SEARCH FILTER IS A `hidden` BINDING ON THE ROW, not a repeat over a
//     filtered view. Repeating over a `computed` is refused by Solid ("Array
//     state state:stories has unconsumed keyed identity semantics") and wrapping
//     the row in a branch is refused by three lanes at once on the one-host-root
//     rule. So the repeat stays over `stories`, every row keeps its key across a
//     keystroke, and one expression decides `hidden`. The spelling is S11's,
//     which is the only spelling in this corpus that five lanes have already
//     printed.
//
// (3) EVERY CLICKABLE IS A `<button type="button">` OR AN `<a>` WITH A REAL
//     `href`. Svelte's emitted-form gate refuses a bare `<span>` carrying a click
//     handler (`a11y_no_static_element_interactions`), and it refuses
//     `href="#"` and `href=""` outright (`a11y_invalid_attribute`) - which is why
//     every inert link here is spelled `href="#/..."`, the form S10's filter links
//     already proved.
//
// (4) NO TWO-WORD DOM EVENT IS AUTHORABLE AT ALL (DEFECTS.md 15). Every emitter
//     derives its event name with `name.slice(2).toLowerCase()`, so `onKeyDown`
//     prints `onKeydown` and react-dom NEVER FIRES it. The footer search
//     therefore rides `onInput` plus implicit form `submit`, and there is no
//     keyboard shortcut anywhere. Nothing here fakes the keyboard.
//
// (5) NO STATE WRITE SITS INSIDE AN `if`. DEFECTS.md 8.1: the react emitter
//     lowers only TOP-LEVEL handler statements, so a write nested in an `if` is
//     NEITHER LOWERED NOR REFUSED. Every conditional here is a conditional
//     EXPRESSION and every write is top-level and unconditional.
//
// (6) EVERY STRING CELL IS A `''`-SENTINEL, never `state(null)`: `state(null)`
//     pins the inferred cell type to `null` and the first non-null write does not
//     type (a live qwik TS2322 on s7 in this repo's own `pnpm check`).
//
// (7) NO TOP-LEVEL SIDE-EFFECT CALL in the component body - one emits
//     `useRef(null)` in the react lane and costs a type error.
//
// (8) NO TEMPLATE TEXT NODE HAS WHITESPACE EDGES. Angular's `escapeText` refuses
//     one outright - "a text node whose own edges are whitespace renders
//     differently from the react, solid, qwik, svelte and vue lanes" - and the
//     Vue gate rejects the emitted result. THIS IS THE RULE THAT SHAPES THE WHOLE
//     SUBTEXT LINE, and it is why this page's markup cannot be the reference's.
//     news.ycombinator.com separates its subtext links with LITERAL `" | "` TEXT
//     NODES; here every separator has to be its own
//     `<span class="hn-bar">|</span>` host. Sixteen of the template's sixty-two
//     hosts exist for no other reason.
//     AND THE SPACING CANNOT COME FROM THE EMITTED FORMATTING EITHER. The six
//     emitters print sibling elements with different inter-element whitespace -
//     JSX drops a whitespace-only line, `@vue/compiler-sfc` condenses it,
//     Angular's `preserveWhitespaces: false` removes it, Svelte keeps it - so a
//     layout that leaned on it would render differently per lane. Every gap on
//     this page is therefore a flex `gap` in `demos/shared/hn-css/hn.css`, which
//     a flex container makes independent of whitespace in every engine. MEASURED:
//     with that in place all six lanes agree to the PIXEL on every element rect
//     and on the rendered text width.
//
// (9) THE AGES ARE LITERAL STRINGS AND SO IS EVERY RANK. `Date` is a global and
//     the Angular emitter cannot NAME a global inside a transplanted body, so a
//     computed "3 hours ago" would lose that lane for a reason that has nothing
//     to do with this card's axis. S12 constraint (12) already made this ruling
//     for chat stamps; the correction worth recording is that a relative age
//     CANNOT be rescued by passing it as a PROP either, because it is PER ROW and
//     IR-8 has no array lowering (constraint 1) - there is no prop shape that can
//     carry twelve ages. Literal data is the only spelling that survives, and it
//     is the same one the reference's own server-rendered HTML uses.
//
// (10) `pointsLabel` IS DATA THAT THE VOTE HANDLER REBUILDS, and the twelfth
//     story is seeded at ONE point so the singular is on screen at load. Voting
//     it flips `'point'` to `'points'` in the same write that moves the score,
//     which is the cheapest observable in the app that proves a row's derived
//     text is recomputed rather than merely re-rendered. It is the ONLY way the
//     singular is reachable at all - unvote is only offered after a vote, so no
//     score can fall to one - which is why one seeded story carries a point count
//     no real front page would.
//
// (11) THE STORY LINK IS `preventDefault`ed. `href={story.url}` is real, so the
//     status bar and the middle-click both behave, but a left click stays on the
//     page - a demo that navigated to github.com on the first click would be
//     unobservable in every lane at once.
//
// (12) NO ELEMENT WITH A HANDLER MAY SIT BESIDE TEXT. MEASURED ON THIS MODULE,
//     ON ITS FIRST EMIT ATTEMPT, IN THREE LANES AT ONCE. The subtext originally
//     read `<span class="hn-score">{story.points}</span>{story.pointsLabel}` with
//     the `unvote` and `hide` buttons as later siblings of those dynamic texts.
//     react, solid and qwik took it. The other three refused, VERBATIM:
//       svelte:  Svelte emitter cannot inline <button>: it sits beside text and
//                needs a multi-line start tag
//       vue:     Vue emitter cannot inline <button>: it sits in a text-bearing
//                run and needs a multi-line start tag
//       angular: Angular emitter cannot inline <button>: it sits in a
//                text-bearing run and needs a multi-line start tag
//     The mechanism is identical in all three: a parent with ANY text child
//     prints its children inline, and an inline host whose start tag does not fit
//     on one line is refused rather than printed with newlines that would change
//     what the page renders. A handler attribute is always multi-line. THE
//     NARROWING IS TO GIVE EVERY TEXT RUN ITS OWN `<span>`, which makes the
//     parent's children all hosts, which un-inlines them. No emitter was touched.
//
// (13) THE FOOTER SEARCH FORM CARRIES A CLICK HANDLER IT DOES NOT NEED, AND THAT
//     IS ALSO A REFUSAL. The Svelte emitter suppresses
//     [a11y_click_events_have_key_events,
//     a11y_no_noninteractive_element_interactions] at every `<form>` carrying an
//     event, then proves the suppression fires in BOTH directions. A form with a
//     `submit` handler and no `click` handler makes it redundant, VERBATIM:
//       Emitted Svelte module HnFront.svelte suppresses
//       [a11y_click_events_have_key_events,
//       a11y_no_noninteractive_element_interactions] but without those
//       annotations Svelte reports []. A suppression that changes nothing is a
//       silent over-fire.
//     S10, S11 and S12 all happen to carry a `press` trace on their forms, so no
//     earlier fixture ever reached it. This one now does the same, which is the
//     narrowing rather than a workaround: `press` is a real observation channel.
//
// (14) NO APOSTROPHE MAY APPEAR IN TEMPLATE TEXT, MEASURED ON THIS MODULE BY
//     T006 ON ITS FIRST EMIT ATTEMPT. The `.hn-note` disclosure below originally
//     read "each story's comments link", and the REACT DOSSIER GATE refused the
//     emitted result, VERBATIM:
//       generated/S13.tsx eslint:react/no-unescaped-entities (T002 ruling 10):
//       `'` can be escaped with `&apos;`, `&lsquo;`, `&#39;`, `&rsquo;`.
//     No other lane objects - this is JSX text, so only the three JSX lanes could
//     see it and only react gates on it. THE NARROWING IS TO SPELL THE POSSESSIVE
//     WITHOUT THE APOSTROPHE ("the per-story comments link"), not to escape it:
//     an `&apos;` entity in the AUTHORED source would reach the svelte, vue and
//     angular templates as six literal characters. Sixteen fixtures preceded this
//     one without ever putting an apostrophe in template text, so nothing had
//     reached it before. NO EMITTER AND NO GATE WAS TOUCHED.
//
// WHAT IS DELIBERATELY NOT HERE, CORRECTED BY frameless-app-fidelity-v1 T002.
// `.tsrx` has no routing construct - TRUE, verified at packages/compiler/src/
// schema.ts - BUT THE INFERENCE THAT USED TO STAND HERE ("so every link is
// inert") WAS FALSE. Every stub below already carries `event.preventDefault()`
// plus `onTrace('nav', ...)`, so the DESTINATION IS ALREADY NAMED, LOWERED AND
// TYPED; what was missing was the SINK, and the sink is host code. T006 wired it:
// `nav`/`to: 'home'` reaches the front page and the per-story `comments` trace
// reaches the item page in the four lanes that emit S14.
//
// WHAT STILL HAS NOWHERE TO GO IS SEVENTEEN OF THE THIRTY-ONE STUBS, and they are
// LABELLED ON THE PAGE rather than pointed somewhere false - `.hn-note` in the
// footer, copying `.tb-note` from s16-task-board.tsrx, which is this corpus's
// disclosure precedent. `new`, `past`, `comments` (the MASTHEAD one, which is
// /newcomments and not a story's comments), `ask`, `show`, `jobs`, `submit`,
// `login`, `More` and the eight footer links are EACH A SEPARATE APPLICATION;
// no routing construct in any authoring surface would reach them. MEASURED on a
// rendered capture of news.ycombinator.com: the reference has a real destination
// for all seventeen, and zero `href="#"` anywhere on its front page.
// And the footer search FILTERS IN PLACE instead of handing the query to Algolia,
// for the same reason it always did.
export function HnFront({ onTrace }: {
	onTrace: (name: string, detail: Record<string, unknown>, event: unknown) => void;
}) @{
	let stories = state([
		{
			id: 'h1',
			rank: '1.',
			title: 'Emit six framework lanes from one authored source',
			url: 'https://github.com/markless-dev/frameless',
			domain: '(github.com)',
			points: 412,
			pointsLabel: 'points',
			meta: 'by pg 3 hours ago',
			discuss: '128 comments',
			voted: false,
		},
		{
			id: 'h2',
			rank: '2.',
			title: 'A single NUL byte made grep blind to a 4306-line file',
			url: 'https://frameless.dev/notes/nul-byte',
			domain: '(frameless.dev)',
			points: 287,
			pointsLabel: 'points',
			meta: 'by tptacek 5 hours ago',
			discuss: '96 comments',
			voted: false,
		},
		{
			id: 'h3',
			rank: '3.',
			title: 'Show HN: A compiler that refuses instead of guessing',
			url: 'https://frameless.dev/show',
			domain: '(frameless.dev)',
			points: 233,
			pointsLabel: 'points',
			meta: 'by dang 6 hours ago',
			discuss: '74 comments',
			voted: false,
		},
		{
			id: 'h4',
			rank: '4.',
			title: 'The three-way contract: comparing six activations byte for byte',
			url: 'https://example.org/three-way-contract',
			domain: '(example.org)',
			points: 198,
			pointsLabel: 'points',
			meta: 'by jl 7 hours ago',
			discuss: '51 comments',
			voted: false,
		},
		{
			id: 'h5',
			rank: '5.',
			title: 'Ask HN: What does your measurement discipline actually look like?',
			url: 'https://example.org/ask-measurement',
			domain: '',
			points: 156,
			pointsLabel: 'points',
			meta: 'by patio11 8 hours ago',
			discuss: '210 comments',
			voted: false,
		},
		{
			id: 'h6',
			rank: '6.',
			title: 'Why two-word DOM events are unspellable in every framework lane',
			url: 'https://blog.example.com/two-word-events',
			domain: '(blog.example.com)',
			points: 141,
			pointsLabel: 'points',
			meta: 'by sama 9 hours ago',
			discuss: '63 comments',
			voted: false,
		},
		{
			id: 'h7',
			rank: '7.',
			title: 'Angular has no clock: the global-identifier ban, measured',
			url: 'https://angular.dev/guide/templates',
			domain: '(angular.dev)',
			points: 119,
			pointsLabel: 'points',
			meta: 'by minimaxir 10 hours ago',
			discuss: '38 comments',
			voted: false,
		},
		{
			id: 'h8',
			rank: '8.',
			title: 'GLOBALS_ALLOWED omits Promise, and five static gates pass anyway',
			url: 'https://vuejs.org/guide/essentials/template-syntax',
			domain: '(vuejs.org)',
			points: 97,
			pointsLabel: 'points',
			meta: 'by evanyou 11 hours ago',
			discuss: '45 comments',
			voted: false,
		},
		{
			id: 'h9',
			rank: '9.',
			title: 'Qwik City canonicalises every route to a trailing slash',
			url: 'https://qwik.dev/docs/routing',
			domain: '(qwik.dev)',
			points: 78,
			pointsLabel: 'points',
			meta: 'by mhevery 12 hours ago',
			discuss: '22 comments',
			voted: false,
		},
		{
			id: 'h10',
			rank: '10.',
			title: 'Ask HN: Who is hiring? (July 2026)',
			url: 'https://example.org/who-is-hiring',
			domain: '',
			points: 64,
			pointsLabel: 'points',
			meta: 'by whoishiring 13 hours ago',
			discuss: '302 comments',
			voted: false,
		},
		{
			id: 'h11',
			rank: '11.',
			title: "Solid's keyed-identity rule, and the array state it refuses",
			url: 'https://solidjs.com/docs/latest',
			domain: '(solidjs.com)',
			points: 41,
			pointsLabel: 'points',
			meta: 'by ryansolid 14 hours ago',
			discuss: '17 comments',
			voted: false,
		},
		{
			id: 'h12',
			rank: '12.',
			title: 'A derived census is worth more than a renumbered one',
			url: 'https://frameless.dev/notes/census',
			domain: '(frameless.dev)',
			points: 1,
			pointsLabel: 'point',
			meta: 'by frameless 15 hours ago',
			discuss: 'discuss',
			voted: false,
		},
	]);
	let query = state('');

	<section class="hn" data-app="hn-front">
		<div class="hn-page">
			<header class="hn-head" data-hn="masthead">
				<a
					class="hn-logo"
					href="#/"
					data-hn="logo"
					onClick={(event) => {
						event.preventDefault();
						onTrace('nav', { to: 'home' }, event);
					}}
				><span class="hn-y">Y</span></a>
				<a
					class="hn-brand"
					href="#/"
					data-hn="brand"
					onClick={(event) => {
						event.preventDefault();
						onTrace('nav', { to: 'home' }, event);
					}}
				>Hacker News</a>
				<span class="hn-nav" data-hn="nav">
					<a
						class="hn-navlink"
						href="#/newest"
						data-nav="new"
						onClick={(event) => {
							event.preventDefault();
							onTrace('nav', { to: 'new' }, event);
						}}
					>new</a>
					<span class="hn-bar">|</span>
					<a
						class="hn-navlink"
						href="#/front"
						data-nav="past"
						onClick={(event) => {
							event.preventDefault();
							onTrace('nav', { to: 'past' }, event);
						}}
					>past</a>
					<span class="hn-bar">|</span>
					<a
						class="hn-navlink"
						href="#/newcomments"
						data-nav="comments"
						onClick={(event) => {
							event.preventDefault();
							onTrace('nav', { to: 'comments' }, event);
						}}
					>comments</a>
					<span class="hn-bar">|</span>
					<a
						class="hn-navlink"
						href="#/ask"
						data-nav="ask"
						onClick={(event) => {
							event.preventDefault();
							onTrace('nav', { to: 'ask' }, event);
						}}
					>ask</a>
					<span class="hn-bar">|</span>
					<a
						class="hn-navlink"
						href="#/show"
						data-nav="show"
						onClick={(event) => {
							event.preventDefault();
							onTrace('nav', { to: 'show' }, event);
						}}
					>show</a>
					<span class="hn-bar">|</span>
					<a
						class="hn-navlink"
						href="#/jobs"
						data-nav="jobs"
						onClick={(event) => {
							event.preventDefault();
							onTrace('nav', { to: 'jobs' }, event);
						}}
					>jobs</a>
					<span class="hn-bar">|</span>
					<a
						class="hn-navlink"
						href="#/submit"
						data-nav="submit"
						onClick={(event) => {
							event.preventDefault();
							onTrace('nav', { to: 'submit' }, event);
						}}
					>submit</a>
				</span>
				<a
					class="hn-login"
					href="#/login"
					data-hn="login"
					onClick={(event) => {
						event.preventDefault();
						onTrace('nav', { to: 'login' }, event);
					}}
				>login</a>
			</header>
			<main class="hn-body" data-hn="body">
				<ul class="hn-list" data-hn="list">
					@for (const story of stories; key story.id) {
						<li
							class="hn-story"
							data-story={story.id}
							hidden={!story.title.toLowerCase().includes(query.toLowerCase())}
						>
							<span class="hn-rank" data-rank={story.id}>{story.rank}</span>
							<span class="hn-votebox">
								<button
									type="button"
									class="hn-vote"
									aria-label="upvote"
									data-vote={story.id}
									hidden={story.voted}
									onClick={(event) => {
										const next = story.points + 1;
										stories = stories.map((entry) =>
											entry.id === story.id
												? {
														id: entry.id,
														rank: entry.rank,
														title: entry.title,
														url: entry.url,
														domain: entry.domain,
														points: next,
														pointsLabel: next === 1 ? 'point' : 'points',
														meta: entry.meta,
														discuss: entry.discuss,
														voted: true,
													}
												: entry,
										);
										onTrace('vote', { id: story.id, points: next }, event);
									}}
								></button>
							</span>
							<span class="hn-item">
								<span class="hn-titleline">
									<a
										class="hn-storylink"
										href={story.url}
										data-title={story.id}
										onClick={(event) => {
											event.preventDefault();
											onTrace('open', { id: story.id }, event);
										}}
									>{story.title}</a>
									<span class="hn-domain" data-domain={story.id}>{story.domain}</span>
								</span>
								<span class="hn-subtext" data-subtext={story.id}>
									<span class="hn-score" data-points={story.id}>{story.points}</span>
									<span class="hn-scorelabel">{story.pointsLabel}</span>
									<span class="hn-meta">{story.meta}</span>
									<span class="hn-bar" hidden={!story.voted}>|</span>
									<button
										type="button"
										class="hn-act"
										data-unvote={story.id}
										hidden={!story.voted}
										onClick={(event) => {
											const next = story.points - 1;
											stories = stories.map((entry) =>
												entry.id === story.id
													? {
															id: entry.id,
															rank: entry.rank,
															title: entry.title,
															url: entry.url,
															domain: entry.domain,
															points: next,
															pointsLabel: next === 1 ? 'point' : 'points',
															meta: entry.meta,
															discuss: entry.discuss,
															voted: false,
														}
													: entry,
											);
											onTrace('unvote', { id: story.id, points: next }, event);
										}}
									>unvote</button>
									<span class="hn-bar">|</span>
									<button
										type="button"
										class="hn-act"
										data-hide={story.id}
										onClick={(event) => {
											stories = stories.filter((entry) => entry.id !== story.id);
											onTrace('hide', { id: story.id }, event);
										}}
									>hide</button>
									<span class="hn-bar">|</span>
									<a
										class="hn-act"
										href="#/item"
										data-comments={story.id}
										onClick={(event) => {
											event.preventDefault();
											onTrace('comments', { id: story.id }, event);
										}}
									>{story.discuss}</a>
								</span>
							</span>
						</li>
					}
				</ul>
				@if (stories.length > 0) {
					<a
						class="hn-more"
						href="#/more"
						data-action="more"
						onClick={(event) => {
							event.preventDefault();
							onTrace('more', { shown: stories.length }, event);
						}}
					>More</a>
				} @else {
				}
			</main>
			<footer class="hn-foot" data-hn="footer">
				<p class="hn-note" data-hn="stubnote">
					<span class="hn-notemark">!</span>
					<span class="hn-notetext">SEVENTEEN OF THE THIRTY-ONE STUB LINKS ON THIS PAGE HAVE NO DESTINATION AND CANNOT ACQUIRE ONE, and that absence is labelled here rather than faked. new, past, comments, ask, show, jobs, submit, login, More and the eight footer links are EACH A SEPARATE APPLICATION the reference has and this corpus does not, so pointing them anywhere would be a lie about what was built. WHAT DOES NAVIGATE: the per-story comments link reaches the item page in the FOUR lanes that emit it — svelte and vue refuse a same-module component reference outright, so those two lanes have no item page to reach. The logo and the Hacker News wordmark point at this front page, which is the page you are already on: five lanes re-enter it, and the Angular router declines a same-URL navigation, so nothing moves there and nothing is faked. THE TWELVE STORY TITLES ARE REAL URLS and the status bar and a middle click both behave; a left click is held on this page by a deliberate preventDefault, because a demo that left for github.com on the first click would be unobservable in every lane at once.</span>
				</p>
				<span class="hn-footlinks">
					<a
						class="hn-navlink"
						href="#/guidelines"
						data-foot="guidelines"
						onClick={(event) => {
							event.preventDefault();
							onTrace('nav', { to: 'guidelines' }, event);
						}}
					>Guidelines</a>
					<span class="hn-bar">|</span>
					<a
						class="hn-navlink"
						href="#/faq"
						data-foot="faq"
						onClick={(event) => {
							event.preventDefault();
							onTrace('nav', { to: 'faq' }, event);
						}}
					>FAQ</a>
					<span class="hn-bar">|</span>
					<a
						class="hn-navlink"
						href="#/lists"
						data-foot="lists"
						onClick={(event) => {
							event.preventDefault();
							onTrace('nav', { to: 'lists' }, event);
						}}
					>Lists</a>
					<span class="hn-bar">|</span>
					<a
						class="hn-navlink"
						href="#/api"
						data-foot="api"
						onClick={(event) => {
							event.preventDefault();
							onTrace('nav', { to: 'api' }, event);
						}}
					>API</a>
					<span class="hn-bar">|</span>
					<a
						class="hn-navlink"
						href="#/security"
						data-foot="security"
						onClick={(event) => {
							event.preventDefault();
							onTrace('nav', { to: 'security' }, event);
						}}
					>Security</a>
					<span class="hn-bar">|</span>
					<a
						class="hn-navlink"
						href="#/legal"
						data-foot="legal"
						onClick={(event) => {
							event.preventDefault();
							onTrace('nav', { to: 'legal' }, event);
						}}
					>Legal</a>
					<span class="hn-bar">|</span>
					<a
						class="hn-navlink"
						href="#/apply"
						data-foot="apply"
						onClick={(event) => {
							event.preventDefault();
							onTrace('nav', { to: 'apply' }, event);
						}}
					>Apply to YC</a>
					<span class="hn-bar">|</span>
					<a
						class="hn-navlink"
						href="#/contact"
						data-foot="contact"
						onClick={(event) => {
							event.preventDefault();
							onTrace('nav', { to: 'contact' }, event);
						}}
					>Contact</a>
				</span>
				<form
					class="hn-search"
					data-action="search"
					onClick={(event) => onTrace('press', { area: 'search' }, event)}
					onSubmit={(event) => {
						event.preventDefault();
						onTrace('search', { query }, event);
					}}
				>
					<label class="hn-searchlabel" for="hn-search-input">Search:</label>
					<input
						id="hn-search-input"
						class="hn-searchinput"
						type="text"
						data-action="search-term"
						value={query}
						onInput={(event) => query = event.currentTarget.value}
					/>
				</form>
			</footer>
		</div>
	</section>
}
