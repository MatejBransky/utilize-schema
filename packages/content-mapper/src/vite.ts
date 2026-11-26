import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';

import { schemaModule } from './module';
import type { MapperOptions } from './module';

export interface PluginContext {
	addWatchFile?(id: string): void;
	error?(message: string): never;
}

/**
 * Queries that ask Vite's own plugins for something other than the module
 * (`?raw` for the text, `?url` for the asset URL, ...). Every other query, such
 * as `?t=<timestamp>` after a change, `?v=<hash>` for optimised deps or
 * `?import`, still asks for the module itself.
 */
const VITE_QUERIES = new Set([
	'raw',
	'url',
	'inline',
	'no-inline',
	'worker',
	'sharedworker',
	'init',
]);

/**
 * The `.jsonschema` file a module id asks for, without its query, or
 * `undefined` when the id is another file or a query Vite handles itself.
 */
function schemaFile(id: string): string | undefined {
	const [file = id, query = ''] = id.split('?', 2);
	const keys = [...new URLSearchParams(query).keys()];

	if (!file.endsWith('.jsonschema') || keys.some((key) => VITE_QUERIES.has(key))) {
		return undefined;
	}

	return file;
}

/**
 * Vite/Rollup/Rolldown plugin that turns `.jsonschema` imports into the same
 * module the content mapper shows to TypeScript.
 */
export default function utilizeSchema(options: MapperOptions = {}) {
	if ((options.target ?? 'zod') === 'typescript') {
		throw new Error(
			'The "typescript" target is types-only and has no runtime module; use "zod" or "effect" for the Vite plugin.'
		);
	}

	return {
		name: 'utilize-schema',
		enforce: 'pre' as const,
		async load(this: PluginContext, id: string) {
			const file = schemaFile(id);

			if (file === undefined) {
				return null;
			}

			const result = await schemaModule(file, await readFile(file, 'utf8'), options);
			const diagnostic = result.diagnostics?.[0];

			if (diagnostic) {
				const message = `${file}: ${diagnostic.messageText}`;

				if (this.error) {
					this.error(message);
				} else {
					throw new Error(message);
				}
			}

			// The generated module depends on the files it resolved through `$ref`.
			for (const dependency of result.dependencies ?? []) {
				this.addWatchFile?.(dependency);
			}

			// The generators emit TypeScript declarations for the content mapper.
			// Bundlers only transform known script extensions, so a `.jsonschema`
			// module must reach them without type syntax.
			//
			// `stripTypeScriptTypes` is still experimental in Node 24 (it prints an
			// `ExperimentalWarning` once per process) and throws on syntax that
			// cannot be erased, such as `enum` or parameter properties. The
			// generators emit only erasable syntax; the "every target" test in
			// `test/vite.test.ts` fails if one of them starts emitting more.
			return { code: stripTypeScriptTypes(result.text), map: null };
		},
	};
}
