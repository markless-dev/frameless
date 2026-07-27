import { state } from '@markless/core';

export function EventForm({ initial, onTrace }) @{
	let text = state(initial);
	let checked = state(false);
	let writes = state(0);

	<form
		data-scenario="s3"
		onClick={(event) => {
			if (event.target.dataset.action === 'submit') {
				onTrace('bubble', { source: 'form' }, event);
			}
		}}
	>
		<input
			data-action="text"
			value={text}
			onInput={(event) => {
				text = event.currentTarget.value;
				onTrace('text', { value: event.currentTarget.value }, event);
			}}
		/>
		<input
			type="checkbox"
			data-action="checked"
			checked={checked}
			onChange={(event) => {
				checked = event.currentTarget.checked;
				onTrace('checked', { checked: event.currentTarget.checked }, event);
			}}
		/>
		<button
			type="button"
			data-action="submit"
			onClick={(event) => {
				event.preventDefault();
				writes = 1;
				writes = 2;
				onTrace('submit', { text, checked, writes: 2 }, event);
			}}
		>submit</button>
		<button
			type="submit"
			data-action="cancel-submit"
			onClick={(event) => {
				event.preventDefault();
			}}
		>cancel-submit</button>
		<output data-writes="true">{writes}</output>
		<span data-callback-marker="present" />
		<details data-cancel="guarded">
			<summary
				data-action="cancel-open"
				onClick={(event) => {
					if (event.detail === 1) {
						event.preventDefault();
					}
				}}
			>cancel-open</summary>
		</details>
		<details data-cancel="unguarded">
			<summary
				data-action="allow-open"
				onClick={(event) => {
					if (event.detail === 2) {
						event.preventDefault();
					}
				}}
			>allow-open</summary>
		</details>
	</form>
}
