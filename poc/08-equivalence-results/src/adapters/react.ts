import React, { act } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import type { Adapter } from '../oracle/types.ts';
import { boundedBrowserQuiescence, dispatchDomAction } from './browser.ts';

type Handle = { host: HTMLElement; root: Root };
export function reactAdapter(component: React.ComponentType<any>, name: string): Adapter<Handle> {
  return {
    name,
    host: (handle) => handle.host,
    mount(host, props) { const root = createRoot(host); act(() => flushSync(() => root.render(React.createElement(component, props)))); return { host, root }; },
    dispatch(handle, action) { act(() => dispatchDomAction(handle.host, action)); },
    settle(handle) { return boundedBrowserQuiescence(handle.host, async () => { await act(async () => { await Promise.resolve(); }); }); },
    unmount(handle) { act(() => handle.root.unmount()); },
  };
}
