import { createSSRApp } from 'vue'
import App from './App.vue'

// SSR requires a fresh app instance per request, therefore we export a function
// that creates a fresh app instance. If using Vuex, we'd also be creating a
// fresh store here.
//
// DELTA from create-vite-extra@5.0.2 template-ssr-vue-ts/src/main.ts: the URL is
// threaded through as a root prop. The stock template calls `createApp()` with
// no argument because its App renders one fixed component; this demo maps `/`,
// `/s2` and `/s3` onto S1/S2/S3 the way demos/react-official/src/App.jsx does,
// so both entries hand it the URL they already have — `render(url)` on the
// server, `window.location.pathname` on the client. No router is added, which
// is why this lane's `expectedNavigations` is 0.
//
// `app.config.warnHandler` is deliberately NOT set here or anywhere in this
// demo. It intercepts Vue's own `warn()` channel and suppresses the console
// output, and `[Vue warn]: Hydration text content mismatch` travels through it
// (measured by T003, finding 2). A warnHandler that did not re-emit would turn
// src/dev-sink.ts into a green vacuum.
export function createApp(url: string) {
  const app = createSSRApp(App, { url })
  return { app }
}
