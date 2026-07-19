import { act as reactAct } from 'react';
import { createRoot } from 'react-dom/client';
import { render as renderSolid } from 'solid-js/web';
import { afterEach, describe, expect, test } from 'vitest';
import ReactUpdateProbe from '../generated/update-probe.react.jsx';
import SolidUpdateProbe from '../generated/update-probe.solid.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const disposers: Array<() => void> = [];

afterEach(() => {
  while (disposers.length) disposers.pop()?.();
  document.body.replaceChildren();
});

async function mountReact(trace: string[]) {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);

  await reactAct(async () => {
    root.render(<ReactUpdateProbe onProbe={(event: string) => trace.push(event)} />);
  });
  disposers.push(() => reactAct(() => root.unmount()));
  return host;
}

function mountSolid(trace: string[]) {
  const host = document.createElement('div');
  document.body.append(host);
  // This test file is compiled with the React JSX transform, so JSX here would
  // produce a React element. Solid components are plain functions — call it
  // directly so solid-js/web receives real Solid DOM output.
  const dispose = renderSolid(
    () => SolidUpdateProbe({ onProbe: (event: string) => trace.push(event) }),
    host,
  );
  disposers.push(dispose);
  return host;
}

async function click(host: HTMLElement) {
  const button = host.querySelector('button');
  expect(button).not.toBeNull();
  button!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await Promise.resolve();
}

describe('Mitosis 0.13.2 dependency-free onUpdate divergence', () => {
  test('both outputs mount and expose different callback traces for the same phases', async () => {
    const reactTrace: string[] = [];
    const solidTrace: string[] = [];

    const reactHost = await mountReact(reactTrace);
    const solidHost = mountSolid(solidTrace);

    expect(reactHost.querySelector('[data-testid="count"]')?.textContent).toBe('0');
    expect(solidHost.querySelector('[data-testid="count"]')?.textContent).toBe('0');
    expect(reactTrace).toEqual(['update']);
    expect(solidTrace).toEqual([]);

    await reactAct(async () => click(reactHost));
    await click(solidHost);

    expect(reactHost.querySelector('[data-testid="count"]')?.textContent).toBe('1');
    expect(solidHost.querySelector('[data-testid="count"]')?.textContent).toBe('1');
    expect(reactTrace).toEqual(['update', 'update']);
    expect(solidTrace).toEqual([]);
  });
});
