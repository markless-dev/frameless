import { createHash } from 'node:crypto';
import { FRAMELESS_STATE_GLOBAL, type FramelessPersistenceRecord } from '@frameless/compiler';
import type { PersistenceArtifactRecord } from './receipts.ts';

export interface GeneratedPersistenceScript {
	readonly content: string;
	readonly contentSha256: string;
	readonly cspHash: string;
	readonly records: readonly PersistenceArtifactRecord[];
}

/**
 * Consolidate render-visible persistence records into one deterministic,
 * closed-form pre-paint script. Handler-only records produce no script.
 */
export function generatePrePaintPersistenceScript(
	records: readonly FramelessPersistenceRecord[],
): GeneratedPersistenceScript | undefined {
	const ordered = records
		.filter(
			(
				record,
			): record is FramelessPersistenceRecord & {
				readonly seed: Extract<
					FramelessPersistenceRecord['seed'],
					{ readonly lowering: 'pre-paint' }
				>;
			} => record.seed.lowering === 'pre-paint',
		)
		.sort(
			(left, right) =>
				compare(left.moduleId, right.moduleId) ||
				compare(left.key.literal, right.key.literal),
		);
	if (!ordered.length) return undefined;

	const state = `globalThis.${FRAMELESS_STATE_GLOBAL}`;
	const lines = ['(()=>{'];
	for (const source of ordered) {
		lines.push(
			'{',
			`(${state}??={});`,
			`let v=${literal(source.authoredInitial)};`,
			`try{v=localStorage.getItem(${literal(source.key.literal)})??${literal(source.authoredInitial)}}catch{}`,
			`${state}[${literal(source.key.literal)}]=v;`,
			`document.documentElement.setAttribute(${literal(source.antiFlashAttribute)},v)`,
			'}',
		);
	}
	lines.push('})();', '');
	const content = lines.join('\n');
	const digest = createHash('sha256').update(content).digest();

	return {
		content,
		contentSha256: digest.toString('hex'),
		cspHash: `sha256-${digest.toString('base64')}`,
		records: ordered.map((source) => ({
			graphNodeId: source.graphNodeId,
			moduleId: source.moduleId,
			resolvedKey: source.key.literal,
			landings: source.seed.landings,
		})),
	};
}

function literal(value: string): string {
	return JSON.stringify(value);
}

function compare(left: string, right: string): number {
	return left < right ? -1 : left > right ? 1 : 0;
}
