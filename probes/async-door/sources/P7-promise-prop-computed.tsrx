import { computed } from '@markless/core';

// P7 - THE CONFOUND CONTROL, and this probe's own self-correction.
//
// P2 and P3 supply the async work as a CALLBACK PROP (`load: () => Promise<T>`),
// and Qwik refused both with `Qwik computed greeting cannot invoke a callback
// prop`. Read carelessly that is a sixth "async is refused". It is not: the
// Qwik emitter's guard is `callbackCalls(computedExpression, callbacks).length`,
// which fires on ANY callback-prop invocation inside a computed, synchronous or
// not. So P2/P3 measure Qwik's callback-prop rule and say nothing about async.
//
// S8 - the corpus's own async scenario - avoids this by typing its prop as a
// promise-VALUED `ready: Promise<string>` and writing `await ready`, which
// invokes nothing. This module is the same shape, so the async computed is the
// only variable left. The computed is unread for the reason P2 records.
export function P7PromisePropComputed({ ready }: {
	ready: Promise<string>;
}) @{
	const greeting = computed(async () => await ready);

	<p data-probe="p7">static</p>
}
