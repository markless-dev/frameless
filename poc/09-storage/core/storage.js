// POC of the RECOMMENDED (not ratified) storage() contract:
//   storage(key, fallback) -> persisted reactive cell.
// - Inert at creation: the driver is not touched until the cell is first read.
// - First read consumes the app-level seed's landing slot when present
//   (zero second driver read); otherwise reads the driver lazily.
// - set() persists, maintains the root attribute, and notifies subscribers.

const SLOT = "__FRAMELESS_STATE__";

export function storage(key, fallback) {
  let value;
  let initialized = false;
  const subs = new Set();

  function init() {
    if (initialized) return;
    initialized = true;
    const slot = typeof window !== "undefined" ? window[SLOT] : undefined;
    if (slot && key in slot) {
      value = slot[key];
      return;
    }
    try {
      const raw = localStorage.getItem(key);
      value = raw === null ? fallback : raw;
    } catch {
      value = fallback;
    }
  }

  return {
    key,
    fallback,
    get() {
      init();
      return value;
    },
    set(next) {
      init();
      value = next;
      try {
        localStorage.setItem(key, next);
      } catch {}
      if (typeof document !== "undefined") {
        document.documentElement.setAttribute("data-" + key, next);
      }
      for (const fn of subs) fn(value);
    },
    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
  };
}
