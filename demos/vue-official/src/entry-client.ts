// FIRST, before ./main and before mount(). Vue raises hydration mismatches
// *during* app.mount(), so a sink installed afterwards would capture none of
// them. This import has no bindings on purpose: it installs at module-evaluation
// time. See ./dev-sink.ts, and note that no `app.config.warnHandler` is set
// anywhere in this demo — that would suppress the very channel this watches.
//
// MEASURED, and stated because the ordering here is easy to misread: what makes
// this early is that it is a STATIC import, not that it is written first. ESM
// hoists and evaluates every static import before any statement in this module,
// so moving this line below `app.mount()` changes nothing — verified, the lane
// stays green. The install is genuinely too late only if it is deferred, e.g.
// `await import('./dev-sink')` after mount; that arm was run and
// `calibrateDevSink` in scenarios.box.ts goes RED on it, capturing 0
// diagnostics on the deliberately corrupted page.
import './dev-sink'
import './style.css'
import { createApp } from './main'

// DELTA from create-vite-extra@5.0.2 template-ssr-vue-ts/src/entry-client.ts:
// the dev-sink import above, and the URL handed to `createApp`. The stock
// template's two remaining lines are unchanged. The activation marker is NOT set
// here — `app.mount()` returns before Vue has flushed its mounted hooks, so a
// marker written here would be a claim about interactivity that is not yet true.
// It is set in App.vue's `onMounted`, which is the last mount in the tree.
const { app } = createApp(window.location.pathname)

app.mount('#app')
