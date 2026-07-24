import { renderToString } from 'solid-js/web'
import App from './App'

/**
 * @param {string} url
 */
export function render(url) {
  const html = renderToString(() => <App url={url} />)
  return { html }
}
