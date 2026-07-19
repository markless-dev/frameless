import type { Observation, SerializedNode } from './types';

// Explicit and deliberately narrow. data-*, class, style and unknown attributes survive.
export const FRAMEWORK_ATTRIBUTE_ALLOWLIST = new Set(['data-reactroot', 'data-solid-render-id']);

export class Observer {
  private ids = new WeakMap<Node, number>();
  private nextId = 1;
  private priorRows = new Map<string, number>();
  private priorFocusRow: string | null = null;
  id(node: Node) { let id = this.ids.get(node); if (!id) { id = this.nextId++; this.ids.set(node, id); } return id; }

  observe(host: HTMLElement, phase: string, callbacks: Observation['callbacks']): Observation {
    const rows: Record<string, number> = {};
    host.querySelectorAll<HTMLElement>('[data-oracle-row-key]').forEach(row => { rows[row.dataset.oracleRowKey!] = this.id(row); });
    const identityViolations: string[] = [];
    for (const [key, oldId] of this.priorRows) if (key in rows && rows[key] !== oldId) identityViolations.push(`row:${key}:remounted`);
    const active = host.contains(document.activeElement) ? document.activeElement as HTMLElement : null;
    const activeRow = active?.closest<HTMLElement>('[data-oracle-row-key]')?.dataset.oracleRowKey ?? null;
    const focusViolations: string[] = [];
    if (this.priorFocusRow && this.priorFocusRow in rows && activeRow !== this.priorFocusRow) focusViolations.push(`row:${this.priorFocusRow}:focus-lost`);
    this.priorRows = new Map(Object.entries(rows));
    this.priorFocusRow = activeRow;
    return {
      phase, dom: this.semanticChildren(host), callbacks: structuredClone(callbacks), rows,
      identityViolations, focusViolations,
      focus: active ? { nodeId: this.id(active), path: this.path(host, active), selection: this.selection(active) } : null,
    };
  }

  private serialize(node: Node): SerializedNode {
    if (node.nodeType === Node.TEXT_NODE) return { nodeType: 'text', text: node.nodeValue ?? '', nodeId: this.id(node) };
    const el = node as Element;
    const attributes = Array.from(el.attributes)
      .filter(a => !FRAMEWORK_ATTRIBUTE_ALLOWLIST.has(a.name))
      .map(a => [a.name, a.value] as [string, string]).sort(([a], [b]) => a.localeCompare(b));
    const properties: Record<string, unknown> = {};
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLOptionElement) properties.value = el.value;
    if (el instanceof HTMLInputElement) properties.checked = el.checked;
    if (el instanceof HTMLOptionElement) properties.selected = el.selected;
    if ('disabled' in el) properties.disabled = Boolean((el as HTMLButtonElement).disabled);
    return { nodeType: 'element', namespace: el.namespaceURI, tag: el.localName, attributes, properties, nodeId: this.id(el), children: this.semanticChildren(el) };
  }
  private semanticChildren(node: Node) { return Array.from(node.childNodes).filter(n => n.nodeType === Node.ELEMENT_NODE || n.nodeType === Node.TEXT_NODE).map(n => this.serialize(n)); }
  private path(host: HTMLElement, el: HTMLElement) {
    const parts: number[] = []; let node: Node = el;
    while (node !== host && node.parentNode) { parts.unshift(Array.from(node.parentNode.childNodes).indexOf(node)); node = node.parentNode; }
    return parts.join('.');
  }
  private selection(el: HTMLElement): [number, number] | null {
    return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement ? [el.selectionStart ?? 0, el.selectionEnd ?? 0] : null;
  }
}
