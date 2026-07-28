// Probe-local Svelte config. INSTRUMENT FIX, not part of the measurement.
//
// Without this, svelte-check walks up out of the probe directory, finds the
// repo-root vite.config.ts, and reports "No Svelte configuration found in vite
// config" against every .svelte file - noise that would have polluted the
// positive twin. Its presence stops the upward search; it changes no type.
export default {};
