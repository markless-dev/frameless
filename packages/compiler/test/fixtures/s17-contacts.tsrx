import { computed, state } from '@markless/core';

// THE EIGHTH APPLICATION IN THIS CORPUS - CONTACTS - authored ONCE and attempted
// in all six lanes. It rides the next ORDINAL slot for the reason S10 through
// S16 record: ten-plus per-lane suites derive their `generated/` inventory from
// /^s(\d+)-[\w-]+\.json$/ and assert it EXACTLY, so a seventeenth artifact named
// anything else is rejected by construction. `scripts/e2e.mjs` still pins
// `threeWayScenarios` to the literal ['s1'..'s9'], so this app does NOT join the
// 6 x 9 three-way contract - browsable first.
//
// ==========================================================================
// THE AXIS THIS CARD MEASURES IS FORM INPUT TYPES, AND UNLIKE S16 THE AXIS IS
// ON THE PAGE. THIRTEEN CONTROL KINDS SHIP HERE, EVERY ONE OF THEM BOUND AND
// EVERY ONE OF THEM OBSERVABLE.
// ==========================================================================
//
// THE BOARD SAID "ONLY `checkbox` AND `textarea` ARE PROVEN; `select`, `radio`,
// `number`, `date` AND THE MULTI-FIELD FORM SHAPE ARE ALL UNMEASURED IN ALL SIX
// LANES". THAT IS WRONG ABOUT THREE OF THE FIVE, AND THE REFUTATION IS ALREADY
// IN THIS DIRECTORY: `s7-form-controls.tsrx` IS a `<form>` carrying a `<select>`
// with three `<option>`s, a `<textarea>`, a RADIO GROUP of two and a keyed group
// of CHECKBOXES. S7 emits in ALL SIX LANES, is in every lane's `generated/`, and
// is one of the nine scenarios `pnpm e2e` drives IN A REAL BROWSER across six
// demos. So `select`, `radio` and the multi-field form shape were measured
// before this card existed; what was genuinely unmeasured was `number`, `date`,
// and - re-measured here on a probe through all six real emitters - `tel`,
// `url`, `search`, `range`, `time`, `email`, `password`, `color`, `month`,
// `week` and `hidden`, plus a `value` binding on a `<select>` (S7 binds
// `data-size`, never `value`) and `selected` on an `<option>`.
//
// THE PROBE RESULT, through all six REAL emitters: EVERY ONE OF THE SIXTEEN
// `type=` VALUES IS SPELLED AND EMITTED BY ALL SIX. There is no per-type
// refusal anywhere. `type` is a plain string attribute and no emitter looks at
// its value, which is why the axis has no refusal in it at all - and that
// absence is a result, not a gap. See the T006 note for the full matrix.
//
// WHAT DOES REFUSE IS NOT THE TYPE, IT IS THE ATTRIBUTE BESIDE IT, and it is
// the emitted TYPECHECK rather than any emitter. Constraint (14) below records
// the measured per-attribute cost. The headline: a contacts form wants
// `required`, `maxlength`, `size` and `multiple`, and every one of those costs
// `pnpm check` error lines it is not allowed to spend - while `min`, `max` and
// `step`, which the card ALSO predicted would fail, are FREE IN ALL THREE JSX
// LANES. That asymmetry is measured, not assumed, and it is what lets the
// number, date, time and range fields below carry real bounds.
//
// THE NAMED VISUAL REFERENCE - https://square-ui-contacts.vercel.app/ - WAS NOT
// QA'd BY THE PM AND IS QA'd HERE. Three findings, all measured live, all
// recorded in the T006 note and NONE of them copied:
//
//   * ITS "Notes" FIELD IS A SINGLE-LINE `<input>`, NOT A `<textarea>`. With the
//     New Contact dialog open the whole document holds SEVEN `<input>`s, TWO
//     `<select>`s and ZERO `<textarea>`s. A notes field that cannot wrap is a
//     defect; this page ships a real `<textarea>`.
//   * THE PAGE HAS NO HEADING ELEMENT AT ALL. `document.querySelectorAll(
//     'h1,h2,h3,h4')` returns ZERO on the whole document. This page has an
//     `<h1>` and section `<h2>`s. Same family as S16's heading-order finding.
//   * ITS PHONE FIELD IS NOT `type="tel"` and its first/last/role fields carry
//     no `type` at all - only the email field is typed. This page types every
//     field, which is the entire point of the card.
//
// WHAT ONE EDIT MOVES. The form is a LIVE PREVIEW, so every control has its own
// observable and no two share one - which is what makes this a per-type
// measurement rather than one form that either works or does not:
//
//     text (first/last)  -> the preview name        text (role) -> preview role
//     email  -> preview email row      tel   -> preview phone row
//     url    -> preview site row       select-> preview company AND industry
//     radio  -> preview status chip TEXT and CLASS
//     number -> preview deals line     date  -> preview "Since" line
//     time   -> preview "at" line      range -> preview priority WORD LADDER
//     checkbox (keyed repeat) -> the preview's tag chips
//     textarea -> the preview note, and its `hidden` closes again when emptied
//     search  -> every card's `hidden`, the shown counter and the summary pair
//     select (status filter) -> the same three, by a different route
//
// THE CONSTRAINTS BELOW ARE MEASURED. (1)-(13) are inherited from S10-S16
// because the same lanes still enforce them; (14)-(18) were measured ON THIS
// SOURCE.
//
// (1) NO SEED PROP. IR-8 has no lowering for `TSArrayType`, so the contacts,
//     companies and tag rows are seeded in the component and all six lanes start
//     from byte-identical data. `Array<string>` DOES lower in five lanes (T003),
//     so the limit is the SPELLING, but it does not rescue this module:
//     `Array<{ id: string }>` throws on `TSTypeLiteral` in all six.
//
// (2) EVERY REPEAT IS OVER A STATE CELL OR OVER A FIELD OF ITS LOOP VARIABLE,
//     never over a `computed`. Solid refuses the latter ("has unconsumed keyed
//     identity semantics"). THAT IS WHY THE FILTER IS A `hidden` BINDING PER
//     CARD RATHER THAN A FILTERED VIEW - S11's shape, and the one that also
//     keeps every card's key stable across a filter change.
//
// (3) EVERY CLICKABLE IS A `<button type="button">` OR AN `<a>` WITH A REAL
//     `href`. Svelte's emitted-form gate refuses a bare `<span>` carrying a
//     click handler (`a11y_no_static_element_interactions`) and refuses
//     `href="#"` and `href=""` outright (`a11y_invalid_attribute`).
//
// (4) NO TWO-WORD DOM EVENT IS SHIPPED. `jsxEventName` does
//     `name.slice(2).toLowerCase()` and react-dom then never fires the result
//     (DEFECTS.md 15, narrowed to REACT ONLY by T005). Every handler here is
//     `onInput`, `onChange`, `onClick` or `onSubmit` - all single-word.
//
// (5) NO STATE WRITE SITS INSIDE AN `if`. DEFECTS.md 8.1: the react emitter
//     lowers only TOP-LEVEL handler statements, so a write nested in an `if` is
//     NEITHER LOWERED NOR REFUSED. Every write here is top-level; the
//     "do not add a blank contact" guard is a TERNARY, which is an expression.
//
// (6) EVERY STRING CELL IS A `''`-SENTINEL, never `state(null)`: `state(null)`
//     pins the inferred cell type to `null` and the first non-null write does
//     not type (a live qwik TS2322 on s7 in this repo's own `pnpm check`). The
//     numeric-looking cells - `deals`, `priority` - are STRINGS for the same
//     reason plus one more: `event.currentTarget.value` is a string in every
//     lane, so a number cell would need a cast this authoring surface has no
//     construct for.
//
// (7) NO TOP-LEVEL SIDE-EFFECT CALL in the component body - one emits
//     `useRef(null)` in the react lane and costs a type error.
//
// (8) NO TEMPLATE TEXT NODE HAS WHITESPACE EDGES. Angular's `escapeText` refuses
//     one outright and the Vue gate rejects the emitted result. Every gap on
//     this page is a flex `gap` in `demos/shared/contact-css/contacts.css`.
//
// (9) NO ELEMENT WITH A HANDLER MAY SIT BESIDE TEXT. Svelte, Vue and Angular all
//     refuse it - "cannot inline <button>: it sits beside text / in a
//     text-bearing run and needs a multi-line start tag". EVERY TEXT RUN ON THIS
//     PAGE THEREFORE HAS ITS OWN `<span>`.
//
// (10) NO GLOBAL IS NAMED, `Date` INCLUDED. The angular emitter cannot resolve a
//     global identifier in a transplanted body. THIS CONSTRAINT IS THE ONE THIS
//     CARD WAS MOST LIKELY TO BREAK: a `date` input is not a clock and needs no
//     `Date`, but a DEFAULT computed from today does. `since` is seeded with the
//     LITERAL `'2026-02-10'` and `slot` with `'09:30'`, exactly as S13's
//     relative ages and S15's weekday are literals.
//
// (11) EVERY `computed` HAS AN EXPRESSION BODY AND RE-READS ITS CELLS DIRECTLY
//     rather than reading another `computed`, which is why the filter predicate
//     appears in `shown`, in `tally` and on every card. It is S10's proven shape.
//
// (12) EVERY HANDLER READS ITS NEW VALUE FROM A `const` TAKEN BEFORE THE WRITE
//     (`next`), never from the cell it just wrote: the six lanes do not agree on
//     whether a post-write read sees the new value.
//
// (13) NO `style` ATTRIBUTE IS BOUND ANYWHERE. No fixture in this corpus binds
//     one, so the lowering is UNMEASURED in all six lanes. The priority field is
//     exactly where an inline width would have been reached for; it renders a
//     WORD LADDER and a class name instead.
//
// (14) NO STATIC ATTRIBUTE WHOSE DOM TYPE IS NOT `string`, AND THIS CARD MEASURED
//     THE WHOLE TABLE RATHER THAN INHERITING IT. T003 found `rows="6"` failing
//     react's emitted typecheck; T005 found `draggable="true"` failing qwik's.
//     Measured here by emitting one probe carrying forty-odd candidate
//     attributes into each JSX lane's own `generated/` and running that
//     project's own tsc:
//
//       FREE IN ALL THREE   type (all 16 values), name, placeholder, id, for,
//                           pattern, title, aria-*, role, min, max, step
//                           (including step="any"), inputMode, and a BOUND
//                           value / min on any control
//       COSTS ALL THREE     required, multiple, disabled, readonly/readOnly,
//                           autofocus/autoFocus, spellcheck, checked="true",
//                           <select multiple>
//       COSTS react+qwik    maxlength, maxLength, minlength, size, tabindex,
//                           rows, cols, <select size>   (all FREE in solid)
//       COSTS react ONLY    autocomplete       COSTS solid ONLY  autoComplete
//       COSTS qwik ONLY     list, inputmode
//
//     TWO READINGS THAT ARE NOT IN THE BRIEF. First, `min`, `max` and `step` are
//     FREE, so the number, date, time and range fields below carry REAL bounds
//     rather than decorative ones. Second, CASING IS ITS OWN COST AXIS: react
//     wants `autoComplete` and rejects `autocomplete`, solid wants
//     `autocomplete` and rejects `autoComplete`, so NO SPELLING OF autocomplete
//     IS FREE IN BOTH - it is simply absent from this page. `for` survives only
//     because the REACT EMITTER REWRITES IT to `htmlFor`; authoring `htmlFor`
//     instead makes the SVELTE lane refuse the module outright
//     (`attribute_invalid_property_name`).
//
// (15) THE `required` MARKER IS A LITERAL `*` IN THE LABEL, NOT THE ATTRIBUTE.
//     `required="true"` costs one error line in all three JSX lanes, which is
//     the single most expensive thing a contacts form naturally wants. The
//     guard that would have been free is spelled as a TERNARY in the submit
//     handler and as an `aria-disabled` binding on the button - `aria-*` is the
//     one boolean-shaped spelling all six lanes agree on (S7's finding).
//
// (16) A `<form>` CARRYING A `submit` HANDLER ALSO CARRIES A `click` TRACE, or
//     the Svelte emitter refuses the module for a suppression that changes
//     nothing (S13 constraint 13, S14 constraint 11). RE-MEASURED ON THIS CARD's
//     OWN PROBE and it still fires, verbatim:
//       Emitted Svelte module ZProbe.svelte suppresses
//       [a11y_click_events_have_key_events,
//       a11y_no_noninteractive_element_interactions] but without those
//       annotations Svelte reports []. A suppression that changes nothing is a
//       silent over-fire.
//
// (17) THE SEARCH PREDICATE READS A SEEDED LOWERCASE `hay` FIELD rather than
//     concatenating four fields and lowercasing them at match time. That is
//     constraint (10)'s discipline applied to string work: the board's ordering
//     is data in S16 for the same reason, and it keeps the predicate - which
//     constraint (11) forces to appear THREE times - readable.
//
// (18) THE FORM IS A PERSISTENT RIGHT RAIL, NOT A MODAL. The reference opens it
//     as a dialog; `.tsrx` has no portal, no focus trap and no `dialog`
//     construct, and a modal that is merely an absolutely positioned `<div>` is
//     a worse artifact than a rail. The sidebar's "New contact" button is
//     therefore LIVE and resets the fourteen form cells, which is also the only
//     control on the page that writes more than one cell at a time.
//
// WHAT IS DELIBERATELY NOT HERE, each with a reason rather than an omission.
// There is no page routing - `.tsrx` has no routing construct - so the sidebar
// nav links, the company links, the view-mode and theme buttons and the card
// star buttons are INERT and recorded as such. There are no avatar photographs:
// the reference draws gradient discs carrying no state, and reproducing their
// gradients would reproduce THEIR THEME rather than the measured geometry, which
// the licence ruling forbids. `<progress>` and `<meter>` were probed - both emit
// in all six lanes and cost nothing with a bound `value` - and are absent
// because a completeness bar needs either a static `max` whose DOM type is a
// number or an inline `style` width, and (13) and (14) close both doors.
export function Contacts({ onTrace }: {
	onTrace: (name: string, detail: Record<string, unknown>, event: unknown) => void;
}) @{
	let contacts = state([
		{
			id: 'c1',
			first: 'Ama',
			last: 'Boateng',
			full: 'Ama Boateng',
			initial: 'AB',
			avatarClass: 'cs-avatar cs-avatar-active',
			role: 'Chief Technology Officer',
			companyName: 'Northgate Labs',
			industry: 'Technology',
			email: 'ama.boateng@northgate.example',
			phone: '+1 (415) 555 0132',
			site: 'northgate.example',
			status: 'active',
			since: '2025-04-02',
			slot: '09:30',
			deals: '4',
			priority: '5',
			star: '★',
			hay: 'ama boateng northgate labs technology chief technology officer',
			tags: [
				{ id: 'c1t1', name: 'Customer' },
				{ id: 'c1t2', name: 'Investor' },
			],
		},
		{
			id: 'c2',
			first: 'Rune',
			last: 'Halvorsen',
			full: 'Rune Halvorsen',
			initial: 'RH',
			avatarClass: 'cs-avatar cs-avatar-active',
			role: 'Head of Product',
			companyName: 'Wexford Finance',
			industry: 'Finance',
			email: 'rune.h@wexford.example',
			phone: '+47 21 55 01 98',
			site: 'wexford.example',
			status: 'active',
			since: '2024-11-18',
			slot: '11:00',
			deals: '2',
			priority: '4',
			star: '★',
			hay: 'rune halvorsen wexford finance head of product',
			tags: [
				{ id: 'c2t1', name: 'Customer' },
				{ id: 'c2t2', name: 'Partner' },
			],
		},
		{
			id: 'c3',
			first: 'Ines',
			last: 'Carvalho',
			full: 'Ines Carvalho',
			initial: 'IC',
			avatarClass: 'cs-avatar cs-avatar-prospect',
			role: 'Chief Executive',
			companyName: 'Lantern AI',
			industry: 'Research',
			email: 'ines@lantern.example',
			phone: '+351 21 555 0188',
			site: 'lantern.example',
			status: 'prospect',
			since: '2026-01-09',
			slot: '15:45',
			deals: '1',
			priority: '5',
			star: '★',
			hay: 'ines carvalho lantern ai research chief executive',
			tags: [
				{ id: 'c3t1', name: 'Lead' },
				{ id: 'c3t2', name: 'Investor' },
			],
		},
		{
			id: 'c4',
			first: 'Tobias',
			last: 'Whitmore',
			full: 'Tobias Whitmore',
			initial: 'TW',
			avatarClass: 'cs-avatar cs-avatar-active',
			role: 'Lead Engineer',
			companyName: 'Northgate Labs',
			industry: 'Technology',
			email: 't.whitmore@northgate.example',
			phone: '+1 (650) 555 0211',
			site: 'northgate.example',
			status: 'active',
			since: '2025-08-27',
			slot: '08:15',
			deals: '3',
			priority: '3',
			star: '',
			hay: 'tobias whitmore northgate labs technology lead engineer',
			tags: [{ id: 'c4t1', name: 'Customer' }],
		},
		{
			id: 'c5',
			first: 'Nadia',
			last: 'Rahimi',
			full: 'Nadia Rahimi',
			initial: 'NR',
			avatarClass: 'cs-avatar cs-avatar-prospect',
			role: 'Operations Director',
			companyName: 'Harrowfield Logistics',
			industry: 'Logistics',
			email: 'nadia.r@harrowfield.example',
			phone: '+44 20 5555 0163',
			site: 'harrowfield.example',
			status: 'prospect',
			since: '2026-02-10',
			slot: '13:00',
			deals: '0',
			priority: '2',
			star: '',
			hay: 'nadia rahimi harrowfield logistics operations director',
			tags: [{ id: 'c5t1', name: 'Lead' }],
		},
		{
			id: 'c6',
			first: 'Kenji',
			last: 'Morikawa',
			full: 'Kenji Morikawa',
			initial: 'KM',
			avatarClass: 'cs-avatar cs-avatar-active',
			role: 'Creative Director',
			companyName: 'Verity Studio',
			industry: 'Design',
			email: 'kenji@verity.example',
			phone: '+81 90 5555 0147',
			site: 'verity.example',
			status: 'active',
			since: '2023-06-14',
			slot: '10:45',
			deals: '6',
			priority: '4',
			star: '★',
			hay: 'kenji morikawa verity studio design creative director',
			tags: [
				{ id: 'c6t1', name: 'Partner' },
				{ id: 'c6t2', name: 'Supplier' },
			],
		},
		{
			id: 'c7',
			first: 'Priya',
			last: 'Anand',
			full: 'Priya Anand',
			initial: 'PA',
			avatarClass: 'cs-avatar cs-avatar-inactive',
			role: 'Data Analyst',
			companyName: 'Wexford Finance',
			industry: 'Finance',
			email: 'priya.anand@wexford.example',
			phone: '+91 98555 50188',
			site: 'wexford.example',
			status: 'inactive',
			since: '2022-09-30',
			slot: '16:30',
			deals: '0',
			priority: '1',
			star: '',
			hay: 'priya anand wexford finance data analyst',
			tags: [{ id: 'c7t1', name: 'Customer' }],
		},
		{
			id: 'c8',
			first: 'Marco',
			last: 'Delgado',
			full: 'Marco Delgado',
			initial: 'MD',
			avatarClass: 'cs-avatar cs-avatar-inactive',
			role: 'Motion Designer',
			companyName: 'Verity Studio',
			industry: 'Design',
			email: 'marco@verity.example',
			phone: '+52 55 5555 0155',
			site: 'verity.example',
			status: 'inactive',
			since: '2024-03-05',
			slot: '14:15',
			deals: '0',
			priority: '2',
			star: '',
			hay: 'marco delgado verity studio design motion designer',
			tags: [{ id: 'c8t1', name: 'Supplier' }],
		},
		{
			id: 'c9',
			first: 'Sofia',
			last: 'Lindqvist',
			full: 'Sofia Lindqvist',
			initial: 'SL',
			avatarClass: 'cs-avatar cs-avatar-prospect',
			role: 'Growth Lead',
			companyName: 'Harrowfield Logistics',
			industry: 'Logistics',
			email: 'sofia.l@harrowfield.example',
			phone: '+46 70 555 0199',
			site: 'harrowfield.example',
			status: 'prospect',
			since: '2026-01-22',
			slot: '12:00',
			deals: '2',
			priority: '3',
			star: '',
			hay: 'sofia lindqvist harrowfield logistics growth lead',
			tags: [
				{ id: 'c9t1', name: 'Lead' },
				{ id: 'c9t2', name: 'Partner' },
			],
		},
	]);
	let companies = state([
		{ id: 'northgate', name: 'Northgate Labs', industry: 'Technology', count: '2', href: '#/company/northgate' },
		{ id: 'wexford', name: 'Wexford Finance', industry: 'Finance', count: '2', href: '#/company/wexford' },
		{ id: 'lantern', name: 'Lantern AI', industry: 'Research', count: '1', href: '#/company/lantern' },
		{ id: 'harrowfield', name: 'Harrowfield Logistics', industry: 'Logistics', count: '2', href: '#/company/harrowfield' },
		{ id: 'verity', name: 'Verity Studio', industry: 'Design', count: '2', href: '#/company/verity' },
	]);
	let tagRows = state([
		{ id: 'customer', name: 'Customer', on: true, domId: 'cs-tag-customer', controlId: 'tag-customer' },
		{ id: 'lead', name: 'Lead', on: false, domId: 'cs-tag-lead', controlId: 'tag-lead' },
		{ id: 'partner', name: 'Partner', on: false, domId: 'cs-tag-partner', controlId: 'tag-partner' },
		{ id: 'investor', name: 'Investor', on: false, domId: 'cs-tag-investor', controlId: 'tag-investor' },
		{ id: 'supplier', name: 'Supplier', on: false, domId: 'cs-tag-supplier', controlId: 'tag-supplier' },
	]);

	let query = state('');
	let statusFilter = state('all');
	let tagFilter = state('all');

	let first = state('');
	let last = state('');
	let email = state('');
	let phone = state('');
	let site = state('');
	let role = state('');
	let company = state('northgate');
	let status = state('active');
	let deals = state('3');
	let since = state('2026-02-10');
	let slot = state('09:30');
	let priority = state('3');
	let notes = state('');

	const shown = computed(
		() =>
			contacts.filter(
				(row) =>
					(statusFilter === 'all' || row.status === statusFilter) &&
					(tagFilter === 'all' || row.tags.filter((tag) => tag.name === tagFilter).length > 0) &&
					(query === '' || row.hay.indexOf(query.toLowerCase()) !== -1),
			).length,
	);
	const tally = computed(
		() =>
			`${contacts.filter((row) => (statusFilter === 'all' || row.status === statusFilter) && (tagFilter === 'all' || row.tags.filter((tag) => tag.name === tagFilter).length > 0) && (query === '' || row.hay.indexOf(query.toLowerCase()) !== -1)).length}/${contacts.length}`,
	);
	const summary = computed(() =>
		contacts.filter(
			(row) =>
				(statusFilter === 'all' || row.status === statusFilter) &&
				(tagFilter === 'all' || row.tags.filter((tag) => tag.name === tagFilter).length > 0) &&
				(query === '' || row.hay.indexOf(query.toLowerCase()) !== -1),
		).length === 0
			? 'Nothing matches this view.'
			: contacts.filter(
						(row) =>
							(statusFilter === 'all' || row.status === statusFilter) &&
							(tagFilter === 'all' || row.tags.filter((tag) => tag.name === tagFilter).length > 0) &&
							(query === '' || row.hay.indexOf(query.toLowerCase()) !== -1),
					).length < 3
				? 'A narrow slice of the book.'
				: contacts.filter(
							(row) =>
								(statusFilter === 'all' || row.status === statusFilter) &&
								(tagFilter === 'all' ||
									row.tags.filter((tag) => tag.name === tagFilter).length > 0) &&
								(query === '' || row.hay.indexOf(query.toLowerCase()) !== -1),
						).length < 6
					? 'Half the book is in view.'
					: contacts.filter(
								(row) =>
									(statusFilter === 'all' || row.status === statusFilter) &&
									(tagFilter === 'all' ||
										row.tags.filter((tag) => tag.name === tagFilter).length > 0) &&
									(query === '' || row.hay.indexOf(query.toLowerCase()) !== -1),
							).length < 9
						? 'Almost the whole book.'
						: 'Every contact is in view.',
	);
	const summaryEmoji = computed(() =>
		contacts.filter(
			(row) =>
				(statusFilter === 'all' || row.status === statusFilter) &&
				(tagFilter === 'all' || row.tags.filter((tag) => tag.name === tagFilter).length > 0) &&
				(query === '' || row.hay.indexOf(query.toLowerCase()) !== -1),
		).length === 0
			? '◌'
			: contacts.filter(
						(row) =>
							(statusFilter === 'all' || row.status === statusFilter) &&
							(tagFilter === 'all' || row.tags.filter((tag) => tag.name === tagFilter).length > 0) &&
							(query === '' || row.hay.indexOf(query.toLowerCase()) !== -1),
					).length < 3
				? '◔'
				: contacts.filter(
							(row) =>
								(statusFilter === 'all' || row.status === statusFilter) &&
								(tagFilter === 'all' ||
									row.tags.filter((tag) => tag.name === tagFilter).length > 0) &&
								(query === '' || row.hay.indexOf(query.toLowerCase()) !== -1),
						).length < 6
					? '◑'
					: contacts.filter(
								(row) =>
									(statusFilter === 'all' || row.status === statusFilter) &&
									(tagFilter === 'all' ||
										row.tags.filter((tag) => tag.name === tagFilter).length > 0) &&
									(query === '' || row.hay.indexOf(query.toLowerCase()) !== -1),
							).length < 9
						? '◕'
						: '●',
	);

	const previewName = computed(() =>
		first === '' && last === '' ? 'New contact' : `${first} ${last}`,
	);
	const previewRole = computed(() => (role === '' ? 'No role yet' : role));
	const previewCompany = computed(() =>
		companies
			.filter((row) => row.id === company)
			.map((row) => row.name)
			.join(''),
	);
	const previewIndustry = computed(() =>
		companies
			.filter((row) => row.id === company)
			.map((row) => row.industry)
			.join(''),
	);
	const previewTags = computed(
		() =>
			tagRows
				.filter((row) => row.on)
				.map((row) => row.name)
				.join(' · ') || 'No tags',
	);
	const statusLabel = computed(() =>
		status === 'active' ? 'Active' : status === 'prospect' ? 'Prospect' : 'Inactive',
	);
	const statusClass = computed(() =>
		status === 'active'
			? 'cs-chip cs-chip-on'
			: status === 'prospect'
				? 'cs-chip cs-chip-mid'
				: 'cs-chip cs-chip-off',
	);
	const avatarClass = computed(() =>
		status === 'active'
			? 'cs-avatar cs-avatar-active'
			: status === 'prospect'
				? 'cs-avatar cs-avatar-prospect'
				: 'cs-avatar cs-avatar-inactive',
	);
	const previewInitial = computed(() =>
		first === '' && last === '' ? '··' : `${first.slice(0, 1)}${last.slice(0, 1)}`,
	);
	const isActive = computed(() => status === 'active');
	const isProspect = computed(() => status === 'prospect');
	const isInactive = computed(() => status === 'inactive');
	const dealsLabel = computed(() =>
		deals === '1' ? '1 open deal' : `${deals === '' ? '0' : deals} open deals`,
	);
	const priorityWord = computed(() =>
		priority === '1'
			? 'Dormant'
			: priority === '2'
				? 'Low'
				: priority === '3'
					? 'Normal'
					: priority === '4'
						? 'High'
						: 'Critical',
	);
	const priorityClass = computed(() => `cs-prio cs-prio-${priority}`);
	const canAdd = computed(() => first !== '' && last !== '' && email !== '');
	const blocked = computed(() => !(first !== '' && last !== '' && email !== ''));

	<section class="cs" data-app="contacts">
		<div class="cs-shell">
			<aside class="cs-side" data-cs="sidebar">
				<div class="cs-brand" data-cs="brand">
					<span class="cs-mark">◱</span>
					<span class="cs-brandname">Frameless</span>
				</div>
				<button
					type="button"
					class="cs-new"
					data-action="new-contact"
					onClick={(event) => {
						first = '';
						last = '';
						email = '';
						phone = '';
						site = '';
						role = '';
						company = 'northgate';
						status = 'active';
						deals = '3';
						since = '2026-02-10';
						slot = '09:30';
						priority = '3';
						notes = '';
						tagRows = tagRows.map((row) => ({
							id: row.id,
							name: row.name,
							on: false,
							domId: row.domId,
							controlId: row.controlId,
						}));
						onTrace('reset', { area: 'new-contact' }, event);
					}}
				>
					<span class="cs-newglyph">+</span>
					<span class="cs-newtext">New contact</span>
				</button>
				<nav class="cs-nav" data-cs="nav">
					<a
						class="cs-navlink cs-navlink-on"
						href="#/contacts"
						data-nav="contacts"
						onClick={(event) => {
							event.preventDefault();
							onTrace('nav', { to: 'contacts' }, event);
						}}
					>
						<span class="cs-navicon">☰</span>
						<span class="cs-navtext">All contacts</span>
						<span class="cs-badge" data-badge="contacts">{tally}</span>
					</a>
					<a
						class="cs-navlink"
						href="#/favourites"
						data-nav="favourites"
						onClick={(event) => {
							event.preventDefault();
							onTrace('nav', { to: 'favourites' }, event);
						}}
					>
						<span class="cs-navicon">☆</span>
						<span class="cs-navtext">Favourites</span>
					</a>
					<a
						class="cs-navlink"
						href="#/companies"
						data-nav="companies"
						onClick={(event) => {
							event.preventDefault();
							onTrace('nav', { to: 'companies' }, event);
						}}
					>
						<span class="cs-navicon">▣</span>
						<span class="cs-navtext">Companies</span>
					</a>
					<a
						class="cs-navlink"
						href="#/activity"
						data-nav="activity"
						onClick={(event) => {
							event.preventDefault();
							onTrace('nav', { to: 'activity' }, event);
						}}
					>
						<span class="cs-navicon">↯</span>
						<span class="cs-navtext">Activity</span>
					</a>
				</nav>
				<h2 class="cs-sidehead" data-sidehead="companies">Companies</h2>
				<div class="cs-complist" data-cs="companies">
					@for (const row of companies; key row.id) {
						<a
							class="cs-complink"
							href={row.href}
							data-company={row.id}
							onClick={(event) => {
								event.preventDefault();
								onTrace('nav', { to: row.id }, event);
							}}
						>
							<span class="cs-navicon">▤</span>
							<span class="cs-comptext">{row.name}</span>
							<span class="cs-compcount" data-compcount={row.id}>{row.count}</span>
						</a>
					}
				</div>
				<h2 class="cs-sidehead" data-sidehead="tags">Tags</h2>
				<div class="cs-tagfilters" data-cs="tagfilters">
					<button
						type="button"
						class={tagFilter === 'all' ? 'cs-tagpick cs-tagpick-on' : 'cs-tagpick'}
						data-tagfilter="all"
						onClick={(event) => {
							tagFilter = 'all';
							onTrace('tagfilter', { tag: 'all' }, event);
						}}
					><span class="cs-tagpicktext">All tags</span></button>
					@for (const row of tagRows; key row.id) {
						<button
							type="button"
							class={tagFilter === row.name ? 'cs-tagpick cs-tagpick-on' : 'cs-tagpick'}
							data-tagfilter={row.id}
							onClick={(event) => {
								tagFilter = row.name;
								onTrace('tagfilter', { tag: row.name }, event);
							}}
						><span class="cs-tagpicktext">{row.name}</span></button>
					}
				</div>
				<div class="cs-promo" data-cs="promo">
					<span class="cs-promotitle">One source, six lanes</span>
					<span class="cs-promotext">Every control on this page is emitted from a single .tsrx module into react, solid, qwik, svelte, vue and angular.</span>
				</div>
			</aside>
			<div class="cs-content">
				<header class="cs-top" data-cs="topbar">
					<button
						type="button"
						class="cs-icon"
						aria-label="toggle sidebar"
						data-action="toggle-sidebar"
						onClick={(event) => onTrace('press', { area: 'toggle-sidebar' }, event)}
					><span class="cs-iconglyph">▥</span></button>
					<h1 class="cs-crumb" data-cs="crumb">All contacts</h1>
					<input
						type="search"
						class="cs-search"
						id="cs-search"
						name="cs-search"
						placeholder="Search contacts..."
						aria-label="search contacts"
						data-control="search"
						value={query}
						onInput={(event) => {
							const next = event.currentTarget.value;
							query = next;
							onTrace('search', { query: next }, event);
						}}
					/>
					<select
						class="cs-statusfilter"
						id="cs-statusfilter"
						name="cs-statusfilter"
						aria-label="filter by status"
						data-control="statusfilter"
						value={statusFilter}
						onInput={(event) => {
							const next = event.currentTarget.value;
							statusFilter = next;
							onTrace('statusfilter', { status: next }, event);
						}}
					>
						<option value="all">All statuses</option>
						<option value="active">Active</option>
						<option value="prospect">Prospect</option>
						<option value="inactive">Inactive</option>
					</select>
					<span class="cs-topgap"></span>
					<button
						type="button"
						class="cs-icon"
						aria-label="grid view"
						data-action="view-grid"
						onClick={(event) => onTrace('press', { area: 'view-grid' }, event)}
					><span class="cs-iconglyph">▦</span></button>
					<button
						type="button"
						class="cs-icon"
						aria-label="list view"
						data-action="view-list"
						onClick={(event) => onTrace('press', { area: 'view-list' }, event)}
					><span class="cs-iconglyph">☰</span></button>
					<button
						type="button"
						class="cs-icon"
						aria-label="toggle theme"
						data-action="theme"
						onClick={(event) => onTrace('press', { area: 'theme' }, event)}
					><span class="cs-iconglyph">☀</span></button>
				</header>
				<div class="cs-headline" data-cs="headline">
					<p class="cs-tally">
						<span class="cs-tallyshown" data-tally="shown">{shown}</span>
						<span class="cs-tallytext" data-tally="text">in view</span>
					</p>
					<p class="cs-summaryline">
						<span class="cs-summaryemoji" data-summary="emoji">{summaryEmoji}</span>
						<span class="cs-summarytext" data-summary="text">{summary}</span>
					</p>
				</div>
				<p class="cs-note" data-cs="formnote">
					<span class="cs-notemark">!</span>
					<span class="cs-notetext">THIRTEEN CONTROL KINDS SHIP ON THIS PAGE — text, search, email, tel, url, number, date, time, range, select, radio, checkbox and textarea — and every one of them is bound and observable in the live preview. Two things the reference does are NOT copied: its Notes field is a single-line input rather than a textarea, and its whole document contains no heading element at all. Two things it does that this page cannot: required, maxlength, size and multiple each cost the emitted typecheck error lines that the oracle on this board forbids, so the asterisks below are literal text and the guard is a ternary. See the fixture header.</span>
				</p>
				<main class="cs-main" data-cs="main">
					<div class="cs-grid" data-cs="grid">
						@for (const row of contacts; key row.id) {
							<article
								class="cs-card"
								data-card={row.id}
								hidden={
									statusFilter !== 'all' && row.status !== statusFilter
										? true
										: tagFilter !== 'all' &&
												row.tags.filter((tag) => tag.name === tagFilter).length === 0
											? true
											: query !== '' && row.hay.indexOf(query.toLowerCase()) === -1
								}
							>
								<div class="cs-cardtop">
									<span class={row.avatarClass} data-avatar={row.id}>{row.initial}</span>
									<span class="cs-cardhead">
										<span class="cs-cardname" data-cardname={row.id}>{row.full}</span>
										<span class="cs-cardstar" data-cardstar={row.id}>{row.star}</span>
									</span>
									<span class="cs-cardrole" data-cardrole={row.id}>{row.role}</span>
								</div>
								<div class="cs-cardmeta">
									<span class="cs-metarow">
										<span class="cs-metaglyph">▣</span>
										<span class="cs-metatext" data-cardcompany={row.id}>{row.companyName}</span>
										<span class="cs-metadot">·</span>
										<span class="cs-metatext">{row.industry}</span>
									</span>
									<span class="cs-metarow">
										<span class="cs-metaglyph">✉</span>
										<span class="cs-metatext" data-cardemail={row.id}>{row.email}</span>
									</span>
									<span class="cs-metarow">
										<span class="cs-metaglyph">☎</span>
										<span class="cs-metatext" data-cardphone={row.id}>{row.phone}</span>
									</span>
								</div>
								<div class="cs-cardfoot">
									@for (const tag of row.tags; key tag.id) {
										<span class="cs-chip cs-chip-tag" data-cardtag={tag.id}>{tag.name}</span>
									}
									<span class="cs-footgap"></span>
									<span
										class={
											row.status === 'active'
												? 'cs-chip cs-chip-on'
												: row.status === 'prospect'
													? 'cs-chip cs-chip-mid'
													: 'cs-chip cs-chip-off'
										}
										data-cardstatus={row.id}
									>{row.status === 'active' ? 'Active' : row.status === 'prospect' ? 'Prospect' : 'Inactive'}</span>
								</div>
							</article>
						}
					</div>
					<p class="cs-empty" data-cs="empty" hidden={shown !== 0}>
						<span class="cs-emptytext">No contact matches this view.</span>
					</p>
					<form
						class="cs-form"
						data-cs="form"
						onClick={(event) => onTrace('press', { area: 'form' }, event)}
						onSubmit={(event) => {
							event.preventDefault();
							const key = `n${contacts.length}`;
							const lowered = `${first} ${last} ${email} ${role}`.toLowerCase();
							const badge =
								status === 'active'
									? 'cs-avatar cs-avatar-active'
									: status === 'prospect'
										? 'cs-avatar cs-avatar-prospect'
										: 'cs-avatar cs-avatar-inactive';
							contacts =
								first === '' || last === '' || email === ''
									? contacts
									: contacts.concat([
											{
												id: key,
												first: first,
												last: last,
												full: `${first} ${last}`,
												initial: `${first.slice(0, 1)}${last.slice(0, 1)}`,
												avatarClass: badge,
												role: role === '' ? 'No role yet' : role,
												companyName: companies
													.filter((row) => row.id === company)
													.map((row) => row.name)
													.join(''),
												industry: companies
													.filter((row) => row.id === company)
													.map((row) => row.industry)
													.join(''),
												email: email,
												phone: phone,
												site: site,
												status: status,
												since: since,
												slot: slot,
												deals: deals,
												priority: priority,
												star: '',
												hay: lowered,
												tags: tagRows
													.filter((row) => row.on)
													.map((row) => ({ id: `${key}${row.id}`, name: row.name })),
											},
										]);
							onTrace('add', { id: key }, event);
						}}
					>
						<h2 class="cs-formhead" data-formhead="true">New contact</h2>
						<div class="cs-fieldrow">
							<div class="cs-field">
								<label class="cs-label" for="cs-first"><span class="cs-labeltext">First name *</span></label>
								<input
									type="text"
									class="cs-input"
									id="cs-first"
									name="cs-first"
									placeholder="Jane"
									data-control="first"
									value={first}
									onInput={(event) => {
										const next = event.currentTarget.value;
										first = next;
										onTrace('field', { field: 'first', value: next }, event);
									}}
								/>
							</div>
							<div class="cs-field">
								<label class="cs-label" for="cs-last"><span class="cs-labeltext">Last name *</span></label>
								<input
									type="text"
									class="cs-input"
									id="cs-last"
									name="cs-last"
									placeholder="Okafor"
									data-control="last"
									value={last}
									onInput={(event) => {
										const next = event.currentTarget.value;
										last = next;
										onTrace('field', { field: 'last', value: next }, event);
									}}
								/>
							</div>
						</div>
						<div class="cs-field">
							<label class="cs-label" for="cs-email"><span class="cs-labeltext">Email *</span></label>
							<input
								type="email"
								class="cs-input"
								id="cs-email"
								name="cs-email"
								placeholder="jane@example.com"
								data-control="email"
								value={email}
								onInput={(event) => {
									const next = event.currentTarget.value;
									email = next;
									onTrace('field', { field: 'email', value: next }, event);
								}}
							/>
						</div>
						<div class="cs-fieldrow">
							<div class="cs-field">
								<label class="cs-label" for="cs-phone"><span class="cs-labeltext">Phone</span></label>
								<input
									type="tel"
									class="cs-input"
									id="cs-phone"
									name="cs-phone"
									placeholder="+1 (555) 000 0000"
									data-control="phone"
									value={phone}
									onInput={(event) => {
										const next = event.currentTarget.value;
										phone = next;
										onTrace('field', { field: 'phone', value: next }, event);
									}}
								/>
							</div>
							<div class="cs-field">
								<label class="cs-label" for="cs-site"><span class="cs-labeltext">Website</span></label>
								<input
									type="url"
									class="cs-input"
									id="cs-site"
									name="cs-site"
									placeholder="example.com"
									data-control="site"
									value={site}
									onInput={(event) => {
										const next = event.currentTarget.value;
										site = next;
										onTrace('field', { field: 'site', value: next }, event);
									}}
								/>
							</div>
						</div>
						<div class="cs-field">
							<label class="cs-label" for="cs-role"><span class="cs-labeltext">Role</span></label>
							<input
								type="text"
								class="cs-input"
								id="cs-role"
								name="cs-role"
								placeholder="Product Manager"
								data-control="role"
								value={role}
								onInput={(event) => {
									const next = event.currentTarget.value;
									role = next;
									onTrace('field', { field: 'role', value: next }, event);
								}}
							/>
						</div>
						<div class="cs-fieldrow">
							<div class="cs-field">
								<label class="cs-label" for="cs-company"><span class="cs-labeltext">Company</span></label>
								<select
									class="cs-input"
									id="cs-company"
									name="cs-company"
									data-control="company"
									value={company}
									onInput={(event) => {
										const next = event.currentTarget.value;
										company = next;
										onTrace('field', { field: 'company', value: next }, event);
									}}
								>
									@for (const row of companies; key row.id) {
										<option value={row.id}>{row.name}</option>
									}
								</select>
							</div>
							<div class="cs-field">
								<label class="cs-label" for="cs-deals"><span class="cs-labeltext">Open deals</span></label>
								<input
									type="number"
									class="cs-input"
									id="cs-deals"
									name="cs-deals"
									min="0"
									max="20"
									step="1"
									data-control="deals"
									value={deals}
									onInput={(event) => {
										const next = event.currentTarget.value;
										deals = next;
										onTrace('field', { field: 'deals', value: next }, event);
									}}
								/>
							</div>
						</div>
						<div class="cs-fieldrow">
							<div class="cs-field">
								<label class="cs-label" for="cs-since"><span class="cs-labeltext">Client since</span></label>
								<input
									type="date"
									class="cs-input"
									id="cs-since"
									name="cs-since"
									min="2020-01-01"
									max="2030-12-31"
									data-control="since"
									value={since}
									onInput={(event) => {
										const next = event.currentTarget.value;
										since = next;
										onTrace('field', { field: 'since', value: next }, event);
									}}
								/>
							</div>
							<div class="cs-field">
								<label class="cs-label" for="cs-slot"><span class="cs-labeltext">Call slot</span></label>
								<input
									type="time"
									class="cs-input"
									id="cs-slot"
									name="cs-slot"
									min="07:00"
									max="19:00"
									step="900"
									data-control="slot"
									value={slot}
									onInput={(event) => {
										const next = event.currentTarget.value;
										slot = next;
										onTrace('field', { field: 'slot', value: next }, event);
									}}
								/>
							</div>
						</div>
						<div class="cs-field">
							<label class="cs-label" for="cs-priority"><span class="cs-labeltext">Priority</span></label>
							<input
								type="range"
								class="cs-range"
								id="cs-priority"
								name="cs-priority"
								min="1"
								max="5"
								step="1"
								data-control="priority"
								value={priority}
								onInput={(event) => {
									const next = event.currentTarget.value;
									priority = next;
									onTrace('field', { field: 'priority', value: next }, event);
								}}
							/>
						</div>
						<div class="cs-field">
							<span class="cs-label"><span class="cs-labeltext">Status</span></span>
							<div class="cs-radios" data-cs="radios">
								<label class="cs-radio" for="cs-status-active">
									<input
										type="radio"
										class="cs-radiobox"
										id="cs-status-active"
										name="cs-status"
										data-control="status-active"
										checked={isActive}
										onChange={(event) => {
											status = 'active';
											onTrace('field', { field: 'status', value: 'active' }, event);
										}}
									/>
									<span class="cs-radiotext">Active</span>
								</label>
								<label class="cs-radio" for="cs-status-prospect">
									<input
										type="radio"
										class="cs-radiobox"
										id="cs-status-prospect"
										name="cs-status"
										data-control="status-prospect"
										checked={isProspect}
										onChange={(event) => {
											status = 'prospect';
											onTrace('field', { field: 'status', value: 'prospect' }, event);
										}}
									/>
									<span class="cs-radiotext">Prospect</span>
								</label>
								<label class="cs-radio" for="cs-status-inactive">
									<input
										type="radio"
										class="cs-radiobox"
										id="cs-status-inactive"
										name="cs-status"
										data-control="status-inactive"
										checked={isInactive}
										onChange={(event) => {
											status = 'inactive';
											onTrace('field', { field: 'status', value: 'inactive' }, event);
										}}
									/>
									<span class="cs-radiotext">Inactive</span>
								</label>
							</div>
						</div>
						<div class="cs-field">
							<span class="cs-label"><span class="cs-labeltext">Tags</span></span>
							<div class="cs-tagboxes" data-cs="tagboxes">
								@for (const row of tagRows; key row.id) {
									<label class="cs-tagbox" for={row.domId}>
										<input
											type="checkbox"
											class="cs-checkbox"
											id={row.domId}
											name={row.domId}
											data-control={row.controlId}
											checked={row.on}
											onChange={(event) => {
												const next = tagRows.map((entry) =>
													entry.id === row.id
														? {
													id: entry.id,
													name: entry.name,
													on: !entry.on,
													domId: entry.domId,
													controlId: entry.controlId,
												}
														: entry,
												);
												tagRows = next;
												onTrace('field', { field: 'tag', value: row.id }, event);
											}}
										/>
										<span class="cs-tagboxtext">{row.name}</span>
									</label>
								}
							</div>
						</div>
						<div class="cs-field">
							<label class="cs-label" for="cs-notes"><span class="cs-labeltext">Notes</span></label>
							<textarea
								class="cs-textarea"
								id="cs-notes"
								name="cs-notes"
								placeholder="Met at the Lisbon summit..."
								data-control="notes"
								value={notes}
								onInput={(event) => {
									const next = event.currentTarget.value;
									notes = next;
									onTrace('field', { field: 'notes', value: next }, event);
								}}
							/>
						</div>
						<div class="cs-preview" data-cs="preview">
							<div class="cs-cardtop">
								<span class={avatarClass} data-preview="avatar">{previewInitial}</span>
								<span class="cs-cardhead">
									<span class="cs-cardname" data-preview="name">{previewName}</span>
								</span>
								<span class="cs-cardrole" data-preview="role">{previewRole}</span>
							</div>
							<div class="cs-cardmeta">
								<span class="cs-metarow">
									<span class="cs-metaglyph">▣</span>
									<span class="cs-metatext" data-preview="company">{previewCompany}</span>
									<span class="cs-metadot">·</span>
									<span class="cs-metatext" data-preview="industry">{previewIndustry}</span>
								</span>
								<span class="cs-metarow" hidden={email === ''}>
									<span class="cs-metaglyph">✉</span>
									<span class="cs-metatext" data-preview="email">{email}</span>
								</span>
								<span class="cs-metarow" hidden={phone === ''}>
									<span class="cs-metaglyph">☎</span>
									<span class="cs-metatext" data-preview="phone">{phone}</span>
								</span>
								<span class="cs-metarow" hidden={site === ''}>
									<span class="cs-metaglyph">⛓</span>
									<span class="cs-metatext" data-preview="site">{site}</span>
								</span>
								<span class="cs-metarow">
									<span class="cs-metaglyph">◷</span>
									<span class="cs-metatext" data-preview="since">{since}</span>
									<span class="cs-metadot">·</span>
									<span class="cs-metatext" data-preview="slot">{slot}</span>
								</span>
								<span class="cs-metarow">
									<span class="cs-metaglyph">◆</span>
									<span class="cs-metatext" data-preview="deals">{dealsLabel}</span>
								</span>
								<span class="cs-metarow">
									<span class={priorityClass} data-preview="priority">{priorityWord}</span>
								</span>
								<span class="cs-metarow" hidden={notes === ''}>
									<span class="cs-metaglyph">✎</span>
									<span class="cs-metatext" data-preview="notes">{notes}</span>
								</span>
							</div>
							<div class="cs-cardfoot">
								<span class="cs-chip cs-chip-tag" data-preview="tags">{previewTags}</span>
								<span class="cs-footgap"></span>
								<span class={statusClass} data-preview="status">{statusLabel}</span>
							</div>
						</div>
						<div class="cs-actions" data-cs="actions">
							<span class="cs-hint" data-hint="blocked" hidden={canAdd}>
								<span class="cs-hinttext">First name, last name and email are required.</span>
							</span>
							<span class="cs-actiongap"></span>
							<button
								type="submit"
								class="cs-submit"
								data-action="add"
								aria-disabled={blocked}
							><span class="cs-submittext">Add contact</span></button>
						</div>
					</form>
				</main>
			</div>
		</div>
	</section>
}
