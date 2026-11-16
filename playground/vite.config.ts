import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath, URL } from 'node:url';

import react from '@vitejs/plugin-react-swc';
import { defineConfig, type Plugin } from 'vite';

const require = createRequire(import.meta.url);
const zodRoot = dirname(require.resolve('zod/package.json'));

function zodTypesPlugin(): Plugin {
	const virtualId = 'virtual:zod-types';
	const resolvedId = `\0${virtualId}`;

	return {
		name: 'utilize-zod-types',
		resolveId(id) {
			return id === virtualId ? resolvedId : undefined;
		},
		load(id) {
			if (id !== resolvedId) {
				return;
			}

			const files: Record<string, string> = {};
			const walk = (directory: string) => {
				for (const entry of readdirSync(directory, { withFileTypes: true })) {
					const file = join(directory, entry.name);

					if (entry.isDirectory()) {
						walk(file);
					} else if (entry.name.endsWith('.d.ts')) {
						files[relative(zodRoot, file).split(sep).join('/')] = readFileSync(file, 'utf8');
					}
				}
			};

			walk(zodRoot);

			return `export default ${JSON.stringify(files)};`;
		},
	};
}

export default defineConfig({
	// Relative assets so the same build works on GitHub Pages under /utilize-schema/.
	base: './',
	plugins: [react(), zodTypesPlugin()],
	resolve: {
		alias: {
			'@utilize/zod': fileURLToPath(new URL('../packages/zod/src/generator.ts', import.meta.url)),
			'@utilize/json-schema': fileURLToPath(
				new URL('../packages/json-schema/src/index.ts', import.meta.url)
			),
			path: require.resolve('path-browserify'),
		},
	},
	server: {
		fs: {
			allow: [fileURLToPath(new URL('..', import.meta.url))],
		},
	},
});
