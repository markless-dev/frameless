// Qwik resumption over a slow connection (audit item 11, third strand).
//
// RESCOPED by frameless-defects-and-targets-v1 T022, after the repo owner
// overturned finding 2. What this script used to do was click as soon as
// `domcontentloaded` fired - before any framework has installed listeners - and
// read the lost click as a Qwik defect. That assertion was not "Qwik drops
// clicks under throttling"; it was "is this page interactive with no JavaScript
// executed yet", whose answer is NO in every framework. React and Solid are
// never held to it: `waitForInteractive` in the three-way contract blocks them
// on the activation marker first. The asymmetry was the harness's.
//
// So the click now fires only after the container reports it has RESUMED, which
// is the same discipline, applied through Qwik's own signal rather than a
// borrowed one. What this lane measures is therefore something real and
// framework-fair: that resumption COMPLETES on a slow link, that it preserves
// the server-rendered state, and that handlers work afterwards - including the
// click-time QRL fetch, which is still on the throttled critical path because
// the segment is only requested when the event fires.
//
// The gate is `q:container="resumed"`, set by @qwik.dev/core once it has
// deserialized container state (`dist/core.mjs`, `setAttribute(QContainerAttr,
// "resumed")`). It is Qwik's own report about itself, it is the same attribute
// demos/react-official/three-way-contract.ts asserts as resume evidence, and it
// is NOT a browser lifecycle event, a fixed sleep or a networkidle heuristic -
// all three of which would be a second silent proxy in place of the one this
// rescope removed.
//
// The assertion remains about EVENTUAL correctness, not latency: under
// throttling resumption is expected to be slow. What must not happen is
// resumption failing to arrive, the server-rendered value being lost across it,
// or a click after it being dropped.
import { chromium } from 'playwright';

const url = process.env.QWIK_URL ?? 'http://localhost:5175/';
const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();

// Throttle via CDP: ~400kbit/s down with 300ms latency. Slow enough that both
// resumption and a click-time QRL fetch are unambiguously on the critical path.
// QWIK_THROTTLE=0 runs the identical script with the throttle disabled. That is
// the control: it proves the instrument, selectors and expectations are correct,
// so a throttled failure is about the connection and nothing else.
const throttled = process.env.QWIK_THROTTLE !== '0';
const client = await context.newCDPSession(page);
await client.send('Network.enable');
await client.send('Network.emulateNetworkConditions', {
	offline: false,
	latency: throttled ? 300 : 0,
	downloadThroughput: throttled ? (400 * 1024) / 8 : -1,
	uploadThroughput: throttled ? (400 * 1024) / 8 : -1,
});
console.log(`mode: ${throttled ? 'THROTTLED (300ms / 400kbit)' : 'control (unthrottled)'}`);

let failed = false;
const check = (label, ok) => {
	console.log(`${ok ? 'pass' : 'FAIL'} ${label}`);
	if (!ok) failed = true;
};

// Assert what the SERVER sent against the RESPONSE BODY, not the live DOM.
// Reading either the container state or the rendered value off the DOM after
// load is racy by construction - on a fast unthrottled connection Qwik has
// already resumed by the time the DOM is queried, so a check on the served
// bytes' behalf would fail for the right reason at the wrong moment. The served
// bytes are what these two claims are actually about, and this is how the e2e
// lane checks the container too.
const served = await (await fetch(url)).text();
check(
	'served markup carries a paused container',
	/q:container="paused"/.test(served),
);
check(
	'served markup already carries the derived value kit:2',
	/data-value="derived"[^>]*>kit:2</.test(served),
);

// `waitUntil` here only decides when `goto` RETURNS. It is deliberately the
// cheapest option and is NOT the gate: the gate is the next statement, and
// nothing is asserted or clicked between them.
await page.goto(url, { waitUntil: 'domcontentloaded' });

// THE GATE. Qwik's own report that the container has resumed. Under throttling
// this is where the wait actually happens, and its arrival is the primary claim
// of this lane: resumption completes on a slow link rather than stalling.
const startedWaiting = Date.now();
let resumeError = null;
try {
	await page.waitForFunction(
		() => document.documentElement.getAttribute('q:container') === 'resumed',
		undefined,
		{ timeout: 30_000 },
	);
} catch (error) {
	resumeError = error;
}
const resumedAfter = Date.now() - startedWaiting;
check(
	`container reports resumed (after ${resumedAfter}ms${resumeError ? `, ${resumeError.message.split('\n')[0]}` : ''})`,
	resumeError === null,
);
if (resumeError !== null) {
	// Every check below presupposes a resumed container. Reporting them as
	// failures too would be four symptoms of one cause; stop at the cause.
	await browser.close();
	process.exit(1);
}

const value = () => page.textContent('[data-value="derived"]');
// Resumption must not clobber what the server rendered. This is a DOM read on
// purpose - the claim is about the state the container carried ACROSS resume,
// which only the live DOM can report, and it is only asked once the gate above
// has proven resume happened.
check(
	`the server-rendered value survives resumption (got ${await value()})`,
	(await value())?.trim() === 'kit:2',
);

// The click that forces a QRL fetch over the throttled link. The handler segment
// is fetched on demand at click time even on a resumed container, so this is
// still a genuine slow-connection assertion and not a formality.
await page.click('[data-action="increment"]');
await page.waitForFunction(
	() => document.querySelector('[data-value="derived"]')?.textContent?.trim() === 'kit:4',
	undefined,
	{ timeout: 30_000 },
);
check(`value reaches kit:4 after resume (got ${await value()})`, (await value())?.trim() === 'kit:4');

// A second click must also work - proving the first fetch left the container in
// a usable state rather than a half-resumed one.
await page.click('[data-action="increment"]');
await page.waitForFunction(
	() => document.querySelector('[data-value="derived"]')?.textContent?.trim() === 'kit:6',
	undefined,
	{ timeout: 30_000 },
);
check(`value reaches kit:6 on a second click (got ${await value()})`, (await value())?.trim() === 'kit:6');

await browser.close();
if (failed) process.exit(1);
console.log(`Qwik resumption verified (${throttled ? 'throttled' : 'control'}), resumed in ${resumedAfter}ms`);
