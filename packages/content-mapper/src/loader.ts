// fallow-ignore-file coverage-gaps -- the Node loader is only reached in the spawned mapper process; the integration tests exercise it end to end

import { readFile } from 'node:fs/promises';
import type { LoadHook } from 'node:module';
import { fileURLToPath } from 'node:url';

import { isTarget, schemaModule } from './module';

const extension = '.jsonschema';

/**
 * Async ESM load hooks for Node. The generated module is returned as
 * `module-typescript`; Node 24 strips the annotations.
 */
export const load: LoadHook = async (url, context, nextLoad) => {
	if (!url.endsWith(extension)) {
		return nextLoad(url, context);
	}

	const target = process.env.UTILIZE_SCHEMA_TARGET ?? 'zod';

	if (!isTarget(target)) {
		throw new Error(
			`UTILIZE_SCHEMA_TARGET is "${target}"; expected "zod", "effect" or "typescript".`
		);
	}

	if (target === 'typescript') {
		throw new Error(
			'The "typescript" target is types-only and has no runtime module; use "zod" or "effect" for a runtime import.'
		);
	}

	const fileName = fileURLToPath(url);
	const content = await readFile(fileName, 'utf8');
	const result = await schemaModule(fileName, content, { target });
	const diagnostic = result.diagnostics?.[0];

	if (diagnostic) {
		throw new Error(`${fileName}: ${diagnostic.messageText}`);
	}

	return {
		format: 'module-typescript',
		source: result.text,
		shortCircuit: true,
	};
};
