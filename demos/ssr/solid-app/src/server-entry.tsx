/** @jsxImportSource solid-js */
import { generateHydrationScript, renderToString } from 'solid-js/web';
import { App, routes } from './app.tsx';

export { routes };

export interface RenderedPage {
	markup: string;
	hydrationScript: string;
}

export function render(path: string): RenderedPage {
	return {
		markup: renderToString(() => <App path={path} />),
		hydrationScript: generateHydrationScript(),
	};
}
