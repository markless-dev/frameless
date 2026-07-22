import { StrictMode } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { App } from './app.tsx';

const root = document.getElementById('root');
if (!root) throw new Error('Missing React SSR root.');

hydrateRoot(
	root,
	<StrictMode>
		<App path={window.location.pathname} />
	</StrictMode>,
);
