import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
	root: fileURLToPath(new URL('.', import.meta.url)),
	appType: 'mpa',
	oxc: {
		jsx: {
			runtime: 'automatic',
			importSource: 'react',
		},
	},
	build: {
		outDir: 'dist',
		rolldownOptions: {
			input: {
				index: fileURLToPath(new URL('./index.html', import.meta.url)),
				setup: fileURLToPath(new URL('./setup.html', import.meta.url)),
			},
			output: {
				entryFileNames: 'assets/framework-entry.js',
			},
		},
	},
});
