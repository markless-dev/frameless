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
