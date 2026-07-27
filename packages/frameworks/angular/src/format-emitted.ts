/**
 * The Angular lane has NO formatter, and the reason is different from the Vue and
 * Svelte lanes' - which makes it worth stating rather than inheriting.
 *
 * Vue and Svelte have no formatter because nothing in this workspace parses a
 * `.vue` or `.svelte` file. Angular emits `.ts`, which `oxfmt` parses perfectly
 * well - but `oxfmt` is a dependency of the react, solid and qwik packages and is
 * NOT resolvable from `packages/frameworks/angular`, and adding it would move
 * `pnpm-lock.yaml`, which is an explicit T003 stop_if. The emitter therefore
 * prints deterministic text directly in the repository's own style (tabs, single
 * quotes, LF), and this function is an ASSERTION over that text rather than a
 * rewrite: it returns its input unchanged and throws when the emitter's
 * determinism claim is false.
 *
 * The claims are the ones a formatter would otherwise be relied on for, and each
 * one is a shape that has actually gone wrong in generated output somewhere in
 * this repo: CRLF sneaking in (defects-and-targets defect 3 cause B), trailing
 * whitespace, space indentation surviving the yuku-codegen tab conversion, and a
 * missing or doubled final newline.
 */
export function formatEmitted(source: string): string {
	if (source.includes('\r')) throw new Error('Emitted Angular source must use LF line endings');
	if (!source.endsWith('\n') || source.endsWith('\n\n'))
		throw new Error('Emitted Angular source must end with exactly one newline');
	const lines = source.split('\n');
	for (const [index, line] of lines.entries()) {
		if (/[\t ]$/.test(line))
			throw new Error(`Emitted Angular source has trailing whitespace on line ${index + 1}`);
		if (/^\t* +/.test(line))
			throw new Error(`Emitted Angular source indents with spaces on line ${index + 1}`);
	}
	return source;
}
