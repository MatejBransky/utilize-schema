import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';

import { schemaModule, type MapperOptions } from './module';

interface PluginContext {
	addWatchFile?(id: string): void;
	error?(message: string): never;
}

/** Vite appends `?t=<timestamp>` when it re-requests a module after a change. */
const RE_REQUEST_QUERY = /\?t=\d+$/;

/**
 * Vite/Rollup/Rolldown plugin that turns `.jsonschema` imports into the same
 * module the content mapper shows to TypeScript.
 */
export default function utilizeSchema(options: MapperOptions = {}) {
	return {
		name: 'utilize-schema',
		enforce: 'pre' as const,
		async load(this: PluginContext, id: string) {
			const reRequest = RE_REQUEST_QUERY.test(id);
			const file = reRequest ? id.slice(0, id.indexOf('?')) : id;

			// Other queries (`?raw`, `?url`, ...) belong to Vite's own plugins.
			if (!file.endsWith('.jsonschema')) {
				return null;
			}

			const result = await schemaModule(file, await readFile(file, 'utf8'), options);

			if (result.diagnostics?.length) {
				this.error?.(`${file}: ${result.diagnostics[0]!.messageText}`);
			}

			// The generated module depends on the files it resolved through `$ref`.
			for (const dependency of result.dependencies ?? []) {
				this.addWatchFile?.(dependency);
			}

			// The generators emit TypeScript declarations for the content mapper.
			// Bundlers only transform known script extensions, so a `.jsonschema`
			// module must reach them without type syntax.
			return { code: stripTypeScriptTypes(result.text), map: null };
		},
	};
}
