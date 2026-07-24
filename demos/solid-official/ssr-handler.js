import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { generateHydrationScript } from 'solid-js/web'

const devTemplate = fileURLToPath(new URL('./index.html', import.meta.url))
const prodTemplate = fileURLToPath(new URL('./dist/client/index.html', import.meta.url))
const prodEntry = new URL('./dist/server/entry-server.js', import.meta.url).href

/**
 * The demo's SSR request handler, factored out of server.js so that `node
 * server` (the demo you run) and the e2e witness lane (the thing that proves
 * it) drive the exact same render path. Plain connect middleware — express is
 * not required, only the Vite dev server is.
 *
 * @param {{ vite?: import('vite').ViteDevServer, base?: string }} options
 */
export function createSsrHandler({ vite, base = '/' } = {}) {
  return async function ssrHandler(req, res) {
    try {
      const url = (req.originalUrl ?? req.url ?? '/').replace(base, '')

      /** @type {string} */
      let template
      /** @type {import('./src/entry-server.js').render} */
      let render
      if (vite) {
        // Always read a fresh template in development.
        template = await vite.transformIndexHtml(url, await fs.readFile(devTemplate, 'utf-8'))
        render = (await vite.ssrLoadModule('/src/entry-server.jsx')).render
      } else {
        template = await fs.readFile(prodTemplate, 'utf-8')
        render = (await import(prodEntry)).render
      }

      const rendered = await render(url)

      const head = (rendered.head ?? '') + generateHydrationScript()

      const html = template
        .replace(`<!--app-head-->`, head)
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
