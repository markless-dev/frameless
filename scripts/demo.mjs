#!/usr/bin/env node
// `pnpm demo` — boot the three official demos side by side.
//
// One compiled source, three activation models: React hydrates, Solid hydrates,
// Qwik resumes. Each demo is booted through its OWN official dev script
// (`pnpm --dir demos/<name> dev`). This runner never re-implements a demo's dev
// command and never serves anything itself — hand-rolling a build/SSR harness is
// the single most expensive mistake recorded in this repo's decision trail.
//
// No dependencies: no concurrently, no npm-run-all, no wait-on.

import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// The one port table. demos/{react,solid}-official/server.js already honour
// process.env.PORT, so PORT is injected for those two. Vite ignores PORT, so
// demos/qwik carries `--port 5175 --strictPort` inside its own dev script.
const DEMOS = [
	{
		name: 'react',
		dir: 'demos/react-official',
		port: 5173,
		activation: 'hydrates',
		routes: ['/', '/s2', '/s3'],
	},
	{
		name: 'solid',
		dir: 'demos/solid-official',
		port: 5174,
		activation: 'hydrates',
		routes: ['/', '/s2', '/s3'],
	},
	{
		name: 'qwik',
		dir: 'demos/qwik',
		port: 5175,
		activation: 'resumes',
		routes: ['/', '/s2/', '/s3/'],
	},
];

const READY_TIMEOUT_MS = 60_000;
const POLL_INTERVAL_MS = 250;
const HEARTBEAT_MS = 10_000;
const PROBE_TIMEOUT_MS = 2_000;
const SIGINT_GRACE_MS = 3_000;
const SIGKILL_GRACE_MS = 1_500;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * @typedef {{
 *   demo: (typeof DEMOS)[number]
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

function start(demo) {
	const child = spawn('pnpm', ['--dir', demo.dir, 'dev'], {
		cwd: repoRoot,
		env: { ...process.env, PORT: String(demo.port) },
		// Its own process group, so SIGINT can be delivered to the whole
		// pnpm -> node -> vite chain. child.kill() alone orphans vite.
		detached: true,
		stdio: ['ignore', 'pipe', 'pipe'],
	});

	/** @type {Runner} */
	const runner = {
		demo,
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
				.map((runner) => `${runner.demo.name} (:${runner.demo.port})`)
				.join(', ');
			process.stdout.write(
				`pnpm demo: ${Math.round((Date.now() - started) / 1000)}s — still waiting for ${waiting}\n`,
			);
		}
		const dead = runners.find((runner) => runner.exited);
		if (dead) {
			await fail(
				`${dead.demo.name} (${dead.demo.dir}) exited before it was ready ` +
					`(code ${dead.code ?? 'null'}, signal ${dead.signal ?? 'null'}). ` +
					`Is port ${dead.demo.port} already in use?`,
			);
			return;
		}
		if (Date.now() > deadline) {
			const ports = runners
				.filter((runner) => pending.has(runner.demo.name))
				.map((runner) => runner.demo.port)
				.join(', ');
			await fail(
				`timed out after ${READY_TIMEOUT_MS / 1000}s waiting for HTTP 200 from: ` +
					`${[...pending].join(', ')}. Check that port(s) ${ports} are free — ` +
					`express does not report EADDRINUSE, it just never answers.`,
			);
			return;
		}

		for (const runner of runners) {
			if (!pending.has(runner.demo.name)) continue;
			const status = await probe(`http://localhost:${runner.demo.port}/`);
			if (status === 200) pending.delete(runner.demo.name);
		}
		if (pending.size > 0) await sleep(POLL_INTERVAL_MS);
	}
}

function announce() {
	const lines = [
		'',
		'  Frameless — one source, three activations.',
		'  Same .tsrx source, same compiled IR, same observable behavior.',
		'',
	];
	for (const demo of DEMOS) {
		const label = demo.name.padEnd(6);
		const activation = `(${demo.activation})`.padEnd(11);
		lines.push(`  ${label}${activation}http://localhost:${demo.port}/`);
		lines.push(
			`  ${' '.repeat(17)}S1 ${demo.routes[0]}   S2 ${demo.routes[1]}   S3 ${demo.routes[2]}`,
		);
	}
	lines.push('');
	lines.push('  Qwik routes keep their trailing slash — its router normalises them.');
	lines.push('  Walkthrough: README.md, "See It Yourself: Hydrate, Hydrate, Resume".');
	lines.push('  Ctrl-C stops all three.');
	lines.push('');
	process.stdout.write(`${lines.join('\n')}\n`);
}

async function main() {
	process.stdout.write('pnpm demo: starting react (5173), solid (5174), qwik (5175)...\n');

	for (const demo of DEMOS) runners.push(start(demo));

	for (const signal of /** @type {const} */ (['SIGINT', 'SIGTERM'])) {
		process.on(signal, () => {
			if (shuttingDown) return;
			interrupted = true;
			process.stdout.write('\npnpm demo: stopping all three demos...\n');
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
