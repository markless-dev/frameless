import { $, component$ } from "@qwik.dev/core";
import { RenderOnce } from "../emitted/RenderOnce.jsx";
export default component$(() => (
  <RenderOnce label="kit" multiplier={2} visible={true} onTrace$={$(() => {})} />
));
