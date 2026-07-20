import { afterEach, describe, expect, test, vi } from 'vitest';
import {
	FRAMEWORK_ATTRIBUTE_ALLOWLIST,
	ANALYZER_CONTRACT_VERSION,
	Observer,
	type SerializedNode,
} from '../src/index.ts';

class TestNode {
	static readonly ELEMENT_NODE = 1;
	static readonly TEXT_NODE = 3;
	readonly childNodes: TestNode[] = [];
	parentNode: TestNode | null = null;

	constructor(readonly nodeType: number) {}

	append(...children: TestNode[]): void {
		for (const child of children) {
			child.parentNode = this;
			this.childNodes.push(child);
		}
	}
}

class TestText extends TestNode {
	constructor(readonly nodeValue: string) {
		super(TestNode.TEXT_NODE);
	}

	get textContent(): string {
		return this.nodeValue;
	}
}

class TestElement extends TestNode {
	readonly attributes: Array<{ name: string; value: string }> = [];
	readonly namespaceURI = 'http://www.w3.org/1999/xhtml';

	constructor(readonly localName: string) {
		super(TestNode.ELEMENT_NODE);
	}

	querySelectorAll<T extends Element>(): T[] {
		return [];
	}

	contains(): boolean {
		return false;
	}
}

function observeChildren(...children: TestNode[]): SerializedNode[] {
	vi.stubGlobal('Node', TestNode);
	vi.stubGlobal('Element', TestElement);
	vi.stubGlobal('HTMLInputElement', class {});
	vi.stubGlobal('HTMLTextAreaElement', class {});
	vi.stubGlobal('HTMLOptionElement', class {});
	vi.stubGlobal('document', { activeElement: null });
	const host = new TestElement('div');
	host.append(...children);
	return new Observer().observe(host as unknown as HTMLElement, 'mount', []).dom;
}

afterEach(() => vi.unstubAllGlobals());

describe('serialization contract', () => {
	test('is versioned and attribute normalization is allowlist-only', () => {
		expect(ANALYZER_CONTRACT_VERSION).toBe('frameless-analyzer/1');
		expect([...FRAMEWORK_ATTRIBUTE_ALLOWLIST]).toEqual([
			'data-reactroot',
			'data-solid-render-id',
		]);
		expect(FRAMEWORK_ATTRIBUTE_ALLOWLIST.has('class')).toBe(false);
		expect(FRAMEWORK_ATTRIBUTE_ALLOWLIST.has('style')).toBe(false);
		expect(FRAMEWORK_ATTRIBUTE_ALLOWLIST.has('data-anything')).toBe(false);
	});

	test('omits empty text nodes between semantic element children', () => {
		const children = observeChildren(
			new TestElement('button'),
			new TestText(''),
			new TestElement('ul'),
		);

		expect(children).toHaveLength(2);
		expect(children.map((child) => [child.nodeType, child.tag])).toEqual([
			['element', 'button'],
			['element', 'ul'],
		]);
	});

	test.each([' ', '\n\t'])('keeps whitespace-only text %j', (text) => {
		expect(observeChildren(new TestText(text))).toEqual([
			{ nodeType: 'text', text, nodeId: 1 },
		]);
	});
});
