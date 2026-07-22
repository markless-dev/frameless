import { readFileSync } from 'node:fs';
import { resolve } from 'pathe';
import { parseModule } from '@tsrx/core';
import { describe, expect, test } from 'vitest';
import * as core from '@frameless.md/core';

/**
 * Runtime twin of `src/surface-contract.ts`: derives the compiler's recognized
 * importable authoring constructs from the compiler's own source (structurally,
 * not by regex) and fails closed if the compiler grows a construct this package
 * does not export — same spirit as the framework gates.
 */

const repoRoot = resolve(import.meta.dirname, '../../..');
const compilerSrcDir = resolve(repoRoot, 'packages/compiler/src');

type AstNode = { readonly type: string; [key: string]: unknown };

const isAstNode = (value: unknown): value is AstNode =>
	typeof value === 'object' && value !== null && typeof (value as AstNode).type === 'string';

const walkAst = (node: unknown, visit: (node: AstNode) => void): void => {
	if (Array.isArray(node)) {
		for (const entry of node) walkAst(entry, visit);
		return;
	}
	if (!isAstNode(node)) return;
	visit(node);
	for (const [key, value] of Object.entries(node)) {
		if (key === 'parent' || key === 'metadata' || key === 'loc') continue;
		walkAst(value, visit);
	}
};

const parseCompilerSource = (file: string) =>
	parseModule(readFileSync(resolve(compilerSrcDir, file), 'utf8'), file);

/** Members of the compiler's `GraphBindingKind` union, read from its schema AST. */
const graphBindingKinds = (): string[] => {
	const members: string[] = [];
	walkAst(parseCompilerSource('schema.ts'), (node) => {
		if (node.type !== 'TSTypeAliasDeclaration') return;
		if (!isAstNode(node.id) || node.id.name !== 'GraphBindingKind') return;
		walkAst(node.typeAnnotation, (member) => {
			if (member.type === 'Literal' && typeof member.value === 'string') {
				members.push(member.value);
			}
		});
	});
	return members;
};

/** True when the subtree compares against an import specifier's `imported` name. */
const referencesImportedSpecifierName = (node: unknown): boolean => {
	let found = false;
	walkAst(node, (candidate) => {
		if (isAstNode(candidate.property) && candidate.property.name === 'imported') found = true;
	});
	return found;
};

/**
 * Constructs the compiler recognizes by comparing an imported specifier name to
 * a string literal (today: `shared`, matched against the `@markless/core`
 * import in `findSharedFactoryDeclarators`).
 */
const importRecognizedConstructs = (): string[] => {
	const names = new Set<string>();
	walkAst(parseCompilerSource('build.ts'), (node) => {
		if (node.type !== 'BinaryExpression' || node.operator !== '===') return;
		for (const [side, other] of [
			[node.left, node.right],
			[node.right, node.left],
		]) {
			if (!isAstNode(side) || side.type !== 'Literal' || typeof side.value !== 'string') {
				continue;
			}
			if (referencesImportedSpecifierName(other)) names.add(side.value);
		}
	});
	return [...names];
};

describe('T002 @frameless.md/core authoring surface', () => {
	test('the README hero specifier resolves from a consumer context', () => {
		expect(typeof core.state).toBe('function');
		const readme = readFileSync(resolve(repoRoot, 'README.md'), 'utf8');
		expect(readme).toContain("import { state } from '@frameless.md/core';");
	});

	test('export surface exactly matches the compiler-recognized authoring constructs', () => {
		const kinds = graphBindingKinds();
		// Sanity: the derivation found the union, and `prop` (authored through
		// props destructuring, never an importable call) is still the only
		// deliberate exclusion.
		expect(kinds).toContain('prop');
		expect(kinds.length).toBeGreaterThanOrEqual(4);
		const importable = kinds.filter((kind) => kind !== 'prop');

		const viaImportSpecifier = importRecognizedConstructs();
		expect(viaImportSpecifier).toContain('shared');

		const recognized = [...new Set([...importable, ...viaImportSpecifier])].sort();

		// Non-construct exports must be allow-listed here or the test fails.
		const nonConstructExports = new Set(['FrameworkApiRuntimeError']);
		const exportedConstructs = Object.keys(core)
			.filter((name) => !nonConstructExports.has(name))
			.sort();

		expect(exportedConstructs).toEqual(recognized);
		for (const name of recognized) {
			expect(typeof core[name as keyof typeof core]).toBe('function');
		}
	});

	test('constructs are compile-time markers: calling one at runtime throws the canonical diagnostic', () => {
		expect(() => core.state(0)).toThrowError(core.FrameworkApiRuntimeError);
		expect(() => core.state(0)).toThrowError(/compiled from a \.tsrx file/);
		expect(() => core.element()).toThrowError(core.FrameworkApiRuntimeError);
	});
});
