import { describe, expect, test } from 'vitest';
import { buildTemplateNode } from '../src/build.ts';

describe('template exhaustiveness', () => {
	test('fails closed with the unknown construct name', () => {
		expect(() =>
			buildTemplateNode(
				{ type: 'FutureTemplateConstruct' } as never,
				{} as never,
				{} as never,
			),
		).toThrow(
			'Unsupported template construct FutureTemplateConstruct cannot be represented in frameless-enriched-ir/2.',
		);
	});
});
