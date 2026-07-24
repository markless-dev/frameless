/* @refresh reload */
import './index.css'
import { onMount } from 'solid-js'
import { hydrate } from 'solid-js/web'
import App from './App'

// Solid hydrates: the emitted output is inert until hydration runs. The marker
// makes that moment observable so the e2e lane can click *after* it instead of
// racing it. onMount lives in the existing root closure rather than in a
// wrapper component, so Solid's hydration keys are untouched.
hydrate(() => {
  onMount(() => {
    document.documentElement.setAttribute('data-frameless-activated', 'solid')
  })
  return <App url={window.location.pathname} />
}, document.getElementById('root'))
