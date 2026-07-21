import { useEffect, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import { storage } from "../core/storage.js";

export const theme = storage("theme", "light");

const inert = new URLSearchParams(location.search).get("inert") === "1";

function Ready() {
  useEffect(() => {
    window.__READY__ = true;
  }, []);
  return null;
}

function App() {
  const value = useSyncExternalStore(theme.subscribe, theme.get, theme.get);

  return (
    <>
      <span id="value">{value}</span>
      <button
        id="toggle"
        onClick={() => theme.set(value === "dark" ? "light" : "dark")}
      >
        toggle
      </button>
      <Ready />
    </>
  );
}

createRoot(document.getElementById("app")).render(inert ? <Ready /> : <App />);
