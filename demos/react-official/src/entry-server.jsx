import { StrictMode } from 'react'
import { renderToString } from 'react-dom/server'
import App from './App'

/**
 * @param {string} url
 */
export function render(url) {
  const html = renderToString(
    <StrictMode>
      <App url={url} />
    </StrictMode>,
  )
  return { html }
}
