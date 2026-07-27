import { generate } from 'yuku-codegen';
import type { SerializableAstNode } from '@frameless/compiler';

/**
 * Untyped ESTree node bags. The Vue emitter builds output ASTs from the IR's own
 * `SerializableAstNode`s, which carry an open `[key: string]` shape, so a
 * structural type here would be fiction. Same choice as the Qwik, Solid and
 * Svelte emitters.
 */
export type Node = Record<string, any>;
export type Expression = Node;
export type Statement = Node;

/**
 * yuku-codegen indents with SPACES; this repository indents with TABS and no
 * formatter may be run over a `.vue` file (T003 stop_if - `prettier`,
 * `prettier-plugin-vue` and `oxfmt` are all out of scope here, and nothing in
 * this workspace parses `.vue` at all). One space per level is generated and
 * converted 1:1 into tabs by `toTabs` below, which is exact rather than a
 * heuristic: a single leading space can only be generated indentation.
 */
const GENERATE_OPTIONS = { comments: true, quotes: 'single', indent: 1 } as const;

export function identifier(name: string): Node {
	return { type: 'Identifier', name };
}

export function literal(value: string | number | boolean | null): Node {
	return {
		type: 'Literal',
		value,
		raw: typeof value === 'string' ? JSON.stringify(value) : String(value),
	};
}

export function call(callee: Expression, args: Expression[]): Expression {
	return { type: 'CallExpression', callee, arguments: args, optional: false };
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

export function arrow(
	params: Node[],
	body: Expression | Statement,
	options: { readonly async?: boolean } = {},
): Expression {
	return {
		type: 'ArrowFunctionExpression',
		id: null,
		params,
		body,
		generator: false,
		async: options.async ?? false,
		expression: body.type !== 'BlockStatement',
	};
}

export function expressionStatement(expression: Expression): Statement {
	return { type: 'ExpressionStatement', expression };
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

export function importDeclaration(names: readonly string[], source: string): Statement {
	return {
		type: 'ImportDeclaration',
		specifiers: names.map((name) => ({
			type: 'ImportSpecifier',
			imported: identifier(name),
			local: identifier(name),
		})),
		source: { type: 'Literal', value: source, raw: `'${source}'` },
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

export function containsIdentifierFrom(value: unknown, names: ReadonlySet<string>): boolean {
	let found = false;
	walk(value, (record) => {
		if (record.type === 'Identifier' && names.has(record.name as string)) found = true;
	});
	return found;
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
			throw new Error('Vue emitter cannot indent a template literal that spans a line break');
		if (
			record.type === 'Literal' &&
			typeof record.value === 'string' &&
			String(record.raw ?? '').includes('\n')
		)
			throw new Error('Vue emitter cannot indent a string literal that spans a line break');
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

const EXPRESSION_PROBE = '__frameless_vue_expression__';

/**
 * Print one expression with no statement punctuation.
 *
 * Generated through a declarator rather than an expression statement so an arrow
 * function is never parenthesised and never picks up a trailing `;`. The fixed
 * prefix/suffix are asserted before they are stripped, so a codegen change
 * surfaces as a throw instead of a silently truncated handler.
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
			`Vue emitter could not isolate a printed expression from ${JSON.stringify(printed.slice(0, 60))}`,
		);
	return printed.slice(prefix.length, -1);
}

/** Re-indent a printed multi-line fragment under `indent`, leaving line 1 alone. */
export function indentContinuation(text: string, indent: string): string {
	return text
		.split('\n')
		.map((line, index) => (index === 0 || line === '' ? line : indent + line))
		.join('\n');
}
