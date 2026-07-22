import { StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import { App, routes } from './app.tsx';

export { routes };

export function render(path: string): string {
	return renderToString(
		<StrictMode>
			<App path={path} />
		</StrictMode>,
	);
}
