import { computed, state } from '@markless/core';

// P6 - OPTIMISTIC WRITE-THEN-REVERT, board question (c), and the axis Patrick
// named explicitly for TodoMVC ("AND OPTIMISTIC UPDATES").
//
// The shape: capture the previous value, write the optimistic one, `await` the
// server, then keep it or put the previous one back. The revert is a CONDITIONAL
// EXPRESSION, never an `if` - DEFECTS.md 8.1, where React miscompiles a state
// write nested in an `if` and entry 8's own shipped refusal has a hole exactly
// that shape, so it is NEITHER LOWERED NOR REFUSED. Writing `title = ok ? title
// : previous` keeps every write top-level and unconditional; the no-op arm
// writes the cell back to itself, which React's `useState` bail-out already
// understands because the reference is unchanged (s10 constraint 5).
//
// `rows` is also mutated optimistically so the probe covers the ARRAY case a
// todo list is made of, not just a scalar.
export function P6Optimistic({ save }: {
	save: (title: string) => Promise<boolean>;
}) @{
	let rows = state([
		{ id: 'r1', title: 'first', saved: true },
	]);
	let title = state('first');
	let inflight = state(false);
	let reverted = state(false);

	const count = computed(() => rows.filter((row) => row.saved).length);

	<section data-probe="p6">
		<p data-async="title">{title}</p>
		<p data-async="count">{count}</p>
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
				const previous = title;
				const previousRows = rows;
				title = 'optimistic';
				rows = rows.map((row) => ({ id: row.id, title: 'optimistic', saved: false }));
				inflight = true;
				const ok = await save('optimistic');
				title = ok ? title : previous;
				rows = ok ? rows.map((row) => ({ id: row.id, title: row.title, saved: true })) : previousRows;
				reverted = ok ? reverted : true;
				inflight = false;
			}}
		>rename</button>
	</section>
}
