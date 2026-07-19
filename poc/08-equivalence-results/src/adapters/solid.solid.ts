import { render } from 'solid-js/web';
import type { Adapter } from '../oracle/types.ts';
import { boundedBrowserQuiescence, dispatchDomAction } from './browser.ts';

type Handle = { host: HTMLElement; dispose: () => void };
export function solidAdapter(component: (props: any) => unknown, name: string): Adapter<Handle> {
  return {
    name,
    host: (handle) => handle.host,
    mount(host, props) { return { host, dispose: render(() => component(props) as any, host) }; },
    dispatch(handle, action) { dispatchDomAction(handle.host, action); },
    settle(handle) { return boundedBrowserQuiescence(handle.host, async () => { await Promise.resolve(); }); },
    unmount(handle) { handle.dispose(); },
  };
}
