import { computed, state } from '@markless/core';

// P9 - OPTIMISTIC WRITE-THEN-REVERT WITHOUT THE CALLBACK-PROP CONFOUND. Same
// question as P6 - board question (c) - in S8's promise-valued-prop shape, so
// Qwik is measured on async rather than on its callback-prop rule (see P7).
//
// The revert arm is a CONDITIONAL EXPRESSION in every case, never an `if`:
// DEFECTS.md 8.1 records that React lowers only top-level handler statements, so
// a write nested in an `if` is emitted against the `const` destructuring
// `useState` - invalid TypeScript, and NEITHER LOWERED NOR REFUSED. `saved`
// carries the server's answer, so both arms of the revert are exercised by the
// same authored bytes.
export function P9PromisePropOptimistic({ saved }: {
	saved: Promise<boolean>;
}) @{
	let rows = state([
		{ id: 'r1', title: 'first', pending: false },
	]);
	let title = state('first');
	let inflight = state(false);
	let reverted = state(false);

	const settled = computed(() => rows.filter((row) => !row.pending).length);

	<section data-probe="p9">
		<p data-async="title">{title}</p>
		<p data-async="settled">{settled}</p>
		<p data-async="reverted">{reverted}</p>
		<ul>
			@for (const row of rows; key row.id) {
				<li data-row={row.id}>{row.title}</li>
			}
		</ul>
		<button
			type="button"
			data-action="rename"
			disabled={inflight}
			onClick={async (event) => {
				const previousTitle = title;
				const previousRows = rows;
				title = 'optimistic';
				rows = rows.map((row) => ({ id: row.id, title: 'optimistic', pending: true }));
				inflight = true;
				const ok = await saved;
				title = ok ? title : previousTitle;
				rows = ok
					? rows.map((row) => ({ id: row.id, title: row.title, pending: false }))
					: previousRows;
				reverted = ok ? reverted : true;
				inflight = false;
			}}
		>rename</button>
	</section>
}
