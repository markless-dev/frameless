import { render, type CsrRenderable, type CsrRenderContainer } from '@markless/web';
import type { Adapter } from '../oracle/types.ts';
import { setTrace } from '../support/trace-bridge.ts';
import { boundedBrowserQuiescence, dispatchDomAction } from './browser.ts';

type Artifact = { renderCsr(props?: unknown): unknown };
export type MarklessApp = Artifact | { visible: Artifact; hidden: Artifact };
type Handle = { host: HTMLElement; container: CsrRenderContainer };

function selectApp(app: MarklessApp, props: Record<string, unknown>): Artifact {
  if ('renderCsr' in app) return app;
  return props.visible === false ? app.hidden : app.visible;
}

export function marklessAdapter(app: MarklessApp): Adapter<Handle> {
  return {
    name: 'markless-web-0.1.1-csr',
    // Wrapper apps need a host-element root (markless finding #5: a bare
    // component at the template root CSR-renders nothing, silently). The
    // harness element is adapter plumbing, not scenario DOM — observe inside it.
    host: (handle) => (handle.host.querySelector('[data-harness]') as HTMLElement) ?? handle.host,
    async mount(host, props) {
      setTrace(props.onTrace as Parameters<typeof setTrace>[0]);
      try {
        return { host, container: await render(selectApp(app, props) as CsrRenderable, { target: host }) };
      } catch (error) {
        setTrace(null);
        throw error;
      }
    },
    dispatch(handle, action) { dispatchDomAction(handle.host, action); },
    settle(handle) {
      // The runtime graph flush is necessary but not a DOM commit barrier.
      // Follow it with bounded observation through animation frames until the
      // serialized DOM/live-state stamp is stable.
      return boundedBrowserQuiescence(handle.host, async () => { await handle.container.graph.flush(); });
    },
    unmount(handle) {
      try {
        (handle.container.runtime as { dispose?: () => void }).dispose?.();
        handle.host.replaceChildren();
      } finally {
        setTrace(null);
      }
    },
  };
}
