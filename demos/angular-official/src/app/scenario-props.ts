/**
 * The props the three scenarios hand the emitted components.
 *
 * Byte-for-byte the same values `demos/react-official/src/App.jsx`,
 * `demos/solid-official/src/App.jsx`, `demos/qwik/src/routes/**`,
 * `demos/svelte-official/src/lib/scenario-props.ts` and
 * `demos/vue-official/src/scenario-props.ts` pass, which is what makes
 * `scripts/e2e.mjs`'s cross-lane observation diff a comparison rather than six
 * unrelated tests.
 *
 * `onTrace` is the emitted components' trace callback. The official demos are
 * activation lanes, not analyzer lanes, so every lane passes a no-op.
 *
 * There is no `scenarioFor(url)` counterpart here, and that is the one real
 * structural difference from the five incumbent lanes: they branch on a URL
 * inside a root component because their scaffolds ship no router, while the
 * official Angular SSR scaffold ships `provideRouter` and an `app.routes.ts`
 * that is meant to be filled in. Wiring the three components as three routes is
 * therefore the smaller delta here, not the larger one. See `app.routes.ts`.
 */
export const noTrace = (): void => {};

export const s2Seed = [
  { id: 'a', title: 'one', done: false },
  { id: 'b', title: 'two', done: true },
];

/**
 * S4's nested seed. Group ids and row ids come from DISJOINT alphabets on
 * purpose, and this lane is the reason: the emitted Angular template is the only
 * one that reifies the enclosing loop variables as a positional argument list —
 * `onH9Click(group, row, $event)` — so a swapped list has to produce a visibly
 * different selection string rather than one that could be read either way.
 * That is the red site for ruling 3d's "outermost first".
 */
export const s4Seed = [
  { id: 'g1', rows: [{ id: 'r1' }, { id: 'r2' }] },
  { id: 'g2', rows: [{ id: 'r3' }] },
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
  { id: 'w2', left: 'c', right: 'd' },
];

/**
 * S6's whitespace-bearing label, and THIS LANE IS THE REASON IT EXISTS. The
 * scenario needs a space either side of an interpolated value, and this
 * emitter's `escapeText` throws outright on template text whose own edges are
 * whitespace - `preserveWhitespaces: false` condenses a run to one space and
 * keeps a lone newline verbatim, so a text node placed next to an interpolation
 * would render differently here from the other five lanes. The whitespace
 * therefore travels as DATA, where no template compiler touches it.
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
  { id: 't2', on: true },
];
