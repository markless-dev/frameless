import { $, component$ } from "@qwik.dev/core";
import { TodoMvc } from "../../emitted/TodoMvc.jsx";

// THE FIRST APPLICATION, and the only route here that is not an ordinal. It is
// deliberately NOT part of the 6 x 9 three-way contract - `scripts/e2e.mjs`
// pins `threeWayScenarios` to the literal ['s1'..'s9'] - so this page is
// browsable only. It takes no seed prop at all: IR-8 has no lowering for an
// array type, so the list is seeded inside the emitted component and all six
// lanes therefore start from byte-identical data with no host wiring to keep in
// step. See packages/compiler/test/fixtures/s10-todomvc.tsrx.
export default component$(() => <TodoMvc onTrace$={$(() => {})} />);
