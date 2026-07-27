import { renderToString } from 'vue/server-renderer'
import { createApp } from './main'

// DELTA from create-vite-extra@5.0.2 template-ssr-vue-ts/src/entry-server.ts:
// the `_url` the template already receives and discards is passed to
// `createApp`. Nothing else in this file moved.
export async function render(url: string) {
  const { app } = createApp(url)

  // passing SSR context object which will be available via useSSRContext()
  // @vitejs/plugin-vue injects code into a component's setup() that registers
  // itself on ctx.modules. After the render, ctx.modules would contain all the
  // components that have been instantiated during this render call.
  const ctx = {}
  const html = await renderToString(app, ctx)

  return { html }
}
