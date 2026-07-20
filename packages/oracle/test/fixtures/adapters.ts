import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { render } from 'solid-js/web';
import type { Adapter } from '../../src/index.ts';
import { boundedBrowserQuiescence, dispatchDomAction } from './browser.ts';

type ReactHandle = { host: HTMLElement; root: Root };
export function reactFixtureAdapter(component: React.ComponentType<any>): Adapter<ReactHandle> {
	return {
		name: 'react-19.2.3-calibration-fixture',
		host: (handle) => handle.host,
		async mount(host, props) {
			const root = createRoot(host);
			await act(async () => {
				root.render(React.createElement(component, props));
			});
			return { host, root };
		},
		async dispatch(handle, action) {
			await act(async () => {
				dispatchDomAction(handle.host, action);
			});
		},
		settle(handle) {
			return boundedBrowserQuiescence(handle.host, async () => {
				await act(async () => {
					await Promise.resolve();
				});
			});
		},
		async unmount(handle) {
			await act(async () => {
				handle.root.unmount();
			});
		},
	};
}

type SolidHandle = { host: HTMLElement; dispose: () => void };
export function solidFixtureAdapter(component: (props: any) => unknown): Adapter<SolidHandle> {
	return {
		name: 'solid-1.8.22-fallback-calibration-fixture',
		host: (handle) => handle.host,
		mount(host, props) {
			return { host, dispose: render(() => component(props) as any, host) };
		},
		dispatch(handle, action) {
			dispatchDomAction(handle.host, action);
		},
		settle(handle) {
			return boundedBrowserQuiescence(handle.host, async () => {
				await Promise.resolve();
			});
		},
		unmount(handle) {
			handle.dispose();
		},
	};
}
