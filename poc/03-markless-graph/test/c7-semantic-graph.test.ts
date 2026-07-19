// C7 (structural): markless 0.1.1's SemanticGraphArtifact captures, as typed
// records rather than strings, the semantics Mitosis's string IR loses:
// path-level state reads/writes, computed dependencies, branch sites, keyed
// repeats, event handler metadata, and destructuring aliases — asserted by
// id-level cross-reference (state -> computed -> template-read chain), not
// string matching. The honest caveat is asserted too: expression-level fields
// (functionSource, handlerSources, valueSource, testSource) remain source
// strings inside those typed records.
import { readFileSync } from 'node:fs';
import { beforeAll, expect, test } from 'vitest';
import {
	collectTsrxModuleDiagnostics,
	compileTsrxModule,
	type CompileTsrxModuleResult,
} from '@markless/compiler';

const FIXTURE = 'src/TodoApp.tsrx';
const source = readFileSync(new URL('../fixtures/todo-list.tsrx', import.meta.url), 'utf8');

let result: CompileTsrxModuleResult;

beforeAll(async () => {
	result = await compileTsrxModule({
		filename: FIXTURE,
		source,
		symbols: [],
		buildId: 'poc03',
		resolverId: 'poc03',
	});
});

function binding(name: string) {
	const found = result.semanticGraph.graphBindings.find((entry) => entry.name === name);
	if (!found) throw new Error(`Expected graph binding named "${name}".`);
	return found;
}

test('the todo fixture compiles with zero diagnostics', () => {
	expect(collectTsrxModuleDiagnostics(result)).toEqual([]);
});

test('state bindings are typed records with distinct ids and value kinds', () => {
	const todos = binding('todos');
	const settings = binding('settings');
	const draft = binding('draft');

	expect(todos).toMatchObject({ kind: 'state', writable: true, valueKind: 'array' });
	expect(settings).toMatchObject({ kind: 'state', writable: true, valueKind: 'object' });
	expect(draft).toMatchObject({ kind: 'state', writable: true, valueKind: 'scalar' });
	expect(new Set([todos.id, settings.id, draft.id]).size).toBe(3);
});

test('state reads and writes are lowered to graph-node ids with property paths', () => {
	const todos = binding('todos');
	const settings = binding('settings');
	const draft = binding('draft');
	const { reads, writes } = result.stateLowering;

	// Path-level read: settings.title is a record {graphNodeId, path: ['title']},
	// not a rewritten string.
	expect(reads).toContainEqual(
		expect.objectContaining({ graphNodeId: settings.id, path: ['title'] }),
	);

	// Writes carry the operation as data: a whole-cell assign on draft, an
	// in-place array method call on todos (push, with argument sources), and a
	// whole-cell assign on todos from the toggle handler.
	expect(writes).toContainEqual(
		expect.objectContaining({ graphNodeId: draft.id, path: [], operation: 'assign' }),
	);
	const push = writes.find(
		(write) => write.graphNodeId === todos.id && write.operation === 'call',
	);
	expect(push).toMatchObject({ method: 'push', path: [] });
	expect(push?.argumentSources?.length).toBe(1);
	expect(writes).toContainEqual(
		expect.objectContaining({ graphNodeId: todos.id, path: [], operation: 'assign' }),
	);
});

test('the computed binding depends on the state binding by id, and a DOM text write targets the computed by id (state -> computed -> template chain)', () => {
	const todos = binding('todos');
	const remaining = binding('remaining');

	expect(remaining.kind).toBe('computed');
	expect(remaining.writable).toBe(false);

	// Link 1 (state -> computed): the computed's dependency records reference
	// the state binding's id.
	const dependencyIds = (remaining.dependencies ?? []).map((dep) => dep.graphNodeId);
	expect(dependencyIds).toContain(todos.id);

	// Link 2 (computed -> template read): the planned DOM update record
	// references the computed's id and a host node id that resolves to a real
	// host record.
	const domUpdate = result.payloadArena.view.domUpdates.find(
		(update) => update.graphNodeId === remaining.id,
	);
	if (!domUpdate) throw new Error('Expected a DOM update record for the computed binding.');
	expect(domUpdate.target).toEqual({ kind: 'text' });
	const host = result.semanticGraph.hostNodes.find((node) => node.id === domUpdate.hostNodeId);
	expect(host?.tagName).toBe('output');
});

test('the @if is a branch-site record and the keyed @for is a keyed-repeat record referencing the collection by id', () => {
	const todos = binding('todos');

	expect(result.semanticGraph.branchSites).toEqual([
		expect.objectContaining({ kind: 'if', armCount: 1 }),
	]);

	const [repeat] = result.semanticGraph.keyedRepeats;
	expect(repeat).toMatchObject({
		itemName: 'todo',
		collectionGraphNodeId: todos.id,
		collectionPath: [],
		keyPath: ['id'],
	});
	// The repeat's parent and row hosts resolve by id to real host records.
	const parent = result.semanticGraph.hostNodes.find((node) => node.id === repeat!.parentHostNodeId);
	const row = result.semanticGraph.hostNodes.find((node) => node.id === repeat!.rowHostNodeId);
	expect(parent?.tagName).toBe('ul');
	expect(row?.tagName).toBe('li');
});

test('events are records with handler metadata whose host ids resolve to real host nodes', () => {
	const events = result.semanticGraph.events;
	expect(events).toHaveLength(3);

	for (const event of events) {
		const host = result.semanticGraph.hostNodes.find((node) => node.id === event.hostNodeId);
		expect(host).toBeDefined();
		expect(event.handlerCount).toBe(1);
		expect(event.handlerSpans[0]).toMatchObject({ filename: FIXTURE });
	}

	const input = events.find((event) => event.eventName === 'input');
	expect(input?.handlerParameters).toEqual([['event']]);
	const inputHost = result.semanticGraph.hostNodes.find((node) => node.id === input?.hostNodeId);
	expect(inputHost?.tagName).toBe('input');

	const clicks = events.filter((event) => event.eventName === 'click');
	expect(clicks).toHaveLength(2);
	for (const click of clicks) {
		const host = result.semanticGraph.hostNodes.find((node) => node.id === click.hostNodeId);
		expect(host?.tagName).toBe('button');
	}
});

test('destructuring produces an alias record with a graph path target', () => {
	expect(result.semanticGraph.aliases).toEqual([
		expect.objectContaining({
			name: 'boardTitle',
			target: 'settings.title',
			declarationKind: 'const',
		}),
	]);
});

test('honest caveat: expression-level fields inside the typed records remain source strings', () => {
	const remaining = binding('remaining');
	expect(typeof remaining.functionSource).toBe('string');

	for (const event of result.semanticGraph.events) {
		for (const handlerSource of event.handlerSources) {
			expect(typeof handlerSource).toBe('string');
		}
	}

	const [branch] = result.semanticGraph.branchSites;
	expect(typeof branch!.testSource).toBe('string');

	const assignWrites = result.stateLowering.writes.filter(
		(write) => write.operation === 'assign',
	);
	expect(assignWrites.length).toBeGreaterThan(0);
	for (const write of assignWrites) {
		expect(typeof write.valueSource).toBe('string');
	}
});
