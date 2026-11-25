import { parse } from '@utilize/json-schema';
import { generate } from '@utilize/zod';
import { expect, test } from 'vitest';

import './polyfills';

import { buildBundle, detectRootId, parseJsonFile } from './bundle';
import type { SchemaFile } from './bundle';

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

test('normalizes a draft-04 schema only once with keywordPolicy error', async () => {
	const root = file('root', 'root.json', {
		$schema: 'http://json-schema.org/draft-04/schema#',
		type: 'number',
		minimum: 0,
		exclusiveMinimum: true,
	});
	const parsedFiles = [parseJsonFile(root)];

	const first = buildBundle(parsedFiles, 'root', 'error');
	const second = buildBundle(parsedFiles, 'root', 'error');

	expect(first.problems).toEqual([]);
	expect(second.problems).toEqual([]);
	expect(parsedFiles[0].schema).toMatchObject({ exclusiveMinimum: true });

	const parsed = await parse(second.root as never, {
		cwd: '/',
		fileName: second.rootFileName,
		keywordPolicy: 'error',
	});

	expect(generate(parsed.root, { importZod: true })).toContain('.gt(0)');
});

test('reports foreign keywords in a referenced file that inherits the root dialect', () => {
	const root = file('root', 'root.json', {
		$schema: 'http://json-schema.org/draft-07/schema#',
		$ref: './child.json',
	});
	const child = file('child', 'child.json', {
		type: 'object',
		unevaluatedProperties: false,
	});

	const bundle = buildBundle([parseJsonFile(root), parseJsonFile(child)], 'root');

	expect(bundle.problems).toEqual([
		{
			fileId: 'child',
			severity: 'warning',
			message: expect.stringContaining('"unevaluatedProperties" is not part of draft-07'),
		},
	]);
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

test('rewrites refs in every schema-bearing keyword without changing literal data', () => {
	const root = file('root', 'root.json', {
		type: 'object',
		definitions: { value: { type: 'string' } },
		properties: { value: { $ref: '#/definitions/value' } },
		patternProperties: { '^x': { $ref: '#/definitions/value' } },
		dependencies: {
			value: ['name'],
			name: { properties: { value: { $ref: '#/definitions/value' } } },
		},
		items: [{ $ref: '#/definitions/value' }],
		additionalItems: { $ref: '#/definitions/value' },
		contains: { $ref: '#/definitions/value' },
		additionalProperties: { $ref: '#/definitions/value' },
		propertyNames: { $ref: '#/definitions/value' },
		if: { $ref: '#/definitions/value' },
		then: { $ref: '#/definitions/value' },
		else: { $ref: '#/definitions/value' },
		allOf: [{ $ref: '#/definitions/value' }],
		anyOf: [{ $ref: '#/definitions/value' }],
		oneOf: [{ $ref: '#/definitions/value' }],
		not: { $ref: '#/definitions/value' },
		default: { $ref: '#/definitions/value' },
	});
	const parsed = parseJsonFile(root);

	const bundle = buildBundle([parsed], 'root');

	expect(bundle.problems).toEqual([]);
	expect(bundle.root).toMatchObject({
		properties: { value: { $ref: '#/definitions/value' } },
		patternProperties: { '^x': { $ref: '#/definitions/value' } },
		dependencies: {
			value: ['name'],
			name: { properties: { value: { $ref: '#/definitions/value' } } },
		},
		items: [{ $ref: '#/definitions/value' }],
		additionalItems: { $ref: '#/definitions/value' },
		contains: { $ref: '#/definitions/value' },
		additionalProperties: { $ref: '#/definitions/value' },
		propertyNames: { $ref: '#/definitions/value' },
		if: { $ref: '#/definitions/value' },
		then: { $ref: '#/definitions/value' },
		else: { $ref: '#/definitions/value' },
		allOf: [{ $ref: '#/definitions/value' }],
		anyOf: [{ $ref: '#/definitions/value' }],
		oneOf: [{ $ref: '#/definitions/value' }],
		not: { $ref: '#/definitions/value' },
		default: { $ref: '#/definitions/value' },
	});
});

test('prefixes local refs in imported files with their allocated definition key', () => {
	const root = file('root', 'root.json', { $ref: './child.json' });
	const child = file('child', 'child.json', {
		definitions: { local: { type: 'string' } },
		properties: { value: { $ref: '#/definitions/local' } },
	});

	const bundle = buildBundle([parseJsonFile(root), parseJsonFile(child)], 'root');

	expect(bundle.problems).toEqual([]);
	expect(bundle.keyByFile.get('child')).toBe('child');
	expect(bundle.root).toMatchObject({
		$defs: {
			child: { properties: { value: { $ref: '#/$defs/child/definitions/local' } } },
		},
	});
});

test('reports unresolved local refs and malformed or out-of-range pointers', () => {
	const root = file('root', 'root.json', {
		type: 'array',
		items: [{ type: 'string' }],
		allOf: [{ $ref: '#/missing' }, { $ref: '#/items/2' }, { $ref: '#/%E0%A4%A' }],
	});

	const bundle = buildBundle([parseJsonFile(root)], 'root');

	expect(bundle.problems).toEqual([
		{ fileId: 'root', severity: 'error', message: 'Unresolved $ref "#/missing".' },
		{ fileId: 'root', severity: 'error', message: 'Unresolved $ref "#/items/2".' },
		{ fileId: 'root', severity: 'error', message: 'Unresolved $ref "#/%E0%A4%A".' },
	]);
});

test('accepts escaped pointer segments, root pointers, and identifier fragments', () => {
	const root = file('root', 'root.json', {
		definitions: { 'a/b~c': { type: 'string' } },
		allOf: [
			{ $ref: '#/definitions/a~1b~0c' },
			{ $ref: '#' },
			{ $ref: '#/' },
			{ $ref: '#named-anchor' },
		],
	});

	const bundle = buildBundle([parseJsonFile(root)], 'root');

	expect(bundle.problems).toEqual([]);
});

test('reports missing external files and pointers while leaving remote refs unchanged', () => {
	const root = file('root', 'root.json', {
		allOf: [
			{ $ref: './missing.json' },
			{ $ref: './child.json#/missing' },
			{ $ref: 'https://example.com/schema.json#/missing' },
		],
	});
	const child = file('child', 'child.json', { type: 'string' });

	const bundle = buildBundle([parseJsonFile(root), parseJsonFile(child)], 'root');

	expect(bundle.problems).toEqual([
		{
			fileId: 'root',
			severity: 'error',
			message: 'Unresolved $ref "./missing.json": no file named "missing.json".',
		},
		{
			fileId: 'root',
			severity: 'error',
			message: 'Unresolved $ref "./child.json#/missing": target pointer does not exist.',
		},
	]);
	expect(bundle.root).toMatchObject({
		allOf: [
			{ $ref: './missing.json' },
			{ $ref: '#/$defs/child/missing' },
			{ $ref: 'https://example.com/schema.json#/missing' },
		],
	});
});

test('allocates unique definition keys and warns when a non-object root imports files', () => {
	const root = file('root', 'root.json', true);
	const first = file('first', 'schemas/shared.json', { type: 'string' });
	const second = file('second', 'other/shared.json', { type: 'number' });

	const bundle = buildBundle(
		[parseJsonFile(root), parseJsonFile(first), parseJsonFile(second)],
		'root'
	);

	expect(bundle.keyByFile).toEqual(
		new Map([
			['first', 'shared'],
			['second', 'shared_2'],
		])
	);
	expect(bundle.problems).toEqual([
		{
			fileId: 'root',
			severity: 'warning',
			message: 'The root schema must be an object to include references to other files.',
		},
	]);
});

test('returns an empty bundle when the selected root has no schema', () => {
	const broken = parseJsonFile({ id: 'broken', name: 'broken.json', content: '{' });
	const valid = parseJsonFile(file('valid', 'valid.json', { type: 'string' }));

	const bundle = buildBundle([broken, valid], 'missing');

	expect(bundle).toEqual({
		root: null,
		rootFileName: 'schema.json',
		problems: broken.problems,
		keyByFile: new Map(),
	});
});
