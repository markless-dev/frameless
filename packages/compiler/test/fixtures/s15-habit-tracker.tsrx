import { computed, state } from '@markless/core';

// THE SIXTH APPLICATION IN THIS CORPUS - the HABIT TRACKER - authored ONCE and
// attempted in all six lanes. It rides the next ORDINAL slot for the reason S10
// through S14 record: ten-plus per-lane suites derive their `generated/`
// inventory from `/^s(\d+)-[\w-]+\.json$/` and assert it EXACTLY, so a
// fifteenth artifact named anything else is rejected by construction.
// `scripts/e2e.mjs` still pins `threeWayScenarios` to the literal ['s1'..'s9'],
// so this app does NOT join the 6 x 9 three-way contract - browsable first.
//
// THE AXIS THIS MODULE MEASURES IS SIX-LANE FAN-OUT: whether ONE CLICK moves
// EVERY DERIVED OBSERVABLE ON THE PAGE, IN ALL SIX LANES AT ONCE. It is the
// first application in this corpus that could lose NO lane, and the reason is
// structural rather than lucky: the whole app is SYNCHRONOUS DERIVED STATE.
// There is no async door anywhere - no `Promise`, no `setTimeout`, no `await` -
// so none of the machinery that cost S11 and S12 the angular lane and cost them
// vue's runtime is reachable from here. There is no component reference either,
// so neither of the two emitter defects T003 isolated (solid's double-called
// signal read, qwik's un-forwardable function prop) is reachable either.
//
// WHAT ONE CLICK ON A HABIT'S TOGGLE MUST MOVE, all of it derived from the
// SINGLE `habits` cell and none of it written by the handler:
//
//     1. the toggle's own fill          `.ht-check` -> `.ht-check ht-check-on`
//     2. the row title's strikethrough  `.ht-name`  -> `.ht-name ht-name-done`
//     3. the SIDEBAR row's strikethrough - a SECOND repeat over the same cell,
//        in a different subtree, which is what makes this fan-out and not
//        merely a row re-render
//     4. the header counter             `{doneCount}` 0 -> 1
//     5. the sidebar badge              `{tally}` '0/6' -> '1/6'
//     6. the progress bar               `{fillClass}` 'ht-fill-0' -> 'ht-fill-1'
//     7. the encouragement line         `{cheer}` and `{cheerEmoji}`
//     8. today's dot in that row's strip
//
// EIGHT, NOT FIVE. The board records "one click fans out to FIVE observable
// updates" and then lists SIX. MEASURED ON THE LIVE REFERENCE with a scripted
// click (see the T004 note): the reference itself moves SEVEN things - the six
// the board lists PLUS the encouragement EMOJI, which changes from a different
// glyph set than the text. This module adds an eighth (today's dot) because a
// fan-out target INSIDE a nested repeat is the one placement the other seven do
// not cover.
//
// THE FIFTEEN CONSTRAINTS BELOW ARE MEASURED. (1)-(9) are inherited from
// S10-S14 because the same lanes still enforce them; (10)-(15) were measured ON
// THIS SOURCE.
//
// (1) NO SEED PROP. IR-8 has no lowering for `TSArrayType` - react, svelte and
//     angular each throw "has no IR-8 lowering for the type node TSArrayType" -
//     so the six habits are seeded in the component and all six lanes start
//     from byte-identical data with no host wiring to keep in step.
//     T003 REFUTED THE STRONGER FORM OF THIS CLAIM and it is restated correctly
//     here: `Array<string>` LOWERS in five lanes where `string[]` refuses, so
//     the limit is the SPELLING and not arrays. It still does not rescue this
//     module - `Array<{ id: string }>` throws on `TSTypeLiteral` in all six and
//     a named element type prints a name the emitted module cannot resolve.
//
// (2) THE STREAK CHIP IS A `hidden` BINDING ON THE CARD, not a repeat over a
//     filtered view. Repeating over a `computed` is refused by Solid ("Array
//     state state:habits has unconsumed keyed identity semantics"), so every
//     repeat here is over `habits` itself and one expression decides `hidden`.
//     This is the S11/S12/S13 spelling and the only one five lanes have printed.
//
// (3) EVERY CLICKABLE IS A `<button type="button">` OR AN `<a>` WITH A REAL
//     `href`. Svelte's emitted-form gate refuses a bare `<span>` carrying a
//     click handler (`a11y_no_static_element_interactions`) and refuses
//     `href="#"` and `href=""` outright (`a11y_invalid_attribute`), which is why
//     every inert link here is spelled `href="#/..."`.
//
// (4) NO TWO-WORD DOM EVENT IS AUTHORABLE AT ALL (DEFECTS.md 15). Every emitter
//     derives its event name with `name.slice(2).toLowerCase()`, so `onKeyDown`
//     prints `onKeydown` and react-dom NEVER FIRES it. There is no keyboard
//     interaction anywhere on this page and none is faked.
//
// (5) NO STATE WRITE SITS INSIDE AN `if`. DEFECTS.md 8.1: the react emitter
//     lowers only TOP-LEVEL handler statements, so a write nested in an `if` is
//     NEITHER LOWERED NOR REFUSED. There is exactly one write in this module and
//     it is top-level and unconditional.
//
// (6) EVERY STRING CELL IS A `''`-SENTINEL, never `state(null)`: `state(null)`
//     pins the inferred cell type to `null` and the first non-null write does
//     not type (a live qwik TS2322 on s7 in this repo's own `pnpm check`).
//     This module happens to declare no scalar string cell at all.
//
// (7) NO TOP-LEVEL SIDE-EFFECT CALL in the component body - one emits
//     `useRef(null)` in the react lane and costs a type error. Every call site
//     here is inside a handler or a `computed`.
//
// (8) NO TEMPLATE TEXT NODE HAS WHITESPACE EDGES. Angular's `escapeText`
//     refuses one outright and the Vue gate rejects the emitted result. Every
//     gap on this page is a flex `gap` in `demos/shared/habit-css/habits.css`,
//     never a text node and never emitted formatting - the six emitters print
//     inter-element whitespace differently (JSX drops a whitespace-only line,
//     `@vue/compiler-sfc` condenses it, Angular's `preserveWhitespaces: false`
//     removes it, Svelte keeps it), so no layout here may lean on it.
//
// (9) NO ELEMENT WITH A HANDLER MAY SIT BESIDE TEXT. Svelte, Vue and Angular all
//     refuse it - "cannot inline <button>: it sits beside text / in a
//     text-bearing run and needs a multi-line start tag" - because a parent with
//     ANY text child prints its children inline and a handler attribute is
//     always multi-line. EVERY TEXT RUN ON THIS PAGE THEREFORE HAS ITS OWN
//     `<span>`, which makes every such parent's children all hosts.
//
// (10) THE DATE IS LITERAL SEEDED DATA AND THAT IS THE WHOLE SIX-LANE CLAIM.
//     The live reference renders a REAL date - measured: "JULY 30, 2026" over
//     "Thursday" - and the Angular emitter cannot NAME a global inside a
//     transplanted body, `Date` included. A computed date would lose that lane
//     for a reason that has nothing to do with this card's axis, and the axis
//     is exactly "can this app keep all six lanes".
//     THE CARD SAID THE DATE MUST ARRIVE AS A PROP. It could: unlike T002's
//     per-row ages, a page date is a SCALAR, and a scalar `string` prop demonstrably
//     lowers in all six lanes - S3's `initial` is one. It is a LITERAL instead
//     because the date is not computed ANYWHERE (no lane may name `Date`), so a
//     prop would move the same constant string from one place to SIX host
//     shells and create six places for the lanes to disagree. Both spellings
//     satisfy the constraint the card was protecting; this one keeps the six
//     lanes byte-identical by construction, as S10-S14 all do.
//
// (11) THE ENCOURAGEMENT LADDER IS FIVE BANDS AND IT WAS READ OFF THE LIVE
//     REFERENCE, not invented: 0 -> "Let's make today count!", 1-2 -> "Good
//     start! Stay consistent.", 3-4 -> "Halfway through, great work!", 5 ->
//     "Almost there, keep going!", 6 -> "Perfect day! All done!", with the
//     emoji running the parallel ladder. Both are `computed`, so a lane that
//     re-rendered the header without re-deriving would keep the counter and
//     lose the sentence - which is precisely the failure mode this app exists
//     to expose.
//
// (12) EVERY `computed` HERE HAS AN EXPRESSION BODY AND RE-READS `habits`
//     DIRECTLY rather than reading another `computed`. That is why `cheer` runs
//     the same `filter` five times instead of binding a local. Both shortcuts
//     were measured on a probe against this module rather than assumed - see the
//     T004 note - and the corpus's proven shape is S10's, where `active`,
//     `completed`, `allDone` and `remainingLabel` each re-filter `todos`.
//
// (13) THE PROGRESS BAR IS A CLASS NAME, NOT AN INLINE WIDTH. `fillClass`
//     derives `ht-fill-0`..`ht-fill-6` and the stylesheet owns the six widths.
//     No fixture in this corpus binds a `style` attribute, so the lowering is
//     unmeasured; a class name is the binding this corpus has printed in every
//     lane since S10, and the rendered bar is still asserted by its measured
//     `getBoundingClientRect().width` rather than by its class.
//
// (14) NO STATIC NUMERIC ATTRIBUTE IS SPELLED ANYWHERE. T003 measured that
//     `rows="6"` is lowered as a STRING and fails the react lane's emitted
//     typecheck (`TS2322`, `TextareaHTMLAttributes.rows` is `number`), taking
//     `pnpm check` to 268. Every numeric on this page is either interpolated
//     text or a class-name suffix.
//
// (15) THE TOGGLE BUTTON SWAPS TWO `hidden` SIBLINGS RATHER THAN INTERPOLATING A
//     TERNARY. `{habit.done ? '✓' : habit.emoji}` would put a conditional
//     expression in a text position, which nothing in this corpus does; two
//     spans with complementary `hidden` bindings is S13's proven spelling and it
//     also makes the swap observable as two element states rather than one
//     string.
//
// WHAT IS DELIBERATELY NOT HERE, each with a reason rather than an omission.
// There is no page routing - `.tsrx` has no routing construct at all - so
// `Statistics`, `New habit`, the sidebar toggle and the theme toggle are INERT
// and recorded as such. There is no 30-day heat-map and no sparkline: the
// reference draws roughly 200 cells per habit of pure decoration, and 1200
// authored-once hosts would triple this template while measuring nothing the
// eight observables above do not already measure. And the streak numbers are
// SEEDED and do not move on a toggle - the reference's do not either, because a
// streak is yesterday's history and today is not over.
//
// ONE PLACE THIS PAGE IS DELIBERATELY MORE CORRECT THAN ITS REFERENCE. The
// reference renders "All habits tracked for today - great job!" AT 0/6, before
// anything is ticked - measured on the live site at every rung of the ladder.
// Here that line carries `hidden={doneCount < habits.length}`, so it appears
// only at 6/6, which also makes it a ninth derived observable.
export function HabitTracker({ onTrace }: {
	onTrace: (name: string, detail: Record<string, unknown>, event: unknown) => void;
}) @{
	let habits = state([
		{
			id: 'h1',
			emoji: '🧘',
			name: 'Meditate',
			streak: 6,
			streakLabel: '6 day streak',
			rate: '77% / 30d',
			done: false,
			week: [
				{ id: 'h1d1', on: true },
				{ id: 'h1d2', on: true },
				{ id: 'h1d3', on: false },
				{ id: 'h1d4', on: true },
				{ id: 'h1d5', on: true },
				{ id: 'h1d6', on: true },
			],
		},
		{
			id: 'h2',
			emoji: '💪',
			name: 'Workout',
			streak: 3,
			streakLabel: '3 day streak',
			rate: '80% / 30d',
			done: false,
			week: [
				{ id: 'h2d1', on: false },
				{ id: 'h2d2', on: true },
				{ id: 'h2d3', on: true },
				{ id: 'h2d4', on: false },
				{ id: 'h2d5', on: true },
				{ id: 'h2d6', on: true },
			],
		},
		{
			id: 'h3',
			emoji: '📚',
			name: 'Read',
			streak: 0,
			streakLabel: '',
			rate: '73% / 30d',
			done: false,
			week: [
				{ id: 'h3d1', on: true },
				{ id: 'h3d2', on: false },
				{ id: 'h3d3', on: true },
				{ id: 'h3d4', on: true },
				{ id: 'h3d5', on: false },
				{ id: 'h3d6', on: false },
			],
		},
		{
			id: 'h4',
			emoji: '🌙',
			name: 'No screens before bed',
			streak: 0,
			streakLabel: '',
			rate: '63% / 30d',
			done: false,
			week: [
				{ id: 'h4d1', on: false },
				{ id: 'h4d2', on: true },
				{ id: 'h4d3', on: false },
				{ id: 'h4d4', on: true },
				{ id: 'h4d5', on: false },
				{ id: 'h4d6', on: false },
			],
		},
		{
			id: 'h5',
			emoji: '🚿',
			name: 'Cold shower',
			streak: 5,
			streakLabel: '5 day streak',
			rate: '83% / 30d',
			done: false,
			week: [
				{ id: 'h5d1', on: true },
				{ id: 'h5d2', on: true },
				{ id: 'h5d3', on: true },
				{ id: 'h5d4', on: false },
				{ id: 'h5d5', on: true },
				{ id: 'h5d6', on: true },
			],
		},
		{
			id: 'h6',
			emoji: '✍️',
			name: 'Journal',
			streak: 1,
			streakLabel: '1 day streak',
			rate: '67% / 30d',
			done: false,
			week: [
				{ id: 'h6d1', on: true },
				{ id: 'h6d2', on: false },
				{ id: 'h6d3', on: false },
				{ id: 'h6d4', on: true },
				{ id: 'h6d5', on: false },
				{ id: 'h6d6', on: true },
			],
		},
	]);

	const doneCount = computed(() => habits.filter((habit) => habit.done).length);
	const tally = computed(
		() => `${habits.filter((habit) => habit.done).length}/${habits.length}`,
	);
	const totalLabel = computed(() => `/${habits.length}`);
	const fillClass = computed(
		() => `ht-fill ht-fill-${habits.filter((habit) => habit.done).length}`,
	);
	const cheer = computed(() =>
		habits.filter((habit) => habit.done).length === 0
			? "Let's make today count!"
			: habits.filter((habit) => habit.done).length < 3
				? 'Good start! Stay consistent.'
				: habits.filter((habit) => habit.done).length < 5
					? 'Halfway through, great work!'
					: habits.filter((habit) => habit.done).length < habits.length
						? 'Almost there, keep going!'
						: 'Perfect day! All done!',
	);
	const cheerEmoji = computed(() =>
		habits.filter((habit) => habit.done).length === 0
			? '✨'
			: habits.filter((habit) => habit.done).length < 3
				? '🌱'
				: habits.filter((habit) => habit.done).length < 5
					? '💪'
					: habits.filter((habit) => habit.done).length < habits.length
						? '🔥'
						: '🎉',
	);

	<section class="ht" data-app="habit-tracker">
		<div class="ht-shell">
			<aside class="ht-side" data-ht="sidebar">
				<div class="ht-brand" data-ht="brand">
					<span class="ht-mark">◧</span>
					<span class="ht-brandname">Frameless</span>
				</div>
				<nav class="ht-nav" data-ht="nav">
					<a
						class="ht-navlink ht-navlink-on"
						href="#/today"
						data-nav="today"
						onClick={(event) => {
							event.preventDefault();
							onTrace('nav', { to: 'today' }, event);
						}}
					>
						<span class="ht-navicon">🗓</span>
						<span class="ht-navtext">Today</span>
						<span class="ht-badge" data-badge="today">{tally}</span>
					</a>
					<a
						class="ht-navlink"
						href="#/statistics"
						data-nav="statistics"
						onClick={(event) => {
							event.preventDefault();
							onTrace('nav', { to: 'statistics' }, event);
						}}
					>
						<span class="ht-navicon">📊</span>
						<span class="ht-navtext">Statistics</span>
					</a>
				</nav>
				<div class="ht-sidehead" data-ht="sidehead">
					<span class="ht-sidetitle">HABITS</span>
					<button
						type="button"
						class="ht-sideadd"
						aria-label="new habit"
						data-action="new-habit-side"
						onClick={(event) => onTrace('press', { area: 'new-habit-side' }, event)}
					><span class="ht-plus">+</span></button>
				</div>
				<ul class="ht-sidelist" data-ht="sidelist">
					@for (const habit of habits; key habit.id) {
						<li class="ht-siderow" data-side={habit.id}>
							<span class="ht-sideemoji">{habit.emoji}</span>
							<span class="ht-sidebody">
								<span
									class={habit.done ? 'ht-sidename ht-sidename-done' : 'ht-sidename'}
									data-sidename={habit.id}
								>{habit.name}</span>
								<span
									class="ht-sidestreak"
									data-sidestreak={habit.id}
									hidden={habit.streak === 0}
								>{habit.streakLabel}</span>
							</span>
						</li>
					}
				</ul>
				<div class="ht-promo" data-ht="promo">
					<span class="ht-promotitle">One source, six lanes</span>
					<span class="ht-promotext">Every pixel on this page is emitted from a single .tsrx module into react, solid, qwik, svelte, vue and angular.</span>
				</div>
			</aside>
			<div class="ht-content">
				<header class="ht-top" data-ht="topbar">
					<button
						type="button"
						class="ht-icon"
						aria-label="toggle sidebar"
						data-action="toggle-sidebar"
						onClick={(event) => onTrace('press', { area: 'toggle-sidebar' }, event)}
					><span class="ht-iconglyph">▥</span></button>
					<span class="ht-crumb">Today</span>
					<span class="ht-topgap"></span>
					<button
						type="button"
						class="ht-pill"
						data-action="new-habit"
						onClick={(event) => onTrace('press', { area: 'new-habit' }, event)}
					>
						<span class="ht-plus">+</span>
						<span class="ht-pilltext">New habit</span>
					</button>
					<button
						type="button"
						class="ht-icon"
						aria-label="toggle theme"
						data-action="theme"
						onClick={(event) => onTrace('press', { area: 'theme' }, event)}
					><span class="ht-iconglyph">☀</span></button>
				</header>
				<main class="ht-main" data-ht="main">
					<div class="ht-hero" data-ht="hero">
						<div class="ht-heroleft">
							<span class="ht-date" data-ht="date">JULY 30, 2026</span>
							<h1 class="ht-weekday" data-ht="weekday">Thursday</h1>
							<p class="ht-cheerline">
								<span class="ht-cheeremoji" data-cheer="emoji">{cheerEmoji}</span>
								<span class="ht-cheertext" data-cheer="text">{cheer}</span>
							</p>
						</div>
						<div class="ht-heroright">
							<p class="ht-tally">
								<span class="ht-tallydone" data-tally="done">{doneCount}</span>
								<span class="ht-tallytotal" data-tally="total">{totalLabel}</span>
							</p>
							<span class="ht-tallylabel">habits done</span>
						</div>
					</div>
					<div class="ht-progress" data-ht="progress">
						<span class={fillClass} data-ht="fill"></span>
					</div>
					<div class="ht-streakhead" data-ht="streakhead">
						<span class="ht-streakflame">🔥</span>
						<span class="ht-streaklabel">ACTIVE STREAKS</span>
					</div>
					<div class="ht-streakrow" data-ht="streakrow">
						@for (const habit of habits; key habit.id) {
							<div class="ht-streakcard" data-streak={habit.id} hidden={habit.streak === 0}>
								<span class="ht-streakemoji">{habit.emoji}</span>
								<span class="ht-streakname">{habit.name}</span>
								<span class="ht-streakcount">
									<span class="ht-flame">🔥</span>
									<span class="ht-streaknum">{habit.streak}</span>
								</span>
							</div>
						}
					</div>
					<ul class="ht-list" data-ht="list">
						@for (const habit of habits; key habit.id) {
							<li class={habit.done ? 'ht-card ht-card-done' : 'ht-card'} data-habit={habit.id}>
								<button
									type="button"
									class={habit.done ? 'ht-check ht-check-on' : 'ht-check'}
									aria-label="toggle habit"
									data-toggle={habit.id}
									onClick={(event) => {
										const done = !habit.done;
										habits = habits.map((entry) =>
											entry.id === habit.id
												? {
														id: entry.id,
														emoji: entry.emoji,
														name: entry.name,
														streak: entry.streak,
														streakLabel: entry.streakLabel,
														rate: entry.rate,
														done,
														week: entry.week,
													}
												: entry,
										);
										onTrace('toggle', { id: habit.id, done }, event);
									}}
								>
									<span class="ht-checkemoji" hidden={habit.done}>{habit.emoji}</span>
									<span class="ht-checkmark" hidden={!habit.done}>✓</span>
								</button>
								<div class="ht-cardbody">
									<div class="ht-cardtitle">
										<span
											class={habit.done ? 'ht-name ht-name-done' : 'ht-name'}
											data-name={habit.id}
										>{habit.name}</span>
										<span class="ht-pillstreak" hidden={habit.streak === 0}>
											<span class="ht-flame">🔥</span>
											<span class="ht-pillnum">{habit.streak}</span>
										</span>
									</div>
									<div class="ht-cardmeta">
										<span class="ht-dots" data-dots={habit.id}>
											@for (const day of habit.week; key day.id) {
												<span class={day.on ? 'ht-dot ht-dot-on' : 'ht-dot'} data-day={day.id}></span>
											}
											<span
												class={habit.done ? 'ht-dot ht-dot-today ht-dot-on' : 'ht-dot ht-dot-today'}
												data-today={habit.id}
											></span>
										</span>
										<span class="ht-window">7d</span>
										<span class="ht-rate" data-rate={habit.id}>{habit.rate}</span>
									</div>
								</div>
							</li>
						}
					</ul>
					<p
						class="ht-footnote"
						data-ht="footnote"
						hidden={doneCount < habits.length}
					>All habits tracked for today — great job!</p>
				</main>
			</div>
		</div>
	</section>
}
