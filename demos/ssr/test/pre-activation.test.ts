import assert from 'node:assert/strict';
import test from 'node:test';

import type { Expectation } from '@frameless/analyzer';

import { evaluatePreActivation, extractRootInnerMarkup } from '../src/pre-activation.ts';

const html = `
	<!-- prerendered pricing card -->
	<article data-component="pricing-card">
		<section data-pricing-state="visible">
			<h2>Pro</h2>
			<p><span data-seat-count="">1</span> seats</p>
			<output data-price-total="">$20</output>
		</section>
	</article>
`;

function evaluate(expectations: Expectation[]) {
	return evaluatePreActivation({
		html,
		scenario: 'pricing-card/initial',
		framework: 'react',
		expectations,
	});
}

test('passes a matching dom-text expectation', () => {
	const [result] = evaluate([
		{ kind: 'dom-text', phase: 'mount', selector: '[data-price-total]', text: '$20' },
	]);

	assert.equal(result?.outcome, 'pass');
});

test('passes a matching dom-present element count', () => {
	const [result] = evaluate([
		{ kind: 'dom-present', phase: 'mount', selector: 'section', count: 1 },
	]);

	assert.equal(result?.outcome, 'pass');
});

test('passes a matching dom-path expectation', () => {
	const [result] = evaluate([
		{
			kind: 'dom-path',
			phase: 'mount',
			selector: '[data-seat-count]',
			parentTags: ['article', 'section', 'p'],
		},
	]);

	assert.equal(result?.outcome, 'pass');
});

test('extracts only root inner markup for component-relative dom paths', () => {
	const componentMarkup = extractRootInnerMarkup(
		'<html><head></head><body><div id="root"><article><span data-leaf=""></span></article></div></body></html>',
	);
	const [result] = evaluatePreActivation({
		html: componentMarkup,
		scenario: 'root-slice',
		framework: 'react',
		expectations: [
			{ kind: 'dom-path', phase: 'mount', selector: '[data-leaf]', parentTags: ['article'] },
		],
	});

	assert.equal(result?.outcome, 'pass');
});

test('negative control reports the observed server value', () => {
	const [result] = evaluate([
		{ kind: 'dom-text', phase: 'mount', selector: '[data-price-total]', text: '$999' },
	]);

	assert.deepEqual(result, {
		expectation: {
			kind: 'dom-text',
			phase: 'mount',
			selector: '[data-price-total]',
			text: '$999',
		},
		phase: 'mount',
		outcome: 'fail',
		observed: '$20',
	});
});

test('excludes focus and non-mount expectations before evaluation', () => {
	const results = evaluate([
		{ kind: 'focus', phase: 'mount', selector: '[data-seat-count]' },
		{ kind: 'dom-text', phase: 'action:0:after', selector: '[data-price-total]', text: '$20' },
	]);

	assert.deepEqual(results, []);
});
