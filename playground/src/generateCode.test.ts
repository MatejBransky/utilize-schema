import { parse } from '@utilize/json-schema';
import { transformWithOxc } from 'vite';
import { expect, test } from 'vitest';

import './polyfills';

import { generateRuntimeCode } from './generateCode';
import { loadModule, validateModule } from './runtime';

test('each runtime validator exports its root under the name it chose', async () => {
	// Zod keeps the name `Schema`; Effect reserves it for its import.
	const schema = { title: 'Schema', type: 'string', minLength: 2 };
	const runtime = await generateRuntimeCode(
		async () =>
			(await parse(structuredClone(schema) as never, { cwd: '/', fileName: 'schema.json' })).root
	);

	for (const target of ['zod', 'effect'] as const) {
		const source = runtime[target];

		if (source.status !== 'generated' || !source.rootName) {
			throw new Error(`The ${target} validator was not generated.`);
		}

		const { code: javascript } = await transformWithOxc(source.code, 'schema.ts');
		const module = await loadModule(javascript);

		expect(validateModule(target, module, source.rootName, 'ok'), target).toMatchObject({
			ok: true,
		});
		const rejected = validateModule(target, module, source.rootName, 'x');

		expect(rejected.error, target).toBeUndefined();
		expect(rejected.ok, target).toBe(false);
	}

	expect(runtime.zod).toMatchObject({ rootName: 'Schema' });
	expect(runtime.effect).toMatchObject({ rootName: 'Schema1' });
});
