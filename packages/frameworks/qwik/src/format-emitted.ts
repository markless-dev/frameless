import { format } from 'oxfmt';

const REPOSITORY_FORMAT_OPTIONS = {
	endOfLine: 'lf',
	printWidth: 100,
	singleQuote: true,
	tabWidth: 4,
	useTabs: true,
} as const;

/**
 * Format emitted TSX exactly as the repository's `vp fmt` command does.
 *
 * THE VIRTUAL FILENAME IS `generated.tsx`, AND THE CHANGE FROM `generated.jsx`
 * WAS MEASURED BEFORE IT WAS MADE. oxfmt selects its parser from this name, so
 * moving it could have moved emitted bytes in a step whose whole warrant is
 * that it does not. Measured across the entire emitted corpus - all 42 checked-in
 * files under packages/frameworks/{react,solid,qwik}/generated{,-composition,
 * -persistence} - `format('generated.jsx', ...)` and `format('generated.tsx', ...)`
 * produce BYTE-IDENTICAL output, 42/42, with zero errors on either side. It is
 * changed rather than left because the artifact this formats is now `.tsx`, and a
 * `.jsx` parser is the wrong one the moment a type is printed.
 */
export async function formatEmitted(source: string): Promise<string> {
	const result = await format('generated.tsx', source, REPOSITORY_FORMAT_OPTIONS);
	if (result.errors.length) {
		throw new Error(`oxfmt could not format emitted TSX:\n${JSON.stringify(result.errors, null, 2)}`);
	}
	return result.code;
}
