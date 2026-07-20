import { readFile } from 'node:fs/promises';
import { parse } from '@babel/parser';
import * as t from '@babel/types';
import { resolve } from 'pathe';

const root = resolve(import.meta.dirname, '..');
const pairs = [
	{ scenario: 'S1', referenceName: 'ReactS1', emittedName: 'RenderOnce', emitted: 'S1.jsx' },
	{ scenario: 'S2', referenceName: 'ReactS2', emittedName: 'KeyedTodo', emitted: 'S2.jsx' },
	{ scenario: 'S3', referenceName: 'ReactS3', emittedName: 'EventForm', emitted: 'S3.jsx' },
] as const;

function findFunction(value: unknown, name: string): t.FunctionDeclaration | t.FunctionExpression | null {
	if (!value || typeof value !== 'object') return null;
	const node = value as t.Node;
	if ((t.isFunctionDeclaration(node) || t.isFunctionExpression(node)) && node.id?.name === name) {
		return node;
	}
	for (const [key, child] of Object.entries(value)) {
		if (['loc', 'start', 'end'].includes(key)) continue;
		if (Array.isArray(child)) {
			for (const entry of child) {
				const found = findFunction(entry, name);
				if (found) return found;
			}
		} else {
			const found = findFunction(child, name);
			if (found) return found;
		}
	}
	return null;
}

function structuralNodes(value: unknown): number {
	if (!value || typeof value !== 'object') return 0;
	const record = value as Record<string, unknown>;
	const own = typeof record.type === 'string' ? 1 : 0;
	return (
		own +
		Object.entries(record).reduce((count, [key, child]) => {
			if (['loc', 'start', 'end', 'leadingComments', 'trailingComments', 'innerComments'].includes(key)) {
				return count;
			}
			if (Array.isArray(child)) {
				return count + child.reduce((sum, entry) => sum + structuralNodes(entry), 0);
			}
			return count + structuralNodes(child);
		}, 0)
	);
}

async function measure(file: string, name: string, typescript: boolean) {
	const source = await readFile(file, 'utf8');
	const ast = parse(source, {
		sourceType: 'module',
		plugins: typescript ? ['jsx', 'typescript'] : ['jsx'],
	});
	const component = findFunction(ast, name);
	if (!component || component.start == null || component.end == null) {
		throw new Error(`Expected function ${name} in ${file}`);
	}
	return {
		physicalLoc: source
			.slice(component.start, component.end)
			.split(/\r?\n/)
			.filter((line) => line.trim()).length,
		structuralNodes: structuralNodes(component),
	};
}

export async function measureAll() {
	return Promise.all(
		pairs.map(async ({ scenario, referenceName, emittedName, emitted }) => ({
			scenario,
			reference: await measure(resolve(root, 'test/reference.tsx'), referenceName, true),
			emitted: await measure(resolve(root, 'generated', emitted), emittedName, false),
		})),
	);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
	process.stdout.write(`${JSON.stringify(await measureAll(), null, 2)}\n`);
}
