import { assert, isJSONSchema, parse } from '@utilize/json-schema';
import { generate } from '@utilize/zod';
import { expect, test } from 'vitest';

import '../polyfills';

import { buildBundle, parseJsonFile } from '../bundle';
import { exampleById } from '../examples';
import { rootDeclarationName } from '../generateCode';
import { loadModule, rootValidator, validateWithZod } from '../runtime';
import { monaco } from './setup';
import { emitJavaScript } from './transpile';

test('the TypeScript worker emits runnable JavaScript for generated code', async () => {
	const example = exampleById('object')!;
	const bundle = buildBundle(example.files.map(parseJsonFile), example.files[0].id);

	expect(bundle.problems).toEqual([]);
	assert(isJSONSchema(bundle.root), 'Expected the bundled root to be a schema.');

	const { root } = await parse(bundle.root, {
		cwd: '/',
		fileName: bundle.rootFileName,
	});
	const javascript = await emitJavaScript(generate(root, { importZod: true }));

	// Types are stripped; the module syntax is kept for `loadModule`.
	expect(javascript).not.toContain(': z.ZodType');
	expect(javascript).toContain('z.strictObject(');

	const module = await loadModule(javascript);
	const result = await validateWithZod(
		rootValidator(module, rootDeclarationName(root)!),
		example.cases[0].data
	);

	expect(result).toMatchObject({ ok: true, issues: [] });
});

test('transpiling restores the editor compiler options', async () => {
	const defaults = monaco.typescript.typescriptDefaults;

	expect(defaults.getCompilerOptions().noEmit).toBe(true);

	const javascript = await emitJavaScript('export const value: number = 1;');

	expect(javascript).toContain('value = 1');
	expect(defaults.getCompilerOptions().noEmit).toBe(true);
});
