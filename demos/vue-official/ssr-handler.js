import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const devTemplate = fileURLToPath(new URL('./index.html', import.meta.url))
const prodTemplate = fileURLToPath(new URL('./dist/client/index.html', import.meta.url))
const prodEntry = new URL('./dist/server/entry-server.js', import.meta.url).href

/**
 * The demo's SSR request handler, factored out of server.js so that `node
 * server` (the demo you run) and the e2e witness lane (the thing that proves
 * it) drive the exact same render path. Plain connect middleware — express is
 * not required, only the Vite dev server is.
 *
 * This is the ONLY structural delta this demo makes to
 * `create-vite-extra@5.0.2`'s `template-ssr-vue-ts/server.js`, and it is the
 * delta `demos/react-official` already made to `template-ssr-react/server.js`:
 * the template's inline `app.use('*all', async (req, res) => {…})` body, moved
 * verbatim behind a factory. The one behavioural difference from the template
 * is that the production template is read per request rather than cached in a
 * module-level `templateHtml`, which is what lets the body live outside
 * server.js at all. See `docs/goals/frameless-vue-v1/notes/T004-vue-demo.md`
 * for the provenance chain and the full diff.
 *
 * @param {{ vite?: import('vite').ViteDevServer, base?: string }} options
 */
export function createSsrHandler({ vite, base = '/' } = {}) {
  return async function ssrHandler(req, res) {
    try {
      const url = (req.originalUrl ?? req.url ?? '/').replace(base, '')

      /** @type {string} */
      let template
      /** @type {import('./src/entry-server.ts').render} */
      let render
      if (vite) {
        // Always read a fresh template in development.
        template = await vite.transformIndexHtml(url, await fs.readFile(devTemplate, 'utf-8'))
        render = (await vite.ssrLoadModule('/src/entry-server.ts')).render
      } else {
        template = await fs.readFile(prodTemplate, 'utf-8')
        render = (await import(prodEntry)).render
      }

      const rendered = await render(url)

      const html = template
        .replace(`<!--app-head-->`, rendered.head ?? '')
        .replace(`<!--app-html-->`, rendered.html ?? '')

      res.statusCode = 200
      res.setHeader('Content-Type', 'text/html')
      res.end(html)
    } catch (e) {
      vite?.ssrFixStacktrace(e)
      console.log(e.stack)
      res.statusCode = 500
      res.end(e.stack)
    }
  }
}
