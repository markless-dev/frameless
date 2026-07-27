import { generate } from 'yuku-codegen';
import type { SerializableAstNode } from '@frameless/compiler';

/**
 * Untyped ESTree node bags. The Angular emitter builds output ASTs from the IR's
 * own `SerializableAstNode`s, which carry an open `[key: string]` shape, so a
 * structural type here would be fiction. Same choice as the Qwik, Solid, Svelte
 * and Vue emitters.
 */
export type Node = Record<string, any>;
export type Expression = Node;
export type Statement = Node;

/**
 * yuku-codegen indents with SPACES; this repository indents with TABS and this
 * lane cannot run the repository formatter over its output - `oxfmt` is a
 * dependency of the react/solid/qwik packages and is NOT resolvable from
 * `packages/frameworks/angular`, and adding it would move `pnpm-lock.yaml`,
 * which is a T003 stop_if. One space per level is generated and converted 1:1
 * into tabs by `toTabs` below, which is exact rather than a heuristic: a single
 * leading space can only be generated indentation.
 */
const GENERATE_OPTIONS = { comments: true, quotes: 'single', indent: 1 } as const;

export function identifier(name: string): Node {
	return { type: 'Identifier', name };
}

export function thisExpression(): Expression {
	return { type: 'ThisExpression' };
}

export function member(object: Expression, property: string): Expression {
	return {
		type: 'MemberExpression',
		object,
		property: identifier(property),
		computed: false,
		optional: false,
	};
}

export function expressionStatement(expression: Expression): Statement {
	return { type: 'ExpressionStatement', expression };
}

export function assign(left: Expression, right: Expression): Statement {
	return expressionStatement({ type: 'AssignmentExpression', operator: '=', left, right });
}

export function returnStatement(argument: Expression): Statement {
	return { type: 'ReturnStatement', argument };
}

export function variable(
	kind: 'const' | 'let' | 'var',
	id: Node,
	init: Expression | null,
): Statement {
	return {
		type: 'VariableDeclaration',
		kind,
		declarations: [{ type: 'VariableDeclarator', id, init }],
	};
}

/** Depth-first visit over every object in a JSON-ish tree. */
export function walk(value: unknown, visit: (record: Record<string, any>) => void): void {
	if (!value || typeof value !== 'object') return;
	visit(value as Record<string, any>);
	for (const child of Object.values(value)) {
		if (Array.isArray(child)) child.forEach((entry) => walk(entry, visit));
		else walk(child, visit);
	}
}

/** Clone an IR expression node, failing closed on anything that is not one. */
export function expression(node: SerializableAstNode | null | undefined): Expression {
	const cloned = node ? (structuredClone(node) as Node) : null;
	if (!cloned || typeof cloned.type !== 'string')
		throw new Error(`Expected an expression, received ${cloned?.type ?? 'null'}`);
	return cloned;
}

/**
 * PRECONDITION for `toTabs`, asserted rather than assumed (instrument rule 2).
 *
 * The space-to-tab conversion rewrites LEADING whitespace only, so it is exact
 * unless a string or template literal spans a line break - in which case a
 * continuation line's own leading spaces are payload, not indentation, and would
 * be silently corrupted. This walks the output AST and refuses instead.
 */
function assertNoMultilineLiterals(program: Node): void {
	walk(program, (record) => {
		if (record.type === 'TemplateElement' && String(record.value?.raw ?? '').includes('\n'))
			throw new Error(
				'Angular emitter cannot indent a template literal that spans a line break',
			);
		if (
			record.type === 'Literal' &&
			typeof record.value === 'string' &&
			String(record.raw ?? '').includes('\n')
		)
			throw new Error('Angular emitter cannot indent a string literal that spans a line break');
	});
}

function toTabs(code: string): string {
	return code
		.split('\n')
		.map((line) => {
			const leading = /^ */.exec(line)![0];
			if (!leading) return line;
			return '\t'.repeat(leading.length) + line.slice(leading.length);
		})
		.join('\n');
}

function print(program: Node): string {
	assertNoMultilineLiterals(program);
	const result = generate(program as any, GENERATE_OPTIONS);
	if (result.errors.length)
		throw new Error(
			`yuku-codegen failed: ${result.errors.map((error) => error.message).join('; ')}`,
		);
	return toTabs(result.code);
}

/** Print top-level statements, one per generate call, joined by single newlines. */
export function printStatements(statements: readonly Statement[]): string {
	return statements
		.map((statement) => print({ type: 'Program', sourceType: 'module', body: [statement] }))
		.join('\n');
}

const EXPRESSION_PROBE = '__frameless_angular_expression__';

/**
 * Print one expression with no statement punctuation.
 *
 * Generated through a declarator rather than an expression statement so an arrow
 * function is never parenthesised and never picks up a trailing `;`. The fixed
 * prefix/suffix are asserted before they are stripped, so a codegen change
 * surfaces as a throw instead of a silently truncated expression.
 */
export function printExpression(value: Expression): string {
	const prefix = `const ${EXPRESSION_PROBE} = `;
	const printed = print({
		type: 'Program',
		sourceType: 'module',
		body: [variable('const', identifier(EXPRESSION_PROBE), value)],
	});
	if (!printed.startsWith(prefix) || !printed.endsWith(';'))
		throw new Error(
			`Angular emitter could not isolate a printed expression from ${JSON.stringify(printed.slice(0, 60))}`,
		);
	return printed.slice(prefix.length, -1);
}

/** Indent every non-empty line of a printed block by `indent`. */
export function indentBlock(text: string, indent: string): string {
	return text
		.split('\n')
		.map((line) => (line === '' ? line : indent + line))
		.join('\n');
}

/** Re-indent a printed multi-line fragment under `indent`, leaving line 1 alone. */
export function indentContinuation(text: string, indent: string): string {
	return text
		.split('\n')
		.map((line, index) => (index === 0 || line === '' ? line : indent + line))
		.join('\n');
}
