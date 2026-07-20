import { state } from '@markless/core';

export function NewsletterForm({ initialName, initialEmail, onTrace }) @{
	let name = state(initialName);
	let email = state(initialEmail);
	let productUpdates = state(false);
	let submitStatus = state('idle');

	<form data-component="newsletter-form">
		<label>
			Name
			<input
				data-field="subscriber-name"
				value={name}
				onInput={(event) => {
					name = event.currentTarget.value;
					onTrace('name-changed', { value: event.currentTarget.value }, event);
				}}
			/>
		</label>
		<label>
			Email
			<input
				data-field="subscriber-email"
				value={email}
				onInput={(event) => {
					email = event.currentTarget.value;
					onTrace('email-changed', { value: event.currentTarget.value }, event);
				}}
			/>
		</label>
		<label>
			<input
				type="checkbox"
				data-field="product-updates"
				checked={productUpdates}
				onChange={(event) => {
					productUpdates = event.currentTarget.checked;
					onTrace('preference-changed', { checked: event.currentTarget.checked }, event);
				}}
			/>
			Send product updates
		</label>
		<button
			type="button"
			data-action="subscribe"
			onClick={(event) => {
				submitStatus = 'submitting';
				submitStatus = 'subscribed';
				onTrace('newsletter-submitted', { name, email, productUpdates, status: submitStatus }, event);
			}}
		>Subscribe</button>
		<output data-submit-status="">{submitStatus}</output>
	</form>
}
