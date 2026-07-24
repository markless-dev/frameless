import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { EnrichedIR } from '@frameless/compiler';
import { dirname, normalize, relative, resolve } from 'pathe';

export type DossierRef = 'T002-qwik-architecture D8';
export type GatePolicy = {
	readonly id: string;
	readonly dossierRef: DossierRef;
	readonly requiresArtifact?: true;
};
export type GateViolation = {
	readonly file: string;
	readonly policy: string;
	readonly dossierRef: DossierRef;
	readonly message: string;
	readonly line: number | null;
};
export type GateResult = {
	readonly files: readonly string[];
	readonly policies: readonly GatePolicy[];
	readonly violations: readonly GateViolation[];
	readonly unevaluated: ReadonlyArray<{
		readonly policy: string;
		readonly reason: 'requires-artifact';
	}>;
};

function persistenceArtifactPolicy() {
	const policy = {
		id: 'persistence-render-lowering',
		dossierRef: 'T002-qwik-architecture D8',
	} as const;
	Object.defineProperty(policy, 'requiresArtifact', { enumerable: false, value: true });
	return policy as typeof policy & { readonly requiresArtifact: true };
}

export const QWIK_GATE_POLICIES = [
	{ id: 'no-visible-task', dossierRef: 'T002-qwik-architecture D8' },
	persistenceArtifactPolicy(),
] as const satisfies readonly GatePolicy[];

const POLICIES = new Map<string, GatePolicy>(
	QWIK_GATE_POLICIES.map((policy) => [policy.id, policy]),
);

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const VISIBLE_LIFECYCLE_MARKER =
	/\buseVisibleTask\$(?![\w$])|\bonQVisible\$(?![\w$])|q-e:qvisible|on:qvisible/g;

function violation(
	file: string,
	policy: string,
	message: string,
	line: number | null = null,
): GateViolation {
	return {
		file,
		policy,
		dossierRef: POLICIES.get(policy)?.dossierRef ?? 'T002-qwik-architecture D8',
		message,
		line,
	};
}

function visibleTaskViolations(file: string, source: string): GateViolation[] {
	return [...source.matchAll(VISIBLE_LIFECYCLE_MARKER)].map((match) =>
		violation(
			file,
			'no-visible-task',
			`Emitted Qwik source must not contain the eager visible-lifecycle marker ${JSON.stringify(match[0])}`,
			source.slice(0, match.index).split('\n').length,
		),
	);
}

function persistenceViolations(
	file: string,
	artifact: EnrichedIR,
): GateViolation[] | undefined {
	const persistence = (artifact.records as { readonly persistence?: unknown }).persistence;
	if (!Array.isArray(persistence)) return undefined;
	if (persistence.length === 0) return [];
	return [
		violation(
			file,
			'persistence-render-lowering',
			'Qwik v2 emission fails closed on persistence-bearing IR because Qwik has no PersistenceLanding',
		),
	];
}

async function collectJsxFiles(root: string, directory: string): Promise<string[]> {
	const absolute = resolve(root, directory);
	const entries = await readdir(absolute, { withFileTypes: true }).catch(
		(error: NodeJS.ErrnoException) => {
			if (error.code === 'ENOENT') return [];
			throw error;
		},
	);
	const files: string[] = [];
	for (const entry of entries) {
		const child = resolve(absolute, entry.name);
		if (entry.isDirectory())
			files.push(...(await collectJsxFiles(root, relative(root, child))));
		else if (entry.isFile() && entry.name.endsWith('.jsx'))
			files.push(normalize(relative(root, child)));
	}
	return files;
}

export async function discoverGeneratedFiles(
	options: { readonly cwd?: string; readonly directory?: string } = {},
): Promise<string[]> {
	const cwd = resolve(options.cwd ?? PACKAGE_ROOT);
	return (await collectJsxFiles(cwd, options.directory ?? 'generated')).sort();
}

export async function checkSources(
	entries: ReadonlyArray<{
		readonly file: string;
		readonly source: string;
		readonly artifact?: EnrichedIR;
	}>,
	_options: { readonly cwd?: string } = {},
): Promise<GateResult> {
	const violations: GateViolation[] = [];
	const unevaluatedPolicies = new Set<string>();
	for (const { file, source, artifact } of entries) {
		violations.push(...visibleTaskViolations(file, source));
		if (artifact) {
			const artifactViolations = persistenceViolations(file, artifact);
			if (artifactViolations) violations.push(...artifactViolations);
			else unevaluatedPolicies.add('persistence-render-lowering');
		} else {
			unevaluatedPolicies.add('persistence-render-lowering');
		}
	}
	const result = {
		files: entries.map((entry) => entry.file),
		policies: QWIK_GATE_POLICIES,
		violations,
	} as unknown as GateResult;
	Object.defineProperty(result, 'unevaluated', {
		enumerable: false,
		value: [...unevaluatedPolicies].map((policy) => ({
			policy,
			reason: 'requires-artifact',
		})),
	});
	return result;
}

export async function checkGeneratedFiles(
	options: { readonly cwd?: string; readonly directory?: string } = {},
): Promise<GateResult> {
	const cwd = resolve(options.cwd ?? PACKAGE_ROOT);
	const files = await discoverGeneratedFiles({ cwd, directory: options.directory });
	const entries = await Promise.all(
		files.map(async (file) => ({ file, source: await readFile(resolve(cwd, file), 'utf8') })),
	);
	return checkSources(entries, { cwd });
}
