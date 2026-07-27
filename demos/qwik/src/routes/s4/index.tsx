import { $, component$ } from "@qwik.dev/core";
import { NestedBoard } from "../../emitted/NestedBoard.jsx";
export default component$(() => (
  <NestedBoard seed={[{ id: "g1", rows: [{ id: "r1" }, { id: "r2" }] }, { id: "g2", rows: [{ id: "r3" }] }]} onTrace$={$(() => {})} />
));
