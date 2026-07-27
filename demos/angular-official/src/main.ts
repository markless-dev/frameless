// FIRST, before ./app/app.config and before bootstrapApplication(). Angular
// raises NG0505 ("hydration was requested on the client, but there was no
// serialized information present in the server response") from an
// ENVIRONMENT_INITIALIZER that runs *inside* bootstrapApplication, so a sink
// installed afterwards would capture none of it. This import has no bindings on
// purpose: it installs at module-evaluation time. See ./dev-sink.
//
// MEASURED, and stated because the ordering here is easy to misread: what makes
// this early is that it is a STATIC import, not that it is written first. ESM
// hoists and evaluates every static import before any statement in this module,
// so moving this line below the bootstrapApplication() call changes nothing.
// demos/vue-official caught exactly that as an invalid negative arm. The install
// is genuinely too late only if it is deferred — `await import('./dev-sink')`
// after bootstrap — and that arm was run: `calibrateDevSink` in
// scenarios.box.ts goes RED on it, capturing 0 diagnostics on the page whose
// serialized hydration state was deliberately deleted.
import './dev-sink';
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

// DELTA from the `ng new --ssr` scaffold's src/main.ts: the dev-sink import
// above. The scaffold's own two statements are unchanged.
bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
