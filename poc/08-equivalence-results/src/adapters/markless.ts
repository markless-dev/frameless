import { render, type CsrRenderable, type CsrRenderContainer } from '@markless/web';
import type { Adapter } from '../oracle/types.ts';
import { emitTrace, registerTrace } from '../support/trace-bridge.ts';
import { boundedBrowserQuiescence, dispatchDomAction } from './browser.ts';

type Artifact = { renderCsr(props?: unknown): unknown; preload?: () => void | Promise<void> };
type Handle = { host: HTMLElement; container: CsrRenderContainer; releaseTrace: () => void };

export type MarklessFallbackApp = Artifact | { visible: Artifact; hidden: Artifact };
type Mode = 'direct' | 'trace-fallback' | 'wrapper-fallback';

function selectFallbackApp(app: MarklessFallbackApp, props: Record<string, unknown>): Artifact {
  if ('renderCsr' in app) return app;
  return props.visible === false ? app.hidden : app.visible;
}

function adapter(appFor: (props: Record<string, unknown>) => Artifact, mode: Mode): Adapter<Handle> {
  const wrapperFallback = mode === 'wrapper-fallback';
  const traceFallback = mode !== 'direct';
  return {
    name: `markless-web-0.1.1-csr-${mode}`,
    host: (handle) => wrapperFallback
      ? (handle.host.querySelector('[data-harness]') as HTMLElement) ?? handle.host
      : handle.host,
    async mount(host, props) {
      const artifact = appFor(props);
      // The direct path deliberately bypasses finding #3's old zero-prop wrapper:
      // @markless/web still owns mounting, while the artifact receives the exact
      // scenario props (including the plain callback prop).
      const renderable = wrapperFallback ? artifact : {
        renderCsr: () => artifact.renderCsr(traceFallback ? { ...props, onTrace: emitTrace } : props),
        ...(artifact.preload ? { preload: () => artifact.preload?.() } : {}),
      };
      // Registration precedes render because S1 emits during component setup.
      const releaseTrace = traceFallback
        ? registerTrace(props.onTrace as Parameters<typeof registerTrace>[0])
        : () => {};
      try {
        const container = await render(renderable as CsrRenderable, { target: host });
        if (!wrapperFallback && !host.querySelector('[data-s1-root], [data-scenario="s2"], [data-scenario="s3"]')) {
          (container.runtime as { dispose?: () => void }).dispose?.();
          throw new Error('Markless direct mount rendered no observable DOM (#5-class)');
        }
        return { host, container, releaseTrace };
      } catch (error) {
        releaseTrace();
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
        handle.releaseTrace();
      }
    },
  };
}

export function marklessAdapter(app: Artifact): Adapter<Handle> {
  return adapter(() => app, 'direct');
}

/** Finding #7 fallback: direct fixture and props, changing only callback routing. */
export function marklessTraceFallbackAdapter(app: Artifact): Adapter<Handle> {
  return adapter(() => app, 'trace-fallback');
}

/** Findings #3/#5 fallback: old zero-prop wrapper and harness observation. */
export function marklessFallbackAdapter(app: MarklessFallbackApp): Adapter<Handle> {
  return adapter((props) => selectFallbackApp(app, props), 'wrapper-fallback');
}
