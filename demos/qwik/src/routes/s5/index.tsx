import { $, component$ } from "@qwik.dev/core";
import { BranchBoard } from "../../emitted/BranchBoard.jsx";
export default component$(() => (
  <BranchBoard seed={[{ id: "k1" }, { id: "k2" }, { id: "k3" }]} onTrace$={$(() => {})} />
));
