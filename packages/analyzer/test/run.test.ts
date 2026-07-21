import { afterEach, describe, expect, test, vi } from 'vitest';
import {
	ANALYZER_CONTRACT_VERSION,
	runScenario,
	serializeRunTrace,
	type Adapter,
	type Scenario,
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

	remove(): void {
		if (!this.parentNode) return;
		const index = this.parentNode.childNodes.indexOf(this);
		if (index >= 0) this.parentNode.childNodes.splice(index, 1);
		this.parentNode = null;
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

	contains(target: unknown): boolean {
		return (
			target === this ||
			this.childNodes.some((child) =>
				child instanceof TestElement ? child.contains(target) : child === target,
			)
		);
	}

	closest(): null {
		return null;
	}
}

const scenario: Scenario = {
	id: 'witness',
	purpose: 'post-unmount cleanup observation',
	initialProps: {},
	actions: [],
	expectedCallbacks: [],
};

function installDom() {
	const body = new TestElement('body');
	const witness = new TestElement('aside');
	witness.attributes.push({ name: 'data-witness', value: '' });
	witness.append(new TestText('cleanup'));
	body.append(witness);
	vi.stubGlobal('Node', TestNode);
	vi.stubGlobal('Element', TestElement);
	vi.stubGlobal('HTMLInputElement', class {});
	vi.stubGlobal('HTMLTextAreaElement', class {});
	vi.stubGlobal('HTMLOptionElement', class {});
	vi.stubGlobal('document', {
		activeElement: null,
		body,
		createElement: (tag: string) => new TestElement(tag),
		querySelector: (selector: string) => (selector === '[data-witness]' ? witness : null),
	});
	return witness;
}

function adapter(witness: TestElement): Adapter<TestElement> {
	return {
		name: 'fixture',
		mount(host) {
			const component = new TestElement('section');
			component.attributes.push({ name: 'data-component', value: '' });
			(host as unknown as TestElement).append(component);
			return host as unknown as TestElement;
		},
		dispatch() {},
		async settle() {},
		unmount() {
			witness.attributes.push({ name: 'data-cleaned', value: 'yes' });
		},
		host(handle) {
			return handle as unknown as HTMLElement;
		},
	};
}

afterEach(() => vi.unstubAllGlobals());

describe('runScenario post-unmount witness', () => {
	test('observes an external document witness after unmount and before host removal', async () => {
		const witness = installDom();
		const trace = await runScenario(adapter(witness), scenario, { selector: '[data-witness]' });
		expect(trace.observations.at(-1)).toMatchObject({
			phase: 'unmount',
			dom: [
				{
					nodeType: 'element',
					tag: 'aside',
					attributes: [
						['data-cleaned', 'yes'],
						['data-witness', ''],
					],
					children: [{ nodeType: 'text', text: 'cleanup' }],
				},
			],
		});
	});

	test('keeps the legacy serialized trace shape byte-identical when witness is absent', async () => {
		const witness = installDom();
		const trace = await runScenario(adapter(witness), scenario);
		const expected = {
			contract: ANALYZER_CONTRACT_VERSION,
			scenario: 'witness',
			framework: 'fixture',
			observations: [
				{
					phase: 'mount',
					dom: [
						{
							nodeType: 'element' as const,
							namespace: 'http://www.w3.org/1999/xhtml',
							tag: 'section',
							attributes: [['data-component', ''] as [string, string]],
							properties: {},
							nodeId: 1,
							children: [],
						},
					],
					focus: null,
					callbacks: [],
					rows: {},
					identityViolations: [],
					focusViolations: [],
				},
			],
		};
		expect(serializeRunTrace(trace)).toBe(serializeRunTrace(expected));
	});
});
