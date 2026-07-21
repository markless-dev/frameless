import { createApp, h, onUnmounted, shallowRef } from "vue";
import { storage } from "../core/storage.js";

export const theme = storage("theme", "light");

const inert = new URLSearchParams(location.search).get("inert") === "1";

const App = {
  setup() {
    const value = shallowRef(theme.get());
    const unsubscribe = theme.subscribe((next) => {
      value.value = next;
    });
    onUnmounted(unsubscribe);

    return () => [
      h("span", { id: "value" }, value.value),
      h(
        "button",
        {
          id: "toggle",
          onClick: () => theme.set(value.value === "dark" ? "light" : "dark"),
        },
        "toggle",
      ),
    ];
  },
};

const InertApp = { render: () => null };

createApp(inert ? InertApp : App).mount("#app");
window.__READY__ = true;
