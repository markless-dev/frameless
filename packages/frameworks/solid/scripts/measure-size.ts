import { readFile } from 'node:fs/promises';
import { resolve } from 'pathe';
import { parse, walk, type Node } from 'yuku-parser';

const root = resolve(import.meta.dirname, '..');
const pairs = [
	{ scenario: 'S1', referenceName: 'SolidS1', emittedName: 'RenderOnce', emitted: 'S1.jsx' },
	{ scenario: 'S2', referenceName: 'SolidS2', emittedName: 'KeyedTodo', emitted: 'S2.jsx' },
	{ scenario: 'S3', referenceName: 'SolidS3', emittedName: 'EventForm', emitted: 'S3.jsx' },
] as const;

function findFunction(program: Node, name: string): Node | null {
	let found: Node | null = null;
	const match = (node: Node, context: { stop(): void }) => {
		if ('id' in node && node.id?.type === 'Identifier' && node.id.name === name) {
			found = node;
			context.stop();
		}
	};
	walk(program, { FunctionDeclaration: match, FunctionExpression: match });
	return found;
}

function structuralNodes(node: Node): number {
	let count = 0;
	walk(node, {
		enter() {
			count += 1;
		},
	});
	return count;
}

async function measure(file: string, name: string, typescript: boolean) {
	const source = await readFile(file, 'utf8');
	const parsed = parse(source, {
		sourceType: 'module',
		lang: typescript ? 'tsx' : 'jsx',
	});
	if (parsed.diagnostics.length)
		throw new Error(parsed.diagnostics.map((entry) => entry.message).join('; '));
	const component = findFunction(parsed.program, name);
	if (!component || component.start == null || component.end == null)
		throw new Error(`Expected function ${name} in ${file}`);
	return {
		physicalLoc: source
			.slice(component.start, component.end)
			.split(/\r?\n/)
			.filter((line) => line.trim()).length,
		// Reference and emitted bodies use the same parser, keeping their comparison honest.
		structuralNodes: structuralNodes(component),
	};
}

export async function measureAll() {
	return Promise.all(
		pairs.map(async ({ scenario, referenceName, emittedName, emitted }) => ({
			scenario,
			reference: await measure(
				resolve(root, 'test/reference.solid.tsx'),
				referenceName,
				true,
			),
			emitted: await measure(resolve(root, 'generated', emitted), emittedName, false),
		})),
	);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename))
	process.stdout.write(`${JSON.stringify(await measureAll(), null, 2)}\n`);
