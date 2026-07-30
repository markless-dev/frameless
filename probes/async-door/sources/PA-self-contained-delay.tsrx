import { state } from '@markless/core';

// PA - THE SHAPE AN APP WOULD ACTUALLY AUTHOR, and the last confound removed.
//
// P8 and P9 supply their async work as a promise-VALUED prop, which is S8's
// shape and the right control for isolating async from Qwik's callback-prop
// rule. But it leaves one thing unmeasured that matters to the queued apps: a
// promise handed IN as a prop is a value the SSR serializer sees, and the board
// records that Qwik's SSR serializer AWAITS promises, which is why S8's gate had
// to be click-armed.
//
// A real app does not receive a promise. It CREATES one when the user acts. This
// module does exactly that - `new Promise` with a `setTimeout`, which is the
// artificial delay the owner accepted as a stand-in for a real remote - so there
// is no async prop, nothing for a serializer to await at render time, and no
// callback prop. It is the narrowest authoring of "fetch on click, show a
// spinner, then show the result" that the surface allows.
//
// IT CARRIES A `label` PROP IT DOES NOT NEED. The first draft took no props at
// all, and Solid refused it with `ComponentProps has dangling graph record id:
// prop:props`. PB proves that refusal fires on a FULLY SYNCHRONOUS zero-prop
// component and is therefore not the door's - so the prop is here to keep
// Solid's unrelated defect out of this measurement. PB keeps it on the record.
export function PASelfContainedDelay({ label }: {
	label: string;
}) @{
	let value = state('idle');
	let pending = state(false);
	let runs = state(0);

	<section data-probe="pa">
		<p data-async="label">{label}</p>
		<p data-async="value">{value}</p>
		<p data-async="pending">{pending}</p>
		<p data-async="runs">{runs}</p>
		<button
			type="button"
			data-action="load"
			disabled={pending}
			onClick={async (event) => {
				pending = true;
				value = 'loading';
				const delivered = await new Promise((settle) => {
					setTimeout(() => settle('loaded'), 25);
				});
				value = delivered;
				runs = runs + 1;
				pending = false;
			}}
		>load</button>
	</section>
}
