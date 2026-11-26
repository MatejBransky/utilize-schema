import { generate } from '@utilize/effect';
import { assert, isJSONSchema, parse } from '@utilize/json-schema';
import { expect, test } from 'vitest';

import '../polyfills';

import { buildBundle, parseJsonFile } from '../bundle';
import { exampleById } from '../examples';

import { formatTypeScript } from './format';

test('wraps the generated multi-file example at 80 columns', async () => {
	const example = exampleById('multi-file')!;
	const bundle = buildBundle(example.files.map(parseJsonFile), example.files[0].id);

	assert(isJSONSchema(bundle.root), 'Expected the bundled root to be a schema.');

	const { root } = await parse(bundle.root, {
		cwd: '/',
		fileName: bundle.rootFileName,
	});
	const formatted = await formatTypeScript(generate(root, { importEffect: true }));
	const lines = formatted.trimEnd().split('\n');

	expect(lines.length).toBeGreaterThan(10);

	for (const line of lines) {
		expect(line.length, line).toBeLessThanOrEqual(80);
	}
});

test('keeps the generated code parseable', async () => {
	const source = [
		"import { Schema } from 'effect';",
		'',
		'type NodeValue = { value: string; children?: ReadonlyArray<NodeValue> };',
		'',
		'export const Node: Schema.Codec<NodeValue> = Schema.StructWithRest(Schema.Struct({ value: Schema.String }), [Schema.Record(Schema.String, Schema.Json)]);',
		'',
		'export type Node = typeof Node.Type;',
		'',
	].join('\n');

	const formatted = await formatTypeScript(source);

	expect(formatted).toContain('export const Node: Schema.Codec<NodeValue>');
	expect(formatted).toContain('export type Node = typeof Node.Type;');
});

test('returns empty code unchanged', async () => {
	expect(await formatTypeScript('   ')).toBe('   ');
});
