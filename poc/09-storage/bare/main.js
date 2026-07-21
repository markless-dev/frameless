// Bare (no framework) target — proves the shared core + runner contract.
// DOM contract every framework adapter must satisfy inside #app:
//   #value  -> element whose textContent is the current cell value
//   #toggle -> button that flips the value dark/light
// window.__READY__ = true after mount.
import { storage } from "../core/storage.js";

export const theme = storage("theme", "light");

const inert = new URLSearchParams(location.search).get("inert") === "1";
const app = document.getElementById("app");

if (!inert) {
  const value = document.createElement("span");
  value.id = "value";
  value.textContent = theme.get();
  theme.subscribe((v) => (value.textContent = v));
  const toggle = document.createElement("button");
  toggle.id = "toggle";
  toggle.textContent = "toggle";
  toggle.addEventListener("click", () =>
    theme.set(theme.get() === "dark" ? "light" : "dark")
  );
  app.append(value, toggle);
}
window.__READY__ = true;
