import { $, component$ } from "@qwik.dev/core";
import { WhitespaceBoard } from "../../emitted/WhitespaceBoard.jsx";

// `label` is passed as an EXPRESSION rather than as a JSX string attribute: its
// leading, interior and trailing spaces are the observation, and a string
// attribute is the one position where a JSX transform is entitled to normalise
// whitespace. The value is byte-identical to the one the other five lanes pass.
const label = " wide  load ";

export default component$(() => (
  <WhitespaceBoard
    seed={[
      { id: "w1", left: "a", right: "b" },
      { id: "w2", left: "c", right: "d" },
    ]}
    label={label}
    onTrace$={$(() => {})}
  />
));
