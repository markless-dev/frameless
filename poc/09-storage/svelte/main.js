import { mount } from "svelte";
import { storage } from "../core/storage.js";
import App from "./App.svelte";

export const theme = storage("theme", "light");

const inert = new URLSearchParams(location.search).get("inert") === "1";

if (!inert) {
  mount(App, {
    target: document.getElementById("app"),
    props: { cell: theme },
  });
}
window.__READY__ = true;
