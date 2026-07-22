import {
	ANALYZER_CONTRACT_VERSION,
	evaluateExpectations,
	type Expectation,
	type ExpectationResult,
	type Observation,
	type RunTrace,
	type SerializedNode,
} from '@frameless/analyzer';
import { parse, parseFragment, serialize, type DefaultTreeAdapterTypes } from 'parse5';

export type PreActivationInput = {
	html: string;
	scenario: string;
	framework: string;
	expectations: readonly Expectation[];
};

function findElementById(
	node: DefaultTreeAdapterTypes.Node,
	id: string,
): DefaultTreeAdapterTypes.Element | null {
	if ('tagName' in node && node.attrs.some((attribute) => attribute.name === 'id' && attribute.value === id)) {
		return node;
	}
	if ('childNodes' in node) {
		for (const child of node.childNodes) {
			const match = findElementById(child, id);
			if (match) return match;
		}
	}
	return null;
}

/** Extract the component subtree so dom-path parentTags start at the component's own root. */
export function extractRootInnerMarkup(html: string): string {
	const document = parse(html);
	const root = findElementById(document, 'root');
	if (!root) throw new Error('Expected prerendered HTML to contain #root.');
	const fragment: DefaultTreeAdapterTypes.DocumentFragment = {
		nodeName: '#document-fragment',
		childNodes: root.childNodes,
	};
	return serialize(fragment);
}

function serializeNode(node: DefaultTreeAdapterTypes.ChildNode): SerializedNode | null {
	if (node.nodeName === '#text') {
		return { nodeType: 'text', text: (node as DefaultTreeAdapterTypes.TextNode).value };
	}

	if ('tagName' in node) {
		return {
			nodeType: 'element',
			tag: node.tagName.toLowerCase(),
			attributes: node.attrs.map(({ name, value }) => [name, value]),
			children: serializeNodes(node.childNodes),
		};
	}

	// Comments and any other non-element, non-text parse nodes are not part of SerializedNode.
	return null;
}

function serializeNodes(nodes: DefaultTreeAdapterTypes.ChildNode[]): SerializedNode[] {
	return nodes.flatMap((node) => {
		const serialized = serializeNode(node);
		return serialized ? [serialized] : [];
	});
}

/** Evaluate mount-phase DOM expectations against server HTML before activation. */
export function evaluatePreActivation({
	html,
	scenario,
	framework,
	expectations,
}: PreActivationInput): ExpectationResult[] {
	const document = parseFragment(html);
	const observation: Observation = {
		phase: 'mount',
		dom: serializeNodes(document.childNodes),
		focus: null,
		callbacks: [],
		rows: {},
		identityViolations: [],
		focusViolations: [],
	};
	const trace: RunTrace = {
		contract: ANALYZER_CONTRACT_VERSION,
		scenario,
		framework,
		observations: [observation],
	};
	const mountDomExpectations = expectations.filter(
		(expectation) => expectation.phase === 'mount' && expectation.kind !== 'focus',
	);

	return evaluateExpectations(trace, mountDomExpectations);
}
