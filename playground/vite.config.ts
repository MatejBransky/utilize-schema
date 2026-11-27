import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath, URL } from 'node:url';

import { defineConfig } from 'vite';
import type { Plugin } from 'vite';

import { formatConstantBase, formatNames } from '../packages/json-schema/src/formatName.ts';
import { collectDeclarations } from './src/viteDeclarations.ts';

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

/**
 * The generated code imports the shared format validators. Monaco needs their
 * declarations too; derive them from the real map so a new validator cannot
 * leave the editor falling back to `any`.
 */
function jsonSchemaFormatsTypesPlugin(): Plugin {
	const virtualId = 'virtual:json-schema-formats-types';
	const resolvedId = `\0${virtualId}`;

	return {
		name: 'utilize-json-schema-formats-types',
		resolveId(id) {
			return id === virtualId ? resolvedId : undefined;
		},
		load(id) {
			if (id !== resolvedId) {
				return;
			}

			const entries = formatNames.map((format) => ({
				format,
				name: formatConstantBase(format),
			}));
			const functions = entries
				.map(({ name }) => `\texport function ${name}(value: string): boolean;`)
				.join('\n');
			const map = entries
				.map(({ format, name }) => `\t\t${JSON.stringify(format)}: typeof ${name};`)
				.join('\n');
			const source = [
				"declare module '@utilize/json-schema/formats' {",
				'\texport type FormatValidator = (value: string) => boolean;',
				functions,
				'\texport const formats: {',
				map,
				'\t};',
				'}',
				'',
			].join('\n');

			return `export default ${JSON.stringify(source)};`;
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

export default defineConfig({
	// Relative assets so the same build works on GitHub Pages under /utilize-schema/.
	base: './',
	build: {
		rolldownOptions: {
			input: {
				main: fileURLToPath(new URL('index.html', import.meta.url)),
				notFound: fileURLToPath(new URL('404.html', import.meta.url)),
			},
		},
	},
	// Keep worker code splitting so the validator can load only the selected
	// Zod or Effect runtime instead of inlining both into an IIFE worker bundle.
	worker: { format: 'es' },
	plugins: [zodTypesPlugin(), jsonSchemaFormatsTypesPlugin(), effectTypesPlugin()],
	resolve: {
		alias: {
			'@utilize/zod': fileURLToPath(new URL('../packages/zod/src/generator.ts', import.meta.url)),
			'@utilize/effect': fileURLToPath(
				new URL('../packages/effect/src/generator.ts', import.meta.url)
			),
			'@utilize/typescript': fileURLToPath(
				new URL('../packages/typescript/src/generator.ts', import.meta.url)
			),
			'@utilize/json-schema/formats': fileURLToPath(
				new URL('../packages/json-schema/src/formats.ts', import.meta.url)
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
