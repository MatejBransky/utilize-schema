import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, normalize, relative, sep } from 'node:path';
import { fileURLToPath, URL } from 'node:url';

import react from '@vitejs/plugin-react-swc';
import { defineConfig, type Plugin } from 'vite';

const require = createRequire(import.meta.url);
const zodRoot = dirname(require.resolve('zod/package.json'));
const effectRoot = dirname(require.resolve('effect/package.json'));

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

/** The Effect `Schema` module plus every declaration it imports, linked by specifier. */
function effectTypesPlugin(): Plugin {
	const virtualId = 'virtual:effect-types';
	const resolvedId = `\0${virtualId}`;

	return {
		name: 'utilize-effect-types',
		resolveId(id) {
			return id === virtualId ? resolvedId : undefined;
		},
		load(id) {
			if (id !== resolvedId) {
				return;
			}

			const files = collectDeclarations(join(effectRoot, 'dist/Schema.d.ts'), effectRoot);

			// The generated code imports `Schema` from the package root. Expose only
			// that module so the worker never has to load the whole `effect` barrel.
			files['index.d.ts'] = "export * as Schema from './dist/Schema.d.ts';\n";

			return `export default ${JSON.stringify(files)};`;
		},
	};
}

function collectDeclarations(entry: string, root: string): Record<string, string> {
	const files: Record<string, string> = {};
	const seen = new Set<string>();
	const queue = [entry];

	while (queue.length > 0) {
		const file = queue.pop()!;

		if (seen.has(file) || !existsSync(file)) {
			continue;
		}

		seen.add(file);

		const content = readFileSync(file, 'utf8')
			.replace(/(from\s+["'])(\.[^"']+)\.ts(["'])/g, '$1$2.d.ts$3')
			.replace(/(import\(\s*["'])(\.[^"']+)\.ts(["']\s*\))/g, '$1$2.d.ts$3');

		files[relative(root, file).split(sep).join('/')] = content;

		for (const match of content.matchAll(/(?:from|import)\s*\(?\s*["'](\.[^"']+)["']/g)) {
			queue.push(normalize(join(dirname(file), match[1])));
		}
	}

	return files;
}

export default defineConfig({
	// Relative assets so the same build works on GitHub Pages under /utilize-schema/.
	base: './',
	plugins: [react(), zodTypesPlugin(), effectTypesPlugin()],
	resolve: {
		alias: {
			'@utilize/zod': fileURLToPath(new URL('../packages/zod/src/generator.ts', import.meta.url)),
			'@utilize/effect': fileURLToPath(
				new URL('../packages/effect/src/generator.ts', import.meta.url)
			),
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
