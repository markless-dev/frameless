/** @jsxImportSource solid-js */
import { hydrate } from 'solid-js/web';
import { App } from './app.tsx';

const root = document.getElementById('root');
if (!root) throw new Error('Missing Solid SSR root.');

hydrate(() => <App path={window.location.pathname} />, root);
