import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

const appRoot = fileURLToPath(new URL('.', import.meta.url));
const clientEntry = fileURLToPath(new URL('./index.html', import.meta.url));
const serverEntry = fileURLToPath(new URL('./src/server-entry.tsx', import.meta.url));
const serverBundle = fileURLToPath(new URL('./dist/server/server.js', import.meta.url));
const clientHtml = fileURLToPath(new URL('./dist/client/index.html', import.meta.url));

function prerenderReact(): Plugin {
	return {
		name: 'frameless-react-prerender',
		buildApp: {
			order: 'post',
			async handler() {
				const { render, routes } = (await import(
					`${pathToFileURL(serverBundle).href}?build=${Date.now()}`
				)) as {
					render: (path: string) => string;
					routes: { path: string }[];
				};
				const template = await readFile(clientHtml, 'utf8');
				const root = '<div id="root"></div>';
				if (!template.includes(root)) {
					throw new Error(`React prerender root was not found in ${clientHtml}.`);
				}
				await writeFile(
					clientHtml,
					template.replace(root, `<div id="root">${render('/pricing-card')}</div>`),
				);
				for (const route of routes) {
					const routeDirectory = fileURLToPath(new URL(`./dist/client${route.path}/`, import.meta.url));
					await mkdir(routeDirectory, { recursive: true });
					await writeFile(
						fileURLToPath(new URL('./index.html', pathToFileURL(`${routeDirectory}/`))),
						template.replace(root, `<div id="root">${render(route.path)}</div>`),
					);
				}
			},
		},
	};
}

export default defineConfig({
	root: appRoot,
	appType: 'mpa',
	builder: {
		async buildApp(builder) {
			await builder.build(builder.environments.ssr);
			await builder.build(builder.environments.client);
		},
	},
	build: {
		outDir: 'dist/client',
		rolldownOptions: {
			output: {
				entryFileNames: 'client.js',
			},
		},
	},
	environments: {
		client: {
			build: {
				rolldownOptions: {
					input: clientEntry,
				},
			},
		},
		ssr: {
			consumer: 'server',
			build: {
				outDir: 'dist/server',
				copyPublicDir: false,
				rolldownOptions: {
					input: serverEntry,
					output: {
						entryFileNames: 'server.js',
					},
				},
			},
		},
	},
	plugins: [prerenderReact()],
});
