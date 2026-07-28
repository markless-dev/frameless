import { $, component$ } from "@qwik.dev/core";
import { AttrBoard } from "../../emitted/AttrBoard.jsx";

// S9's boolean-attribute seed. BOTH rows start `off: false`, because the whole
// claim is that a boolean content attribute is ABSENT until state says
// otherwise: a row seeded `true` would serve `disabled=""` before any click.
// Byte-identical to the values the other five lanes pass.
export default component$(() => (
  <AttrBoard
    seed={[
      { id: "f1", off: false },
      { id: "f2", off: false },
    ]}
    onTrace$={$(() => {})}
  />
));
