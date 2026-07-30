import { state } from '@markless/core';

// P8 - STREAMING WITHOUT THE CALLBACK-PROP CONFOUND. P5 measured repeated
// resolution but supplied the chunks through a callback prop, which Qwik refuses
// for a reason that has nothing to do with async (see P7). This is the same
// question - DOES A SECOND RESOLUTION UPDATE THE VIEW - asked in S8's shape, a
// promise-VALUED prop that is awaited rather than called.
//
// Awaiting the same promise three times resolves to the same value three times,
// which is the point: what is being measured is whether the SECOND and THIRD
// post-`await` writes are lowered and land, not whether the source can produce
// distinct chunks. A real stream differs only in the value.
//
// Writes stay top-level and unconditional and the loop stays unrolled, for the
// reason P5 records (DEFECTS.md 8.1).
export function P8PromisePropStreaming({ chunk }: {
	chunk: Promise<string>;
}) @{
	let transcript = state('');
	let streaming = state(false);
	let ticks = state(0);

	<section data-probe="p8">
		<p data-async="transcript">{transcript}</p>
		<p data-async="streaming">{streaming}</p>
		<p data-async="ticks">{ticks}</p>
		<button
			type="button"
			data-action="stream"
			onClick={async (event) => {
				streaming = true;
				transcript = '';
				ticks = 0;
				const first = await chunk;
				transcript = transcript + first;
				ticks = ticks + 1;
				const second = await chunk;
				transcript = transcript + second;
				ticks = ticks + 1;
				const third = await chunk;
				transcript = transcript + third;
				ticks = ticks + 1;
				streaming = false;
			}}
		>stream</button>
	</section>
}
