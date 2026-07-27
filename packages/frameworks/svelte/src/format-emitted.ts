/**
 * The Svelte lane has NO formatter, and that divergence from the other three
 * adapters is deliberate.
 *
 * React, Solid and Qwik all pipe emitted `.jsx` through `oxfmt` with the
 * repository's own options. No formatter in this workspace can parse a
 * `.svelte` file, and adding `prettier` + `prettier-plugin-svelte` was ruled out
 * for T003. The emitter therefore prints deterministic text directly, and this
 * function is an ASSERTION over that text rather than a rewrite: it returns its
 * input unchanged and throws when the emitter's determinism claim is false.
 *
 * The claims are the ones a formatter would otherwise be relied on for, and each
 * one is a shape that has actually gone wrong in generated output somewhere:
 * CRLF sneaking in (defects-and-targets defect 3 cause B), trailing whitespace,
 * space indentation surviving the yuku-codegen tab conversion, and a missing or
 * doubled final newline.
 */
export function formatEmitted(source: string): string {
	if (source.includes('\r'))
		throw new Error('Emitted Svelte source must use LF line endings');
	if (!source.endsWith('\n') || source.endsWith('\n\n'))
		throw new Error('Emitted Svelte source must end with exactly one newline');
	const lines = source.split('\n');
	for (const [index, line] of lines.entries()) {
		if (/[\t ]$/.test(line))
			throw new Error(`Emitted Svelte source has trailing whitespace on line ${index + 1}`);
		if (/^\t* +/.test(line))
			throw new Error(`Emitted Svelte source indents with spaces on line ${index + 1}`);
	}
	return source;
}
