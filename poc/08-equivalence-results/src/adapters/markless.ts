import { render, type CsrRenderable, type CsrRenderContainer } from '@markless/web';
import type { Adapter } from '../oracle/types.ts';
import { boundedBrowserQuiescence, dispatchDomAction } from './browser.ts';

type Artifact = { renderCsr(props?: unknown): unknown };
type Handle = { host: HTMLElement; container: CsrRenderContainer };

export function marklessAdapter(component: Artifact): Adapter<Handle> {
  return {
    name: 'markless-web-0.1.1-csr',
    host: (handle) => handle.host,
    async mount(host, props) {
      const bound = { renderCsr: () => component.renderCsr(props) } as CsrRenderable;
      return { host, container: await render(bound, { target: host }) };
    },
    dispatch(handle, action) { dispatchDomAction(handle.host, action); },
    settle(handle) {
      // The runtime graph flush is necessary but not a DOM commit barrier.
      // Follow it with bounded observation through animation frames until the
      // serialized DOM/live-state stamp is stable.
      return boundedBrowserQuiescence(handle.host, async () => { await handle.container.graph.flush(); });
    },
    unmount(handle) {
      (handle.container.runtime as { dispose?: () => void }).dispose?.();
      handle.host.replaceChildren();
    },
  };
}
