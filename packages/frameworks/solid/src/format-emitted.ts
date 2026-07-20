import { format } from 'oxfmt';

const REPOSITORY_FORMAT_OPTIONS = {
	endOfLine: 'lf',
	printWidth: 100,
	singleQuote: true,
	tabWidth: 4,
	useTabs: true,
} as const;

/** Format emitted JSX exactly as the repository's `vp fmt` command does. */
export async function formatEmitted(source: string): Promise<string> {
	const result = await format('generated.jsx', source, REPOSITORY_FORMAT_OPTIONS);
	if (result.errors.length) {
		throw new Error(`oxfmt could not format emitted JSX:\n${JSON.stringify(result.errors, null, 2)}`);
	}
	return result.code;
}
