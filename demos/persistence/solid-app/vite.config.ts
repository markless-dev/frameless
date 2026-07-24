import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';

export default defineConfig({
	root: fileURLToPath(new URL('.', import.meta.url)),
	appType: 'mpa',
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
	plugins: [solid()],
});
