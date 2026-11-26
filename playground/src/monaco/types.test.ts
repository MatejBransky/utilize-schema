import { generate } from '@utilize/effect';
import { assert, isJSONSchema, parse } from '@utilize/json-schema';
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
	const code = generate(root, { importEffect: true });

	expect(code).toContain('Schema.Codec<NodeValue>');

	const diagnostics = await typeCheck(code);

	expect(diagnostics.map((diagnostic) => diagnostic.messageText)).toEqual([]);
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
