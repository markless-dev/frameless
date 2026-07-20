import type { Observation, SerializedNode } from './types.ts';

// Explicit and deliberately narrow. data-*, class, style and unknown attributes survive.
export const FRAMEWORK_ATTRIBUTE_ALLOWLIST = new Set(['data-reactroot', 'data-solid-render-id']);

export class Observer {
	private ids = new WeakMap<Node, number>();
	private nextId = 1;
	private priorRows = new Map<string, number>();
	private priorFocusRow: string | null = null;

	private id(node: Node): number {
		let id = this.ids.get(node);
		if (!id) {
			id = this.nextId++;
			this.ids.set(node, id);
		}
		return id;
	}

	observe(host: HTMLElement, phase: string, callbacks: Observation['callbacks']): Observation {
		const rows: Record<string, number> = {};
		host.querySelectorAll<HTMLElement>('[data-oracle-row-key]').forEach((row) => {
			rows[row.dataset.oracleRowKey!] = this.id(row);
		});
		const identityViolations: string[] = [];
		for (const [key, oldId] of this.priorRows) {
			if (key in rows && rows[key] !== oldId) identityViolations.push(`row:${key}:remounted`);
		}
		const active = host.contains(document.activeElement)
			? (document.activeElement as HTMLElement)
			: null;
		const activeRow =
			active?.closest<HTMLElement>('[data-oracle-row-key]')?.dataset.oracleRowKey ?? null;
		const focusViolations: string[] = [];
		if (this.priorFocusRow && this.priorFocusRow in rows && activeRow !== this.priorFocusRow) {
			focusViolations.push(`row:${this.priorFocusRow}:focus-lost`);
		}
		this.priorRows = new Map(Object.entries(rows));
		this.priorFocusRow = activeRow;
		return {
			phase,
			dom: this.semanticChildren(host),
			callbacks: structuredClone(callbacks),
			rows,
			identityViolations,
			focusViolations,
			focus: active
				? { nodeId: this.id(active), path: this.path(host, active), selection: this.selection(active) }
				: null,
		};
	}

	private serialize(node: Node): SerializedNode {
		if (node.nodeType === Node.TEXT_NODE) {
			return { nodeType: 'text', text: node.nodeValue ?? '', nodeId: this.id(node) };
		}
		const element = node as Element;
		const attributes = Array.from(element.attributes)
			.filter((attribute) => !FRAMEWORK_ATTRIBUTE_ALLOWLIST.has(attribute.name))
			.map((attribute) => [attribute.name, attribute.value] as [string, string])
			.sort(([left], [right]) => left.localeCompare(right));
		const properties: Record<string, unknown> = {};
		if (
			element instanceof HTMLInputElement ||
			element instanceof HTMLTextAreaElement ||
			element instanceof HTMLOptionElement
		) {
			properties.value = element.value;
		}
		if (element instanceof HTMLInputElement) properties.checked = element.checked;
		if (element instanceof HTMLOptionElement) properties.selected = element.selected;
		if ('disabled' in element) properties.disabled = Boolean((element as HTMLButtonElement).disabled);
		return {
			nodeType: 'element',
			namespace: element.namespaceURI,
			tag: element.localName,
			attributes,
			properties,
			nodeId: this.id(element),
			children: this.semanticChildren(element),
		};
	}

	private semanticChildren(node: Node): SerializedNode[] {
		return Array.from(node.childNodes)
			.filter((child) =>
				child.nodeType === Node.ELEMENT_NODE || child.nodeType === Node.TEXT_NODE,
			)
			.map((child) => this.serialize(child));
	}

	private path(host: HTMLElement, element: HTMLElement): string {
		const parts: number[] = [];
		let node: Node = element;
		while (node !== host && node.parentNode) {
			parts.unshift(Array.from(node.parentNode.childNodes).indexOf(node));
			node = node.parentNode;
		}
		return parts.join('.');
	}

	private selection(element: HTMLElement): [number, number] | null {
		return element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement
			? [element.selectionStart ?? 0, element.selectionEnd ?? 0]
			: null;
	}
}
