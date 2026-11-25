import { parse } from '@utilize/json-schema';
import { generate } from '@utilize/zod';
import { expect, test } from 'vitest';

import '../polyfills';

import { buildBundle, parseJsonFile } from '../bundle';
import { exampleById } from '../examples';
import { rootDeclarationName } from '../generateCode';
import { loadModule, rootValidator, validateWithZod } from '../runtime';
import { emitJavaScript } from './transpile';

test('the TypeScript worker emits runnable JavaScript for generated code', async () => {
	const example = exampleById('object')!;
	const bundle = buildBundle(example.files.map(parseJsonFile), example.files[0].id);

	expect(bundle.problems).toEqual([]);

	const { root } = await parse(bundle.root as never, {
		cwd: '/',
		fileName: bundle.rootFileName,
	});
	const javascript = await emitJavaScript(generate(root, { importZod: true }));

	// Types are stripped; the module syntax is kept for `loadModule`.
	expect(javascript).not.toContain(': z.ZodType');
	expect(javascript).toContain('z.strictObject(');

	const module = await loadModule(javascript);
	const result = validateWithZod(
		rootValidator(module, rootDeclarationName(root)!),
		example.cases[0].data
	);

	expect(result).toMatchObject({ ok: true, issues: [] });
});
