import { readFile } from 'node:fs/promises';

import { schemaModule, type MapperOptions } from './module';

interface PluginContext {
	addWatchFile?(id: string): void;
	error?(message: string): never;
}

/**
 * Vite/Rollup/Rolldown plugin that turns `.jsonschema` imports into the same
 * module the content mapper shows to TypeScript.
 */
export default function utilizeSchema(options: MapperOptions = {}) {
	return {
		name: 'utilize-schema',
		enforce: 'pre' as const,
		async load(this: PluginContext, id: string) {
			if (!id.endsWith('.jsonschema')) {
				return null;
			}

			const result = await schemaModule(id, await readFile(id, 'utf8'), options);

			if (result.diagnostics?.length) {
				this.error?.(`${id}: ${result.diagnostics[0]!.messageText}`);
			}

			return { code: result.text, map: null };
		},
	};
}
