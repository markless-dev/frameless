import { qwikVite } from "@qwik.dev/core/optimizer";
import { qwikRouter } from "@qwik.dev/router/vite";
import { defineConfig } from "vite";

// Official Qwik build: qwikRouter + qwikVite. No hand-rolled rollupOptions / symbolMapper /
// define hacks — those were the bug. This is exactly what `pnpm create qwik` produces.
export default defineConfig({
  plugins: [qwikRouter(), qwikVite()],
});
