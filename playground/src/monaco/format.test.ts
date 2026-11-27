import { generate as generateEffect } from '@utilize/effect';
import { assert, isJSONSchema, parse } from '@utilize/json-schema';
import type { JSONSchema, ParsedJSONSchema } from '@utilize/json-schema';
import { generate as generateTypeScript } from '@utilize/typescript';
import { generate as generateZod } from '@utilize/zod';
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
	const formatted = await formatTypeScript(generateEffect(root, { importEffect: true }));
	const lines = formatted.trimEnd().split('\n');

	expect(lines.length).toBeGreaterThan(10);

	for (const line of lines) {
		expect(line.length, line).toBeLessThanOrEqual(80);
	}
});

const separationSchema = {
	type: 'object',
	properties: {
		contact: { $ref: '#/$defs/Contact' },
		backupEmail: { type: 'string', format: 'email' },
	},
	$defs: {
		Contact: {
			type: 'object',
			properties: {
				email: { type: 'string', format: 'email' },
				website: { type: 'string', format: 'uri' },
				createdAt: { type: 'string', format: 'date-time' },
			},
			required: ['email'],
		},
	},
} satisfies JSONSchema;

const generators: {
	name: string;
	generate: (root: ParsedJSONSchema) => string;
}[] = [
	{ name: 'Zod', generate: (root) => generateZod(root, { importZod: true }) },
	{ name: 'Effect Schema', generate: (root) => generateEffect(root, { importEffect: true }) },
	{ name: 'TypeScript', generate: (root) => generateTypeScript(root) },
];

test.each(generators)(
	'$name separates generated top-level declarations with a blank line',
	async ({ generate }) => {
		// `parse` annotates the schema in place, so every generator gets its own copy.
		const { root } = await parse(structuredClone(separationSchema), {
			cwd: '/',
			fileName: 'schema.json',
		});
		const formatted = await formatTypeScript(generate(root));
		const lines = formatted.split('\n');
		const declarations = lines
			.map((line, index) => ({ line, index }))
			.filter(({ line }) => /^(?:const |export const |export interface )/.test(line));

		expect(declarations.length).toBeGreaterThan(1);

		for (const { line, index } of declarations.slice(1)) {
			expect(lines[index - 1], `Expected a blank line before "${line}".`).toBe('');
		}
	}
);

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
