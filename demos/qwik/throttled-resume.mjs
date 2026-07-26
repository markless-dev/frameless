// Network-throttled Qwik resumption (audit item 11, third strand).
//
// Qwik fetches a handler's QRL AT CLICK TIME. Every other lane runs on a fast
// local connection, where that fetch is invisible. Under a slow connection the
// gap between "user clicked" and "handler exists" becomes real, and that is the
// one place the owner's "jitter" instinct maps onto genuine timing variance
// rather than ordering.
//
// The assertion is deliberately about EVENTUAL correctness, not latency: under
// throttling the update is expected to be slow. What must not happen is the
// click being lost, or the value landing wrong.
import { chromium } from 'playwright';

const url = process.env.QWIK_URL ?? 'http://localhost:5175/';
const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();

// Throttle via CDP: ~400kbit/s down with 300ms latency. Slow enough that a
// click-time QRL fetch is unambiguously on the critical path.
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

await page.goto(url, { waitUntil: 'domcontentloaded' });

// Served markup is paused: resumption has not happened yet.
const container = await page.getAttribute('html', 'q:container');
check(`served container is paused (got ${container})`, container === 'paused');

const value = () => page.textContent('[data-value="derived"]');
check(`server-rendered value is kit:2 (got ${await value()})`, (await value())?.trim() === 'kit:2');

// The click that forces a QRL fetch over the throttled link.
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
console.log('throttled Qwik resumption verified');
