/**
 * The props the three routes hand the emitted components.
 *
 * Byte-for-byte the same values demos/react-official/src/App.jsx and
 * demos/qwik/src/routes/** pass, which is what makes `scripts/e2e.mjs`'s
 * cross-lane observation diff a comparison rather than four unrelated tests.
 *
 * `onTrace` is the emitted components' trace callback. The official demos are
 * activation lanes, not analyzer lanes, so every lane passes a no-op.
 */
export const noTrace = () => {};

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
