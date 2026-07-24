import { $, component$ } from "@qwik.dev/core";
import { EventForm } from "../../emitted/EventForm.jsx";
export default component$(() => (
  <EventForm initial="hello" onTrace$={$(() => {})} />
));
