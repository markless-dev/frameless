import { state } from '@markless/core';

// P5 - STREAMING, which is board question (b): does a SECOND resolution update
// the view? That is the whole difference between fetching and streaming, and
// streaming is Patrick's headline ask ("the most important one is recreating
// ChatGPT... so streaming").
//
// Authored as repeated `await`s in one handler, each followed by a write - the
// chunk loop a streaming response actually is. `next` is a prop-supplied
// `() => Promise<string>` standing in for the reader; the owner accepted an
// artificial delay as a stand-in for a real remote.
//
// THE LOOP IS UNROLLED ON PURPOSE. A `while`/`for` around the `await` is a
// nested statement, and DEFECTS.md 8.1 records that React lowers only TOP-LEVEL
// handler statements - a write inside a loop body is the same hole as a write
// inside an `if`. Three sequential top-level awaits measure "does resolution
// number two land" without also measuring an unrelated known defect. If three
// chunks land, N chunks land by the same lowering.
export function P5Streaming({ next }: {
	next: () => Promise<string>;
}) @{
	let transcript = state('');
	let streaming = state(false);

	<section data-probe="p5">
		<p data-async="transcript">{transcript}</p>
		<p data-async="streaming">{streaming}</p>
		<button
			type="button"
			data-action="stream"
			onClick={async (event) => {
				streaming = true;
				transcript = '';
				const first = await next();
				transcript = first;
				const second = await next();
				transcript = transcript + second;
				const third = await next();
				transcript = transcript + third;
				streaming = false;
			}}
		>stream</button>
	</section>
}
