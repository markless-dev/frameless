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
