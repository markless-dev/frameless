import { computed, state } from '@markless/core';

export function PricingCard({ planName, basePrice, multiplier, visible, onTrace }) @{
	let seats = state(1);
	const formattedTotal = computed(() => `$${basePrice * multiplier * seats}`);

	<article data-component="pricing-card">
		@if (!visible) {
			<p data-pricing-state="hidden">Pricing is unavailable.</p>
		} @else {
			<section data-pricing-state="visible">
				<h2>{planName}</h2>
				<p><span data-seat-count="">{seats}</span> seats</p>
				<output data-price-total="">{formattedTotal}</output>
				<button
					data-action="add-seat"
					onClick={() => {
						seats++;
						onTrace('seat-added', { seats });
					}}
				>Add seat</button>
			</section>
		}
	</article>
}
