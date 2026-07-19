import { afterEach } from 'vitest';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
// gate.test.mjs runs in the node environment (no DOM); guard the DOM cleanup.
afterEach(() => {
  if (typeof document !== 'undefined') document.body.replaceChildren();
});
