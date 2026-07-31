#!/usr/bin/env node
// `pnpm demo` — boot every official demo side by side and print every scenario.
//
// One compiled source, six lanes, three activation models: React, Solid, Svelte,
// Vue and Angular hydrate; Qwik resumes. Each demo is booted through its OWN
// official dev script — this runner never re-implements a demo's dev command and
// never serves anything itself. Hand-rolling a build/SSR harness is the single
// most expensive mistake recorded in this repo's decision trail.
//
// No dependencies: no concurrently, no npm-run-all, no wait-on.
//
// ---------------------------------------------------------------------------
// WHAT THIS FILE IS FOR, AND WHY IT KEEPS GOING STALE
//
// It is the front door. An app that ships and is not listed here is, for every
// practical purpose, not shipped: `frameless-app-axes-v1`'s oracle makes "AN
// ENTRY IN pnpm demo" a completion condition precisely because three shipped
// applications had already gone invisible here.
//
// Measured before this rewrite: it listed THREE of six lanes (react, solid,
// qwik) and THREE of the twelve scenarios that then existed (S1-S3). S10 TodoMVC, S11 TodoMVC Advanced
// and S12 Codex clone were invisible, as were svelte, vue and angular entirely.
// The route list was three hardcoded `demo.routes[0..2]` reads, so a fourth
// scenario could not be displayed even if it were added to the array.
//
// APPENDING A NEW APP IS ONE ROW IN `SCENARIOS`, plus an entry in a lane's
// `unbuilt` map if that lane refuses it. Nothing else in this file should need
// to change.
// ---------------------------------------------------------------------------

import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * THE ONE SCENARIO TABLE. Ordinals are load-bearing well beyond this file:
 * ten-plus per-lane suites derive their `generated/` inventory from
 * /^s(\d+)-[\w-]+\.json$/ and assert it exactly, which is why the applications
 * ride ordinal slots (S10, S11, S12, S13, S14) instead of taking names of their own.
 *
 * `path` is the CANONICAL, UNSLASHED form. Lanes transform it — see `routeFor`.
 *
 * S1-S9 are the three-way contract `scripts/e2e.mjs` pins to the literal
 * ['s1'..'s9']. S10-S14 are the applications, deliberately OUTSIDE that contract
 * and browsable only. Both kinds belong in the front door regardless.
 *
 * @type {ReadonlyArray<{ id: string, path: string, title: string }>}
 */
const SCENARIOS = [
	{ id: 'S1', path: '/', title: 'render once' },
	{ id: 'S2', path: '/s2', title: 'keyed todo' },
	{ id: 'S3', path: '/s3', title: 'event form' },
	{ id: 'S4', path: '/s4', title: 'nested list' },
	{ id: 'S5', path: '/s5', title: 'branch teardown' },
	{ id: 'S6', path: '/s6', title: 'whitespace text' },
	{ id: 'S7', path: '/s7', title: 'form controls' },
	{ id: 'S8', path: '/s8', title: 'async handlers' },
	{ id: 'S9', path: '/s9', title: 'boolean attributes' },
	{ id: 'S10', path: '/todomvc', title: 'TodoMVC' },
	{ id: 'S11', path: '/todomvc-advanced', title: 'TodoMVC Advanced' },
	{ id: 'S12', path: '/codex', title: 'Codex clone' },
	// S13 IS THE FIRST APPLICATION IN THIS TABLE WITH NO `unbuilt` ENTRY IN ANY
	// LANE. S11 and S12 are absent from angular because that emitter refuses them
	// on its global-identifier ban; S13 names no global at all, because every
	// relative age on the page is a literal string in the seeded data rather than
	// something computed from `Date`. Six lanes, six routes.
	{ id: 'S13', path: '/hn', title: 'Hacker News front page' },
	// S14 IS THE FIRST APPLICATION IN THIS TABLE WITH THREE ABSENCES AND THREE
	// DIFFERENT REASONS, which is what makes it the RECURSION measurement rather
	// than just another page. `HnItem` names ITSELF in its own template.
	//   svelte, vue: the emitter REFUSES a same-module component reference - a
	//     `.svelte` file and a `.vue` SFC each hold exactly one component.
	//   angular: the emitter EMITS a correct recursive component and the LANE'S
	//     OWN GATE rejects it, because the decorator needs `imports: [HnItem]`
	//     for the selector to resolve and `imports` is not in that lane's
	//     baseline form inventory.
	// react, solid and qwik serve it. See the three refusal constants below.
	{ id: 'S14', path: '/hn-item', title: 'Hacker News item page (recursive comments)' },
	// S15 IS THE SECOND ROW IN THIS TABLE WITH NO `unbuilt` ENTRY IN ANY LANE, and
	// the FIRST that was designed to be so rather than turning out that way. S13
	// kept six lanes because nothing in it happened to name a global; S15 keeps
	// them because its axis IS six-lane fan-out - it is pure SYNCHRONOUS DERIVED
	// STATE, so there is no `Promise`/`setTimeout` for angular's global-identifier
	// ban, no async door for vue's GLOBALS_ALLOWED gap, and no component reference
	// for either of the two emitter defects S14 exposed. Its date is a LITERAL
	// STRING in the seeded data, which is the one constraint the six-lane claim
	// actually rests on. ONE CLICK MOVES EIGHT DERIVED OBSERVABLES.
	{ id: 'S15', path: '/habits', title: 'Habit tracker (one click, eight derived updates)' },
	// S16 IS THE THIRD ROW IN THIS TABLE WITH NO `unbuilt` ENTRY IN ANY LANE, and
	// the ONLY ONE WHOSE TITLE NAMES SOMETHING THE PAGE DOES NOT DO. It is the DRAG
	// scenario and it has no drag, which is the measurement rather than a shortfall:
	// the two-word drag events ARE produced by five of the six emitters (svelte
	// refuses the ELEMENT, not the event), and they are inert only where the lane
	// binds by a framework prop name - react's `onDragover` never fires while vue's
	// `@dragover`, angular's `(dragover)` and svelte's `ondragover` are the real DOM
	// event names. What kept them off the page is the TYPE BASELINE: one drop zone
	// and one draggable card take `pnpm check` from 267 to 280. Cards move with the
	// arrow buttons instead and THE PAGE SAYS SO. See
	// `packages/compiler/test/fixtures/s16-task-board.tsrx`.
	{
		id: 'S16',
		path: '/board',
		title: 'Task board (arrow moves — DRAG IS RECORDED AS REFUSED, see the page)',
	},
];

/**
 * ANGULAR'S TWO ABSENCES ARE RECORDED, NOT OMITTED. The lane is built for
 * everything else in the corpus including S10, so this is a recorded lane limit
 * and not a missing lane. The refusal is read off the real modules and lives in
 * `packages/frameworks/angular/scripts/regenerate.ts`:
 *
 *   Angular emitter cannot resolve the identifier "Promise" in a transplanted
 *   body: it is neither a body-local binding, a function parameter, a @for
 *   variable, nor a declared component member (...). The emitter throws rather
 *   than guessing whether it is a global
 *
 * It is NOT about async: every identifier in a transplanted body must resolve to
 * lexical scope or a declared component member, and `Promise`, `setTimeout`,
 * `fetch`, `Date` and `JSON` are all globals. Both apps need an artificial delay
 * built from `new Promise` + `setTimeout`, so neither can be NAMED in this lane.
 */
const ANGULAR_REFUSAL = 'emitter refuses: cannot name the global `Promise`';

/**
 * THE THREE S14 ABSENCES, AND THEY ARE NOT THE SAME KIND OF ABSENCE.
 *
 * S14's `HnItem` NAMES ITSELF, which is a component reference whose target
 * module is `self` - the first one in this corpus. Measured per lane at
 * frameless-app-axes-v1 T003, on the real module and not on a probe.
 *
 * SVELTE AND VUE REFUSE AT THE EMITTER, verbatim:
 *
 *   Svelte emitter has no lowering for a same-module component reference
 *   (HnItem): a .svelte file declares exactly one component, and a snippet
 *   cannot own state or a lifecycle
 *   Vue emitter has no lowering for a same-module component reference (HnItem):
 *   a .vue SFC declares exactly one component
 *
 * That is a FILE-FORMAT limit, not a recursion verdict: spelled the way those
 * two frameworks spell recursion natively - the module importing itself under an
 * alias - BOTH EMITTERS TAKE IT, and the compiler's linker refuses that instead
 * with `Component-reference cycle`.
 *
 * ANGULAR IS THE DIFFERENT ONE: `emit()` SUCCEEDS and produces a correct
 * recursive component, and the lane's own dossier gate then rejects the result:
 *
 *   Emitted Angular source uses the component-metadata form "imports", which is
 *   not in the baseline form inventory
 *
 * Admitting `imports` needs a version floor and floor evidence and would move
 * the derived ANGULAR_BASELINE_FLOOR, which is a dossier ruling rather than a
 * code edit. Recorded in packages/frameworks/angular/test/ungated-scenarios.ts.
 */
const SELF_REFERENCE_REFUSAL =
	'emitter refuses: one component per module, so a self-reference has nowhere to land';
const ANGULAR_IMPORTS_REFUSAL =
	'emits, but the lane gate rejects `imports` (not in the baseline form inventory)';

/**
 * The lanes. `port` is a PREFERENCE, not a guarantee — see `allocatePorts`.
 *
 * HOW EACH LANE TAKES A PORT, ALL SIX MEASURED RATHER THAN ASSUMED:
 *
 *  - react / solid / vue read `process.env.PORT || 5173` in their own
 *    `server.js`, so all three default to the SAME port and only one can run at
 *    a time without the injection. `PORT` is not optional for them.
 *  - qwik's dev script is pinned `vite --port 5175 --strictPort`. Appending
 *    `--port <n>` WINS — vite takes the last occurrence — so the official script
 *    is still what runs, and `--strictPort` survives, which means a busy port
 *    fails loudly instead of drifting silently.
 *  - svelte's dev script ends in `vite dev`, which takes `--port` appended.
 *  - ANGULAR HAS NO `dev` SCRIPT; it is `start`. And `pnpm start -- --port <n>`
 *    FAILS on a `--` collision:
 *      Option '--' has been specified multiple times.
 *      Error: Schema validation failed ... must NOT have additional properties()
 *    `pnpm start --port <n>`, WITHOUT the `--`, works: pnpm appends the flag to
 *    the end of the `&&` chain where `ng serve` receives it.
 *
 * @type {ReadonlyArray<{
 *   name: string, dir: string, port: number, activation: string,
 *   script: string, portFlag: boolean, portEnv: boolean,
 *   trailingSlash: boolean, unbuilt: Record<string, string>,
 * }>}
 */
const DEMOS = [
	{
		name: 'react',
		dir: 'demos/react-official',
		port: 5173,
		activation: 'hydrates',
		script: 'dev',
		portFlag: false,
		portEnv: true,
		trailingSlash: false,
		unbuilt: {},
	},
	{
		name: 'solid',
		dir: 'demos/solid-official',
		port: 5174,
		activation: 'hydrates',
		script: 'dev',
		portFlag: false,
		portEnv: true,
		trailingSlash: false,
		unbuilt: {},
	},
	{
		name: 'qwik',
		dir: 'demos/qwik',
		port: 5175,
		activation: 'resumes',
		script: 'dev',
		portFlag: true,
		portEnv: false,
		// QWIK CITY CANONICALISES TO A TRAILING SLASH. `/codex` answers 301 with
		// `location: /codex/`, and every other non-root route does the same. A
		// BROWSER FOLLOWS IT SILENTLY, which is why clicking through the lane never
		// surfaces a missing slash — but `curl` and `fetch` see the 301 and read
		// zero bytes, so a checker that omits the slash measures a redirect rather
		// than a page. Measured on every route in this table.
		trailingSlash: true,
		unbuilt: {},
	},
	{
		name: 'svelte',
		dir: 'demos/svelte-official',
		port: 5176,
		activation: 'hydrates',
		script: 'dev',
		portFlag: true,
		portEnv: false,
		trailingSlash: false,
		unbuilt: { S14: SELF_REFERENCE_REFUSAL },
	},
	{
		name: 'vue',
		dir: 'demos/vue-official',
		port: 5177,
		activation: 'hydrates',
		script: 'dev',
		portFlag: false,
		portEnv: true,
		trailingSlash: false,
		unbuilt: { S14: SELF_REFERENCE_REFUSAL },
	},
	{
		name: 'angular',
		dir: 'demos/angular-official',
		port: 5178,
		activation: 'hydrates',
		script: 'start',
		portFlag: true,
		portEnv: false,
		trailingSlash: false,
		unbuilt: { S11: ANGULAR_REFUSAL, S12: ANGULAR_REFUSAL, S14: ANGULAR_IMPORTS_REFUSAL },
	},
];

// Angular's `ng serve` compiles the whole app before it answers, which is far
// slower than the five vite/express lanes. The old 60s budget was sized for
// three fast lanes.
const READY_TIMEOUT_MS = 240_000;
const POLL_INTERVAL_MS = 250;
const HEARTBEAT_MS = 10_000;
const PROBE_TIMEOUT_MS = 2_000;
const SIGINT_GRACE_MS = 3_000;
const SIGKILL_GRACE_MS = 1_500;
const PORT_SCAN_LIMIT = 40;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** The route a given lane actually serves for a scenario. */
function routeFor(demo, scenario) {
	if (demo.unbuilt[scenario.id]) return null;
	if (!demo.trailingSlash || scenario.path === '/') return scenario.path;
	return `${scenario.path}/`;
}

/**
 * @typedef {{
 *   demo: (typeof DEMOS)[number]
 *   port: number
 *   child: import('node:child_process').ChildProcess
 *   exited: boolean
 *   code: number | null
 *   signal: NodeJS.Signals | null
 *   buffered: string[]
 *   streaming: boolean
 * }} Runner
 */

/** @type {Runner[]} */
const runners = [];
let shuttingDown = false;
let interrupted = false;

function emit(name, line) {
	process.stdout.write(`[${name}] ${line}\n`);
}

/** Buffer a demo's output until every demo is up; stream it afterwards. */
function collect(runner, stream) {
	let pending = '';
	stream.setEncoding('utf8');
	stream.on('data', (chunk) => {
		pending += chunk;
		const lines = pending.split('\n');
		pending = lines.pop() ?? '';
		for (const line of lines) {
			// Once Ctrl-C has been forwarded, the demos' own teardown noise
			// ("ELIFECYCLE Command failed") is not the user's problem. Failures
			// are never suppressed — see fail().
			if (interrupted) continue;
			if (runner.streaming) emit(runner.demo.name, line);
			else runner.buffered.push(line);
		}
	});
	stream.on('end', () => {
		if (pending.length === 0) return;
		if (!interrupted) {
			if (runner.streaming) emit(runner.demo.name, pending);
			else runner.buffered.push(pending);
		}
		pending = '';
	});
}

/**
 * Is anything already listening here? Used for two different jobs, and the
 * second one is the important one.
 *
 * 1. Pick ports that are free.
 * 2. MAKE THE READINESS PROBE MEAN SOMETHING. `waitForAll` decides a lane is up
 *    when its port answers 200 — but a port answering 200 only proves SOMEBODY
 *    is there, not that it is the process we started. That is not hypothetical:
 *    port 5175 was this runner's hardcoded qwik port AND is held on this machine
 *    by a FOREIGN `node`, so the old runner printed its whole "here are your
 *    URLs" banner — qwik included, satisfied by the stranger's 200 — and only
 *    then died with `Error: Port 5175 is already in use`. It advertised a URL
 *    that served someone else's application.
 *
 *    Confirming the port was EMPTY before we spawned is what makes a later 200
 *    attributable to us.
 */
async function portInUse(port) {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
	try {
		await fetch(`http://localhost:${port}/`, { signal: controller.signal, redirect: 'manual' });
		return true;
	} catch {
		return false;
	} finally {
		clearTimeout(timer);
	}
}

/**
 * Assign each lane a port that is CONFIRMED FREE, preferring its historical one.
 *
 * NEVER KILLS ANYTHING. A prior task killed one of the owner's long-running
 * servers with a broad `pkill -f` and it could not be restored; the standing
 * rule is to record an occupied port and route around it. Occupancy is reported
 * rather than swallowed, so a stale demo of your own still looks like a problem
 * instead of silently shifting every port by one.
 */
async function allocatePorts() {
	/** @type {Map<string, number>} */
	const assigned = new Map();
	const taken = new Set();
	const skipped = [];

	for (const demo of DEMOS) {
		let port = demo.port;
		let scanned = 0;
		while (scanned < PORT_SCAN_LIMIT && (taken.has(port) || (await portInUse(port)))) {
			if (!taken.has(port)) skipped.push({ name: demo.name, port });
			port += 1;
			scanned += 1;
		}
		if (scanned >= PORT_SCAN_LIMIT) {
			await fail(
				`could not find a free port for ${demo.name} within ${PORT_SCAN_LIMIT} of ${demo.port}.`,
			);
			return assigned;
		}
		taken.add(port);
		assigned.set(demo.name, port);
	}

	for (const { name, port } of skipped) {
		process.stdout.write(
			`pnpm demo: port ${port} is already in use, so ${name} was moved off it. ` +
				`Nothing was killed — find the holder with \`lsof -nP -iTCP:${port} -sTCP:LISTEN\`.\n`,
		);
	}
	return assigned;
}

function start(demo, port) {
	const args = ['--dir', demo.dir, demo.script];
	// `--port <n>` with NO `--` separator. See the DEMOS comment: the `--` form
	// is what fails on angular.
	if (demo.portFlag) args.push('--port', String(port));

	const child = spawn('pnpm', args, {
		cwd: repoRoot,
		env: demo.portEnv ? { ...process.env, PORT: String(port) } : { ...process.env },
		// Its own process group, so SIGINT can be delivered to the whole
		// pnpm -> node -> vite chain. child.kill() alone orphans vite.
		detached: true,
		stdio: ['ignore', 'pipe', 'pipe'],
	});

	/** @type {Runner} */
	const runner = {
		demo,
		port,
		child,
		exited: false,
		code: null,
		signal: null,
		buffered: [],
		streaming: false,
	};

	collect(runner, child.stdout);
	collect(runner, child.stderr);

	child.on('error', (error) => {
		runner.exited = true;
		runner.code = 1;
		runner.buffered.push(`failed to spawn: ${error.message}`);
	});
	child.on('exit', (code, signal) => {
		runner.exited = true;
		runner.code = code;
		runner.signal = signal;
		if (runner.streaming && !shuttingDown) {
			emit(demo.name, `exited (code ${code ?? 'null'}, signal ${signal ?? 'null'})`);
		}
	});

	return runner;
}

function signalGroup(runner, signal) {
	if (runner.exited) return;
	const pid = runner.child.pid;
	if (pid === undefined) return;
	try {
		// Negative pid = the whole process group.
		process.kill(-pid, signal);
	} catch (error) {
		if (error.code === 'ESRCH') return;
		try {
			runner.child.kill(signal);
		} catch {
			/* already gone */
		}
	}
}

async function shutdown() {
	shuttingDown = true;
	for (const runner of runners) signalGroup(runner, 'SIGINT');

	let deadline = Date.now() + SIGINT_GRACE_MS;
	while (Date.now() < deadline && runners.some((runner) => !runner.exited)) {
		await sleep(50);
	}
	if (runners.every((runner) => runner.exited)) return;

	for (const runner of runners) signalGroup(runner, 'SIGKILL');
	deadline = Date.now() + SIGKILL_GRACE_MS;
	while (Date.now() < deadline && runners.some((runner) => !runner.exited)) {
		await sleep(50);
	}
}

function dumpBufferedOutput() {
	for (const runner of runners) {
		if (runner.buffered.length === 0) continue;
		process.stdout.write(`\n--- ${runner.demo.name} (${runner.demo.dir}) output ---\n`);
		for (const line of runner.buffered) emit(runner.demo.name, line);
		runner.buffered.length = 0;
	}
}

async function fail(reason) {
	process.stderr.write(`\npnpm demo: ${reason}\n`);
	dumpBufferedOutput();
	// Anything the demos say from here on is diagnostic, so let it through.
	for (const runner of runners) runner.streaming = true;
	await shutdown();
	process.exitCode = 1;
	process.exit(1);
}

async function probe(url) {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
	try {
		const response = await fetch(url, { signal: controller.signal, redirect: 'manual' });
		return response.status;
	} catch {
		return null;
	} finally {
		clearTimeout(timer);
	}
}

async function waitForAll() {
	const pending = new Set(runners.map((runner) => runner.demo.name));
	const started = Date.now();
	const deadline = started + READY_TIMEOUT_MS;
	let nextHeartbeat = started + HEARTBEAT_MS;

	while (pending.size > 0) {
		if (Date.now() >= nextHeartbeat) {
			nextHeartbeat += HEARTBEAT_MS;
			const waiting = runners
				.filter((runner) => pending.has(runner.demo.name))
				.map((runner) => `${runner.demo.name} (:${runner.port})`)
				.join(', ');
			process.stdout.write(
				`pnpm demo: ${Math.round((Date.now() - started) / 1000)}s — still waiting for ${waiting}\n`,
			);
		}
		const dead = runners.find((runner) => runner.exited);
		if (dead) {
			await fail(
				`${dead.demo.name} (${dead.demo.dir}) exited before it was ready ` +
					`(code ${dead.code ?? 'null'}, signal ${dead.signal ?? 'null'}).`,
			);
			return;
		}
		if (Date.now() > deadline) {
			const ports = runners
				.filter((runner) => pending.has(runner.demo.name))
				.map((runner) => runner.port)
				.join(', ');
			await fail(
				`timed out after ${READY_TIMEOUT_MS / 1000}s waiting for HTTP 200 from: ` +
					`${[...pending].join(', ')} on port(s) ${ports}. ` +
					`express does not report EADDRINUSE, it just never answers.`,
			);
			return;
		}

		for (const runner of runners) {
			if (!pending.has(runner.demo.name)) continue;
			// The port was confirmed EMPTY in allocatePorts(), so a 200 here is ours.
			const status = await probe(`http://localhost:${runner.port}/`);
			if (status === 200) pending.delete(runner.demo.name);
		}
		if (pending.size > 0) await sleep(POLL_INTERVAL_MS);
	}
}

function announce() {
	const lines = [
		'',
		'  Frameless — one source, six lanes, two activation models.',
		'  Same .tsrx source, same compiled IR, same observable behavior.',
		'',
	];

	for (const runner of runners) {
		const { demo } = runner;
		lines.push(
			`  ${demo.name.padEnd(8)}${`(${demo.activation})`.padEnd(11)}http://localhost:${runner.port}/`,
		);

		// Every scenario, wrapped — never a fixed `routes[0..2]` read.
		const cells = [];
		for (const scenario of SCENARIOS) {
			const route = routeFor(demo, scenario);
			if (route === null) continue;
			cells.push(`${scenario.id} ${route}`);
		}
		for (let index = 0; index < cells.length; index += 3) {
			const row = cells
				.slice(index, index + 3)
				.map((cell) => cell.padEnd(26))
				.join('')
				.trimEnd();
			lines.push(`  ${' '.repeat(17)}${row}`);
		}

		// A LANE THAT CANNOT SERVE A SCENARIO SAYS SO. The oracle counts a missing
		// lane WITH a verbatim refusal as a satisfied result and one WITHOUT as a
		// rejection, so silence here would be the actual defect.
		for (const scenario of SCENARIOS) {
			const reason = demo.unbuilt[scenario.id];
			if (!reason) continue;
			lines.push(`  ${' '.repeat(17)}${scenario.id} —  not served (${reason})`);
		}
		lines.push('');
	}

	lines.push('  Scenarios: S1-S9 are the 6 x 9 three-way contract; S10 TodoMVC,');
	lines.push('  S11 TodoMVC Advanced, S12 Codex clone, S13 Hacker News,');
	lines.push('  S14 Hacker News item, S15 Habit tracker and S16 Task board are');
	lines.push('  the applications. S13, S15 and S16 are the three that all SIX');
	lines.push('  lanes serve. S14 is the RECURSION page and three lanes refuse it,');
	lines.push('  each for a different recorded reason; S15 is the FAN-OUT page,');
	lines.push('  where one click moves eight derived observables and no lane is');
	lines.push('  lost; S16 is the DRAG page AND IT HAS NO DRAG - the events emit in');
	lines.push('  five lanes and cost the type baseline 267 -> 280, so the axis is');
	lines.push('  RECORDED and the cards move with arrow buttons. The page says so.');
	lines.push('  Qwik routes keep their trailing slash — its router 301s without it.');
	lines.push('  Walkthrough: README.md, "See It Yourself: Hydrate, Hydrate, Resume".');
	lines.push(`  Ctrl-C stops all ${runners.length}.`);
	lines.push('');
	process.stdout.write(`${lines.join('\n')}\n`);
}

async function main() {
	process.stdout.write(`pnpm demo: checking ports for ${DEMOS.length} lanes...\n`);
	const ports = await allocatePorts();
	process.stdout.write(
		`pnpm demo: starting ${DEMOS.map((demo) => `${demo.name} (${ports.get(demo.name)})`).join(', ')}...\n`,
	);
	process.stdout.write('pnpm demo: angular compiles before it answers, so give it a moment.\n');

	for (const demo of DEMOS) runners.push(start(demo, ports.get(demo.name)));

	for (const signal of /** @type {const} */ (['SIGINT', 'SIGTERM'])) {
		process.on(signal, () => {
			if (shuttingDown) return;
			interrupted = true;
			process.stdout.write('\npnpm demo: stopping all demos...\n');
			shutdown().then(() => {
				process.exit(0);
			});
		});
	}

	// Last-resort sweep: if this process dies for any other reason, do not leave
	// a detached vite behind.
	process.on('exit', () => {
		for (const runner of runners) {
			if (runner.exited) continue;
			const pid = runner.child.pid;
			if (pid === undefined) continue;
			try {
				process.kill(-pid, 'SIGKILL');
			} catch {
				/* already gone */
			}
		}
	});

	await waitForAll();

	for (const runner of runners) {
		runner.buffered.length = 0;
		runner.streaming = true;
	}
	announce();

	// Stay up. If a demo dies while serving, take the others down with it.
	while (true) {
		const dead = runners.find((runner) => runner.exited);
		if (dead) {
			await fail(
				`${dead.demo.name} (${dead.demo.dir}) exited while serving ` +
					`(code ${dead.code ?? 'null'}, signal ${dead.signal ?? 'null'}).`,
			);
			return;
		}
		await sleep(POLL_INTERVAL_MS);
	}
}

main().catch(async (error) => {
	await fail(error instanceof Error ? error.message : String(error));
});
