import { parse } from '@utilize/json-schema';
import { generate } from '@utilize/zod';
import { expect, test } from 'vitest';

import './polyfills';

import { buildBundle, parseJsonFile, type SchemaFile } from './bundle';

function file(id: string, name: string, schema: unknown): SchemaFile {
	return { id, name, content: JSON.stringify(schema) };
}

test('keeps literal values under default unchanged', () => {
	const root = file('root', 'root.json', {
		type: 'object',
		properties: { child: { $ref: './child.json' } },
		default: { $ref: '#' },
	});
	const child = file('child', 'child.json', { type: 'string' });

	const bundle = buildBundle([parseJsonFile(root), parseJsonFile(child)], 'root');

	expect(bundle.problems).toEqual([]);
	expect(bundle.root).toMatchObject({ default: { $ref: '#' } });
});

test('keeps root definitions when imported files are added', () => {
	const root = file('root', 'root.json', {
		definitions: { Local: { type: 'string' } },
		type: 'object',
		properties: { child: { $ref: './child.json' } },
	});
	const child = file('child', 'child.json', { type: 'number' });

	const bundle = buildBundle([parseJsonFile(root), parseJsonFile(child)], 'root');

	expect(bundle.problems).toEqual([]);
	expect(bundle.root).toMatchObject({
		definitions: {
			Local: { type: 'string' },
			child: { type: 'number' },
		},
	});
});

test('percent-decodes JSON Pointer fragments', () => {
	const root = file('root', 'root.json', {
		definitions: { 'a b': { type: 'string' } },
		type: 'object',
		properties: { value: { $ref: '#/definitions/a%20b' } },
	});

	const bundle = buildBundle([parseJsonFile(root)], 'root');

	expect(bundle.problems).toEqual([]);
});

test('reports duplicate normalized file names', () => {
	const first = file('first', './person.json', { type: 'string' });
	const second = file('second', 'person.json', { type: 'number' });

	const bundle = buildBundle([parseJsonFile(first), parseJsonFile(second)], 'first');

	expect(bundle.problems.some((problem) => problem.message.includes('Duplicate file name'))).toBe(
		true
	);
});

test('generates a root schema that only contains a $ref', async () => {
	const root = file('root', 'root.json', { $ref: './child.json' });
	const child = file('child', 'child.json', { type: 'string' });

	const bundle = buildBundle([parseJsonFile(root), parseJsonFile(child)], 'root');
	expect(bundle.problems).toEqual([]);

	const parsed = await parse(bundle.root as never, {
		cwd: '/',
		fileName: bundle.rootFileName,
	});
	const code = generate(parsed.root, { importZod: true });

	expect(code).toContain('export const');
});
