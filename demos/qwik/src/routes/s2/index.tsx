import { $, component$ } from "@qwik.dev/core";
import { KeyedTodo } from "../../emitted/KeyedTodo.jsx";
export default component$(() => (
  <KeyedTodo seed={[{ id: "a", title: "one", done: false }, { id: "b", title: "two", done: true }]} onTrace$={$(() => {})} />
));
