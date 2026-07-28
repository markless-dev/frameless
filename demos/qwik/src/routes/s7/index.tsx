import { $, component$ } from "@qwik.dev/core";
import { FormBoard } from "../../emitted/FormBoard.jsx";

// S7's form seed. The two rows' `on` flags DIFFER: `t1` starts unchecked and
// `t2` starts checked, so one keyed repeat carries a `checked` binding that is
// false and one that is true. Byte-identical to the values the other five lanes
// pass.
export default component$(() => (
  <FormBoard
    seed={[
      { id: "t1", on: false },
      { id: "t2", on: true },
    ]}
    onTrace$={$(() => {})}
  />
));
