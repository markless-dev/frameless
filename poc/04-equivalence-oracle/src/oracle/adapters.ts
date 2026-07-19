import React, { act } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { render } from 'solid-js/web';
import type { Action, Adapter } from './types';

function perform(host: HTMLElement, action: Action) {
  const target = host.querySelector<HTMLElement>(action.target);
  if (!target) throw new Error(`Action target not found: ${action.target}`);
  if (action.type === 'focus') { target.focus(); if (action.selection && target instanceof HTMLInputElement) target.setSelectionRange(...action.selection); return; }
  if (action.type === 'input') {
    const input = target as HTMLInputElement; input.value = action.value;
    if (action.selection) input.setSelectionRange(...action.selection);
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: action.value })); return;
  }
  if (action.type === 'check') { const input = target as HTMLInputElement; input.checked = !action.checked; input.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); return; }
  target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
}

async function boundedQuiescence(host: HTMLElement, flush: () => Promise<void>, timeoutMs = 500) {
  const deadline = performance.now() + timeoutMs; let last = ''; let stable = 0;
  while (performance.now() < deadline) {
    await flush(); await Promise.resolve();
    const current = host.innerHTML;
    stable = current === last ? stable + 1 : 0; last = current;
    if (stable >= 2) return;
  }
  throw new Error(`Scheduler did not quiesce within ${timeoutMs}ms`);
}

type ReactHandle = { host: HTMLElement; root: Root };
export function reactAdapter(component: React.ComponentType<any>): Adapter<ReactHandle> {
  return {
    name: 'react-18.3.1', host: h => h.host,
    mount(host, props) { const root = createRoot(host); act(() => flushSync(() => root.render(React.createElement(component, props)))); return { host, root }; },
    dispatch(h, action) { act(() => perform(h.host, action)); },
    settle(h) { return boundedQuiescence(h.host, async () => { await act(async () => { await Promise.resolve(); }); }); },
    unmount(h) { act(() => h.root.unmount()); },
  };
}
type SolidHandle = { host: HTMLElement; dispose: () => void };
export function solidAdapter(component: (props: any) => unknown): Adapter<SolidHandle> {
  return {
    name: 'solid-1.8.22-fallback', host: h => h.host,
    mount(host, props) { return { host, dispose: render(() => component(props) as any, host) }; },
    dispatch(h, action) { perform(h.host, action); },
    settle(h) { return boundedQuiescence(h.host, async () => { await Promise.resolve(); }); },
    unmount(h) { h.dispose(); },
  };
}
