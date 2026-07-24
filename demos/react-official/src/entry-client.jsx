import './index.css'
import { StrictMode, useEffect } from 'react'
import { hydrateRoot } from 'react-dom/client'
import App from './App'

/**
 * React hydrates: the emitted output is inert until hydration commits. The
 * marker makes that moment observable so the e2e lane can click *after* it
 * instead of racing it. It renders nothing, so the hydrated DOM still matches
 * the server output exactly.
 */
function Hydrated() {
  useEffect(() => {
    document.documentElement.setAttribute('data-frameless-activated', 'react')
  }, [])
  return <App url={window.location.pathname} />
}

hydrateRoot(
  document.getElementById('root'),
  <StrictMode>
    <Hydrated />
  </StrictMode>,
)
