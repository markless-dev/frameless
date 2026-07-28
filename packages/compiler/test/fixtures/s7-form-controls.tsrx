import { computed, state } from '@markless/core';

export function FormBoard({ seed, onTrace }) @{
	let size = state('s');
	let notes = state('draft');
	let pick = state('r1');
	let lock = state(null);
	let rows = state(seed.map((row) => ({ ...row })));
	const chosen = computed(
		() =>
			rows
				.filter((row) => row.on)
				.map((row) => row.id)
				.join('+') || 'none',
	);
	const onFirst = computed(() => pick === 'r1');
	const onSecond = computed(() => pick === 'r2');
	const locked = computed(() => lock !== null);
	const guard = computed(() => (lock === null ? null : 'true'));

	<form data-scenario="s7">
		<select
			data-control="size"
			data-size={size}
			value={size}
			onChange={(event) => {
				const next = event.currentTarget.value;
				size = next;
				onTrace('size', { size: next }, event);
			}}
		>
			<option value="s">small</option>
			<option value="m">medium</option>
			<option value="l">large</option>
		</select>
		<textarea
			data-control="notes"
			data-notes={notes}
			value={notes}
			onInput={(event) => {
				const next = event.currentTarget.value;
				notes = next;
				onTrace('notes', { notes: next }, event);
			}}
		/>
		<input
			type="radio"
			name="s7pick"
			data-pick="r1"
			checked={onFirst}
			onChange={(event) => {
				pick = 'r1';
				onTrace('pick', { pick: 'r1' }, event);
			}}
		/>
		<input
			type="radio"
			name="s7pick"
			data-pick="r2"
			checked={onSecond}
			onChange={(event) => {
				pick = 'r2';
				onTrace('pick', { pick: 'r2' }, event);
			}}
		/>
		<p data-picked="true">{pick}</p>
		<p data-chosen="true">{chosen}</p>
		<ul data-tags="true">
			@for (const row of rows; key row.id) {
				<li data-oracle-form-key={row.id}>
					<input
						type="checkbox"
						data-tag={row.id}
						checked={row.on}
						onChange={(event) => {
							const next = rows.map((entry) =>
								entry.id === row.id ? { id: entry.id, on: !entry.on } : entry,
							);
							rows = next;
							onTrace('tag', { id: row.id }, event);
						}}
					/>
				</li>
			}
		</ul>
		<button
			type="button"
			data-action="resize"
			onClick={(event) => {
				size = 'l';
				notes = 'final';
				onTrace('resize', { size: 'l', notes: 'final' }, event);
			}}
		>resize</button>
		<button
			type="button"
			data-action="lock"
			data-lock={lock}
			onClick={(event) => {
				const next = lock === null ? 'on' : null;
				lock = next;
				onTrace('lock', { lock: next }, event);
			}}
		>lock</button>
		<button type="button" data-guard="true" disabled={locked} aria-disabled={guard}>guard</button>
	</form>
}
