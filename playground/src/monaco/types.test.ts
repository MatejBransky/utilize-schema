import { generate as generateEffect } from '@utilize/effect';
import { assert, isJSONSchema, parse } from '@utilize/json-schema';
import type { JSONSchema } from '@utilize/json-schema';
import { formats } from '@utilize/json-schema/formats';
import { generate as generateZod } from '@utilize/zod';
import { expect, test, vi } from 'vitest';

import '../polyfills';

import { buildBundle, parseJsonFile } from '../bundle';
import { exampleById } from '../examples';
import { monaco, preloadEffectTypes } from './setup';

/**
 * The output editor resolves the imported `effect` module through the
 * declarations registered by `preloadEffectTypes()`. If that wiring breaks, the
 * generated code falls back to `any` and types in hover stop working, so
 * type-check representative snippets with the real worker.
 */
test('the Effect Schema declarations resolve in the TypeScript worker', async () => {
	const diagnostics = await typeCheck(
		[
			"import { Schema } from 'effect';",
			'',
			'export const Address = Schema.StructWithRest(',
			'	Schema.Struct({',
			'		street: Schema.String,',
			'		zip: Schema.optionalKey(Schema.String)',
			'	}),',
			'	[Schema.Record(Schema.String, Schema.Json)]',
			');',
			'',
			'export type Address = typeof Address.Type;',
			'',
		].join('\n')
	);

	expect(diagnostics).toEqual([]);
});

test('the recursive multi-file example type-checks', async () => {
	const example = exampleById('multi-file')!;
	const bundle = buildBundle(example.files.map(parseJsonFile), example.files[0].id);

	assert(isJSONSchema(bundle.root), 'Expected the bundled root to be a schema.');

	const { root } = await parse(bundle.root, {
		cwd: '/',
		fileName: bundle.rootFileName,
	});
	const code = generateEffect(root, { importEffect: true });

	expect(code).toContain('Schema.Codec<NodeValue>');

	const diagnostics = await typeCheck(code);

	expect(diagnostics.map((diagnostic) => diagnostic.messageText)).toEqual([]);
});

test('the format validator declarations resolve in the TypeScript worker', async () => {
	const properties: Record<string, JSONSchema> = {};

	for (const format of Object.keys(formats)) {
		properties[format] = { type: 'string', format };
	}

	const schema: JSONSchema = {
		title: 'FormatBenchmark',
		type: 'object',
		properties,
		required: ['email'],
	};

	const { root } = await parse(schema, { cwd: '/', fileName: 'Root.json' });

	const zodDiagnostics = await typeCheck(
		`${generateZod(root)}\nconst typeProbe: FormatBenchmark = { email: 1 };`
	);
	const effectDiagnostics = await typeCheck(
		`${generateEffect(root, { importEffect: true })}\nconst typeProbe: FormatBenchmark = { email: 1 };`
	);

	// If the module fell back to `any`, assigning a number to `email` would not fail.
	expect(zodDiagnostics.length).toBeGreaterThan(0);
	expect(effectDiagnostics.length).toBeGreaterThan(0);
});

async function typeCheck(source: string) {
	await preloadEffectTypes();

	const model = monaco.editor.createModel(
		source,
		'typescript',
		monaco.Uri.parse(`file:///playground/effect-types-${Date.now()}.test.ts`)
	);

	try {
		// The TypeScript worker is created when the language is first activated.
		monaco.editor.tokenize('const value = 1;', 'typescript');

		let worker!: Awaited<ReturnType<typeof monaco.typescript.getTypeScriptWorker>>;

		await vi.waitFor(
			async () => {
				worker = await monaco.typescript.getTypeScriptWorker();
			},
			{ timeout: 15_000 }
		);

		const client = await worker(model.uri);

		return await client.getSemanticDiagnostics(model.uri.toString());
	} finally {
		model.dispose();
	}
}
