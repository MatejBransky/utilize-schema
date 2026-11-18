import { parse } from '@utilize/json-schema';
import { generate } from '@utilize/zod';
import { expect, test } from 'vitest';

import './polyfills';

import { buildBundle, detectRootId, parseJsonFile, type SchemaFile } from './bundle';

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

test('reports foreign keywords as warnings by default', () => {
	const root = file('root', 'root.json', {
		$schema: 'http://json-schema.org/draft-07/schema#',
		type: 'array',
		prefixItems: [{ type: 'string' }],
	});

	const bundle = buildBundle([parseJsonFile(root)], 'root');

	expect(bundle.problems).toEqual([
		{
			fileId: 'root',
			severity: 'warning',
			message: expect.stringContaining('"prefixItems" is not part of draft-07'),
		},
	]);
});

test('reports foreign keywords as errors with keywordPolicy error', () => {
	const root = file('root', 'root.json', {
		$schema: 'http://json-schema.org/draft-07/schema#',
		type: 'array',
		prefixItems: [{ type: 'string' }],
	});

	const bundle = buildBundle([parseJsonFile(root)], 'root', 'error');

	expect(bundle.problems).toContainEqual(
		expect.objectContaining({
			fileId: 'root',
			severity: 'error',
			message: expect.stringContaining('"prefixItems" is not part of draft-07'),
		})
	);
});

test('reports foreign keywords as warnings with keywordPolicy warn', () => {
	const root = file('root', 'root.json', {
		$schema: 'http://json-schema.org/draft-07/schema#',
		type: 'array',
		prefixItems: [{ type: 'string' }],
	});

	const bundle = buildBundle([parseJsonFile(root)], 'root', 'warn');

	expect(bundle.problems).toEqual([
		{
			fileId: 'root',
			severity: 'warning',
			message: expect.stringContaining('"prefixItems" is not part of draft-07'),
		},
	]);
});

test('silently ignores foreign keywords with keywordPolicy ignore', () => {
	const root = file('root', 'root.json', {
		$schema: 'http://json-schema.org/draft-07/schema#',
		type: 'array',
		prefixItems: [{ type: 'string' }],
	});

	const bundle = buildBundle([parseJsonFile(root)], 'root', 'ignore');

	expect(bundle.problems).toEqual([]);
});

test('detectRootId picks the file that no other file references', () => {
	const files = [
		file('address', 'address.json', { type: 'object' }),
		file('person', 'person.json', {
			type: 'object',
			properties: { address: { $ref: './address.json' } },
		}),
	];

	expect(detectRootId(files)).toBe('person');
});

test('detectRootId resolves references between nested folders', () => {
	const files = [
		file('address', 'schemas/common/address.json', { type: 'object' }),
		file('person', 'schemas/person.json', {
			properties: { address: { $ref: './common/address.json' } },
		}),
	];

	expect(detectRootId(files)).toBe('person');
});

test('detectRootId prefers a schema file among unreferenced files', () => {
	const files = [
		file('readme', 'readme.json', { title: 'Read me' }),
		file('index', 'index.json', { $schema: 'http://json-schema.org/draft-07/schema#' }),
	];

	expect(detectRootId(files)).toBe('index');
});

test('detectRootId falls back to the file with the most outgoing references', () => {
	const files = [
		file('a', 'a.json', { properties: { b: { $ref: './b.json' } } }),
		file('b', 'b.json', { properties: { a: { $ref: './a.json' } } }),
		file('c', 'c.json', {
			properties: { a: { $ref: './a.json' }, b: { $ref: './b.json' } },
		}),
	];

	expect(detectRootId(files)).toBe('c');
});

test('detectRootId accepts invalid JSON files without failing', () => {
	const files: SchemaFile[] = [
		{ id: 'broken', name: 'broken.json', content: '{ nope' },
		file('address', 'address.json', { type: 'object' }),
	];

	expect(detectRootId(files)).toBe('address');
});
