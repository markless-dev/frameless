/**
 * The props the three routes hand the emitted components.
 *
 * Byte-for-byte the same values demos/react-official/src/App.jsx and
 * demos/qwik/src/routes/** pass, which is what makes `scripts/e2e.mjs`'s
 * cross-lane observation diff a comparison rather than four unrelated tests.
 *
 * `onTrace` is the emitted components' trace callback. The official demos are
 * activation lanes, not analyzer lanes, so every route here passes a no-op -
 * EVERY ROUTE EXCEPT /hn, which since frameless-app-fidelity-v1 T006 passes a
 * real sink built on `hnDestination` below.
 */
export const noTrace = () => {};

/**
 * The route a trace from `HnFront` should reach, or `null` if none exists.
 *
 * PURE, AND THE SAME MAPPING IN ALL SIX LANES - only the navigation call that
 * consumes it differs, because the six lanes have six routers. It exists at all
 * because /hn's links were NEVER missing a destination: every stub in the
 * emitted `HnFront` already carries `event.preventDefault()` and then
 * `onTrace('nav', { to: 'home' }, event)`, so the intent was named, lowered and
 * typed by the emitter. WHAT WAS MISSING WAS THE SINK - `noTrace` above - and
 * that is where the links died in all six lanes at once.
 *
 * IT RETURNS `null` FOR SEVENTEEN OF THE THIRTY-ONE STUBS ON /hn AND THAT IS
 * NOT AN OMISSION. `new`, `past`, the masthead `comments` (/newcomments, which
 * is not a story thread), `ask`, `show`, `jobs`, `submit`, `login`, `More` and
 * the eight footer links are EACH A SEPARATE APPLICATION; no routing construct
 * in any authoring surface would reach them, so the page labels them in
 * `.hn-note` instead. `open` is absent for a different reason: that trace
 * belongs to a story TITLE whose `href` is a REAL url, held on the page by the
 * fixture's own `preventDefault`, and navigating on it would break something
 * that works.
 *
 * IN THIS LANE '/hn-item' IS NEVER REACHED. The Svelte emitter refuses S14 -
 * "Svelte emitter has no lowering for a same-module component reference
 * (HnItem)" - so no such route exists here and the caller must not invent one.
 * The mapping still NAMES it, so that the four lanes which do ship the page and
 * the two which do not are running the same function rather than two different
 * ones, and the difference lives where it belongs: at the navigation call.
 */
export function hnDestination(
	name: string,
	detail: Record<string, unknown>
): '/hn' | '/hn-item' | null {
	if (name === 'nav' && detail['to'] === 'home') return '/hn';
	if (name === 'comments') return '/hn-item';
	return null;
}

export const s2Seed = [
	{ id: 'a', title: 'one', done: false },
	{ id: 'b', title: 'two', done: true }
];

/**
 * S4's nested seed. Group ids and row ids come from DISJOINT alphabets on
 * purpose: the emitted Angular call site passes both enclosing loop variables
 * positionally, so a swapped argument list has to produce a visibly different
 * selection string rather than one that could be read either way.
 */
export const s4Seed = [
	{ id: 'g1', rows: [{ id: 'r1' }, { id: 'r2' }] },
	{ id: 'g2', rows: [{ id: 'r3' }] }
];

/**
 * S5's branch seed. Three rows, because the scenario drops the first one while
 * the subtree that renders them is torn down and then requires the rebuilt arm
 * to hold exactly the remaining two — a count that is neither the original nor
 * zero, so a rebuild from a stale snapshot and a rebuild from nothing are
 * distinguishable from each other and from a correct one.
 */
export const s5Seed = [{ id: 'k1' }, { id: 'k2' }, { id: 'k3' }];

/**
 * S6's whitespace seed. TWO rows, each with two single-character values, because
 * the scenario's observable is what sits BETWEEN them: `pairs` reads
 * `{row.left}{joiner}{row.right}` per row, and one row could not distinguish
 * "the separator changed" from "the clicked row was rebuilt".
 */
export const s6Seed = [
	{ id: 'w1', left: 'a', right: 'b' },
	{ id: 'w2', left: 'c', right: 'd' }
];

/**
 * S6's whitespace-bearing label, and the reason the scenario can measure
 * interpolated whitespace at all. Its leading space, its interior DOUBLE space
 * and its trailing space are significant and must survive verbatim in all six
 * lanes. A template text node could not carry them: the Angular emitter refuses
 * template text whose own edges are whitespace and the Vue gate rejects the
 * emitted result, so the whitespace has to travel as DATA.
 */
export const s6Label = ' wide  load ';

/**
 * S7's form seed. TWO rows whose `on` flags DIFFER: `t1` starts unchecked and
 * `t2` starts checked, so one keyed repeat carries a `checked` binding that is
 * false and one that is true. One row, or two rows in the same state, could not
 * distinguish "the checkbox reflects its own row" from "every checkbox reflects
 * the same value".
 */
export const s7Seed = [
	{ id: 't1', on: false },
	{ id: 't2', on: true }
];

/**
 * S9's boolean-attribute seed. TWO rows, and BOTH start `off: false`, which is a
 * MEASURED constraint rather than a tidiness preference: S9's whole claim is that
 * a boolean content attribute is ABSENT until state says otherwise, so a row
 * seeded `true` would serve `disabled=""` before any click and could not
 * distinguish "the lowering works" from "the attribute is always there". Two
 * rows rather than one because the scenario seals only `f2` — exactly one button
 * grows the attribute, which is what separates "the boolean reached its own row"
 * from "every button in the repeat reflects the same value".
 */
export const s9Seed = [
	{ id: 'f1', off: false },
	{ id: 'f2', off: false }
];

// ---------------------------------------------------------------------------
// S8's ASYNC GATE. Harness, not emitted output, and deliberately outside the
// emitted component: the `ready` prop is what the emitted handlers `await`, and
// the scenario needs it PENDING at a moment the driver chooses.
//
// The initial gate is ALREADY RESOLVED and the pending one is created by a
// click. That order is a MEASURED constraint from the Qwik lane, and it is
// uniform here so that all six lanes run the identical sequence: Qwik's SSR
// serializer awaits every promise it reaches, so a gate that was pending when
// the server rendered would hang that lane's render outright. See
// `assertS8` in three-way-contract.ts.
// ---------------------------------------------------------------------------
export const s8ResolvedGate: Promise<string> = Promise.resolve('go');
/** The live resolver of the promise `armS8Gate` most recently created. */
export const s8Gate: { release: () => void } = { release: () => {} };
export const armS8Gate = (): Promise<string> =>
	new Promise<string>((resolve) => {
		s8Gate.release = () => resolve('go');
	});
