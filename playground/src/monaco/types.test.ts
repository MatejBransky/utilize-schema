import { expect, test, vi } from 'vitest';

import { monaco, preloadEffectTypes } from './setup';

/**
 * The output editor resolves the imported `effect` module through the
 * declarations registered by `preloadEffectTypes()`. If that wiring breaks, the
 * generated code falls back to `any` and types in hover stop working, so
 * type-check a representative snippet with the real worker.
 */
test('the Effect Schema declarations resolve in the TypeScript worker', async () => {
	await preloadEffectTypes();

	const source = [
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
	].join('\n');
	const model = monaco.editor.createModel(
		source,
		'typescript',
		monaco.Uri.parse('file:///playground/effect-types.test.ts')
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
		const diagnostics = await client.getSemanticDiagnostics(model.uri.toString());

		expect(diagnostics.map((diagnostic) => diagnostic.messageText)).toEqual([]);

		const quickInfo = await client.getQuickInfoAtPosition(
			model.uri.toString(),
			source.indexOf('Address.Type')
		);
		const display = (quickInfo?.displayParts ?? [])
			.map((part: { text: string }) => part.text)
			.join('');

		expect(display).not.toBe('');
		expect(display).not.toContain('any');
	} finally {
		model.dispose();
	}
});
