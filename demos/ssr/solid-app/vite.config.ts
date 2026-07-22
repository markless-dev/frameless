import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import solid from 'vite-plugin-solid';

const appRoot = fileURLToPath(new URL('.', import.meta.url));
const clientEntry = fileURLToPath(new URL('./index.html', import.meta.url));
const serverEntry = fileURLToPath(new URL('./src/server-entry.tsx', import.meta.url));
const serverBundle = fileURLToPath(new URL('./dist/server/server.js', import.meta.url));
const clientHtml = fileURLToPath(new URL('./dist/client/index.html', import.meta.url));

function solidByEnvironment(): Plugin[] {
	const server = solid({
		ssr: true,
		solid: { generate: 'ssr', hydratable: true },
	});
	server.name = 'solid:ssr';
	server.applyToEnvironment = (environment) => environment.name === 'ssr';

	const client = solid({ solid: { generate: 'dom', hydratable: true } });
	client.name = 'solid:client';
	client.applyToEnvironment = (environment) => environment.name === 'client';

	return [server, client];
}

function prerenderSolid(): Plugin {
	return {
		name: 'frameless-solid-prerender',
		buildApp: {
			order: 'post',
			async handler() {
				const { render, routes } = (await import(
					`${pathToFileURL(serverBundle).href}?build=${Date.now()}`
				)) as {
					render: (path: string) => { markup: string; hydrationScript: string };
					routes: { path: string }[];
				};
				const template = await readFile(clientHtml, 'utf8');
				const root = '<div id="root"></div>';
				if (!template.includes(root)) {
					throw new Error(`Solid prerender root was not found in ${clientHtml}.`);
				}
				if (!template.includes('</head>')) {
					throw new Error(`Solid prerender head was not found in ${clientHtml}.`);
				}
				const prerender = (path: string) => {
					const { markup, hydrationScript } = render(path);
					return template
						.replace('</head>', `\t\t${hydrationScript}\n\t</head>`)
						.replace(root, `<div id="root">${markup}</div>`);
				};
				await writeFile(clientHtml, prerender('/pricing-card'));
				for (const route of routes) {
					const routeDirectory = fileURLToPath(new URL(`./dist/client${route.path}/`, import.meta.url));
					await mkdir(routeDirectory, { recursive: true });
					await writeFile(
						fileURLToPath(new URL('./index.html', pathToFileURL(`${routeDirectory}/`))),
						prerender(route.path),
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
			resolve: { conditions: ['browser'] },
			build: {
				rolldownOptions: {
					input: clientEntry,
				},
			},
		},
		ssr: {
			consumer: 'server',
			resolve: { conditions: ['node'] },
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
	plugins: [...solidByEnvironment(), prerenderSolid()],
});
