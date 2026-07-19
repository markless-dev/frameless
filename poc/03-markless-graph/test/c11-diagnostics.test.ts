// C11 (diagnostics): for genuinely unsupported .tsrx shapes, the markless
// 0.1.1 compiler emits actionable compile-time diagnostics — a file, a span
// that points at the offending source text, a human message, and suggestions —
// instead of silently dropping code. This is the direct contrast to C1, where
// Mitosis 0.13.2 silently discards component-body code with no warning
// (proven in poc/01-mitosis-static).
import { expect, test } from 'vitest';
import { buildSemanticGraph, type CompilerDiagnostic } from '@markless/compiler';

// Shape 1: spreading an object of event handlers onto an element.
const eventSpreadSource = `import { state } from '@markless/core';

export function App() @{
	let count = state(0);
	const handlers = { onClick: () => count++ };

	<section>
		<button {...handlers}>{count}</button>
	</section>
}
`;

// Shape 2: object-valued style attribute (React-style style objects).
const styleObjectSource = `import { state } from '@markless/core';

export function App() @{
	let count = state(0);

	<section>
		<div style={{ color: 'red' }}>styled</div>
		<button onClick={() => count++}>{count}</button>
	</section>
}
`;

// Shape 3: keyed-repeat construct without a key.
const unkeyedRepeatSource = `import { state } from '@markless/core';

export function App() @{
	const rows = state([{ id: 'a' }]);

	<ul>
		@for (const row of rows) {
			<li>{row.id}</li>
		}
	</ul>
}
`;

function expectActionable(
	diagnostic: CompilerDiagnostic | undefined,
	filename: string,
	source: string,
	offendingText: string,
): asserts diagnostic is CompilerDiagnostic {
	if (!diagnostic) throw new Error('Expected a diagnostic for the unsupported shape.');
	expect(diagnostic.severity).toBe('error');

	// Actionable message: human-readable prose, not an opaque code.
	expect(typeof diagnostic.message).toBe('string');
	expect(diagnostic.message.length).toBeGreaterThan(20);
	expect(typeof diagnostic.why).toBe('string');
	expect(diagnostic.suggestions.length).toBeGreaterThan(0);
	expect(diagnostic.docsUrl).toContain(diagnostic.code);

	// Actionable location: the span names the file and points at the actual
	// offending source text.
	const span = diagnostic.primarySpan;
	if (!span) throw new Error(`Expected a primarySpan on ${diagnostic.code}.`);
	expect(span.filename).toBe(filename);
	expect(span.start).toBeLessThan(span.end);
	expect(source.slice(span.start, span.end)).toContain(offendingText);
}

test('event spread produces an actionable error instead of a silent drop', async () => {
	const graph = await buildSemanticGraph({ filename: 'src/EventSpread.tsrx', source: eventSpreadSource });
	const diagnostic = graph.diagnostics.find(
		(entry) => entry.code === 'MARKLESS_EVENT_SPREAD_UNSUPPORTED',
	);
	expectActionable(diagnostic, 'src/EventSpread.tsrx', eventSpreadSource, 'handlers');
	expect(diagnostic.message).toContain('onClick');
});

test('an object-valued style attribute produces an actionable error instead of a silent drop', async () => {
	const graph = await buildSemanticGraph({ filename: 'src/StyleObject.tsrx', source: styleObjectSource });
	const diagnostic = graph.diagnostics.find(
		(entry) => entry.code === 'MARKLESS_STYLE_OBJECT_UNSUPPORTED',
	);
	expectActionable(diagnostic, 'src/StyleObject.tsrx', styleObjectSource, 'color');
});

test('an unkeyed @for produces an actionable error instead of a silent drop', async () => {
	const graph = await buildSemanticGraph({ filename: 'src/UnkeyedRepeat.tsrx', source: unkeyedRepeatSource });
	const diagnostic = graph.diagnostics.find(
		(entry) => entry.code === 'MARKLESS_REPEAT_KEY_REQUIRED',
	);
	expectActionable(diagnostic, 'src/UnkeyedRepeat.tsrx', unkeyedRepeatSource, 'row');
});

test('contrast with C1: the supported C1-mirror shape compiles with zero diagnostics', async () => {
	const graph = await buildSemanticGraph({
		filename: 'src/LocalDeclaration.tsrx',
		source: `import { state } from '@markless/core';

export function App() @{
	let count = state(1);
	const greeting = \`Hello, \${'markless'.toUpperCase()}!\`;

	<main>
		<p>{greeting}</p>
		<button onClick={() => count++}>{count}</button>
	</main>
}
`,
	});
	expect(graph.diagnostics).toEqual([]);
});
