import type { Action } from '../oracle/types.ts';

export function dispatchDomAction(host: HTMLElement, action: Action): void {
  const target = host.querySelector<HTMLElement>(action.target);
  if (!target) throw new Error(`Action target not found: ${action.target}`);
  if (action.type === 'focus') {
    target.focus();
    if (action.selection && target instanceof HTMLInputElement) target.setSelectionRange(...action.selection);
    return;
  }
  if (action.type === 'input') {
    const input = target as HTMLInputElement; input.value = action.value;
    if (action.selection) input.setSelectionRange(...action.selection);
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: action.value }));
    return;
  }
  if (action.type === 'check') {
    const input = target as HTMLInputElement;
    // A real cancelable click performs the browser's checkbox activation and
    // emits input/change. Start opposite the requested state so default action
    // lands on the scenario's requested state.
    input.checked = !action.checked;
    input.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    return;
  }
  target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
}

function observableStamp(host: HTMLElement): string {
  const controls = Array.from(host.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLOptionElement>('input,textarea,option'))
    .map((control) => ({ value: control.value, checked: control instanceof HTMLInputElement ? control.checked : undefined, selected: control instanceof HTMLOptionElement ? control.selected : undefined }));
  const active = host.contains(document.activeElement) ? document.activeElement as HTMLInputElement | HTMLTextAreaElement : null;
  return JSON.stringify({ html: host.innerHTML, controls, focus: active ? [active.getAttribute('data-edit') ?? active.getAttribute('data-action'), active.selectionStart, active.selectionEnd] : null });
}

export async function boundedBrowserQuiescence(host: HTMLElement, flush: () => void | Promise<void>, timeoutMs = 500): Promise<void> {
  const deadline = performance.now() + timeoutMs; let previous = ''; let stable = 0;
  while (performance.now() < deadline) {
    await flush();
    await Promise.resolve();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const current = observableStamp(host);
    stable = current === previous ? stable + 1 : 0; previous = current;
    if (stable >= 2) return;
  }
  throw new Error(`Observable DOM did not quiesce within ${timeoutMs}ms`);
}
