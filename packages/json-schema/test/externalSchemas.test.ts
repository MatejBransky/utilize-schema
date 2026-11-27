import { assert, expect, test } from 'vitest';

import { isParsedJSONSchemaObject, Meta, parse, indexExternalSchemas } from '../src';
import type { JSONSchema, ParsedJSONSchemaObject } from '../src';

function parsedObject(value: unknown): ParsedJSONSchemaObject {
	assert(isParsedJSONSchemaObject(value));

	return value;
}

test('serves external schemas by retrieval URI', async () => {
	const externalSchemas = {
		'https://example.com/user.json': {
			type: 'object' as const,
			properties: { name: { type: 'string' as const } },
			required: ['name'],
		},
	};

	const parsed = await parse(
		{
			type: 'object',
			properties: { user: { $ref: 'https://example.com/user.json' } },
			required: ['user'],
		},
		{
			cwd: __dirname + '/',
			fileName: 'Root.json',
			externalSchemas,
		}
	);

	const root = parsedObject(parsed.root);
	const user = parsedObject(root.properties?.user);

	expect(user[Meta].reference).toMatchObject({
		type: 'object',
		properties: { name: { type: 'string' } },
	});
	expect(parsed.referencedSchemas).toHaveLength(1);
	// Parsing annotates its own copy, not the caller's documents.
	expect(
		Object.getOwnPropertySymbols(externalSchemas['https://example.com/user.json'])
	).toHaveLength(0);
});

test('serves a boolean external schema through $ref', async () => {
	const parsed = await parse(
		{ $ref: 'https://example.com/false.json' },
		{
			cwd: __dirname + '/',
			fileName: 'Root.json',
			externalSchemas: { 'https://example.com/false.json': false },
		}
	);

	if (!isParsedJSONSchemaObject(parsed.root)) {
		throw new TypeError('Expected the root document to be an object');
	}

	expect(parsed.root[Meta].reference).toBe(false);
	expect(parsed.referencedSchemas).toContain(false);
});

test('serves identifiers declared inside a provided document', async () => {
	const parsed = await parse(
		{
			type: 'object',
			properties: { bundle: { $ref: 'https://example.com/bundle.json' } },
		},
		{
			cwd: __dirname + '/',
			fileName: 'Root.json',
			externalSchemas: {
				'https://example.com/bundle.json': {
					definitions: {
						// A `$ref` may point at this URI directly, before - or without -
						// loading `bundle.json`.
						name: { $id: 'https://example.com/name.json', type: 'string' },
					},
					allOf: [{ $ref: 'https://example.com/name.json' }],
				},
			},
		}
	);

	const root = parsedObject(parsed.root);
	const reference = parsedObject(root.properties?.bundle);
	const bundle = parsedObject(reference[Meta].reference);
	const name = parsedObject(bundle.allOf?.[0]);

	expect(name[Meta].reference).toMatchObject({ type: 'string' });
});

test('serves a dynamic anchor declared inside a provided document', async () => {
	const parsed = await parse(
		{ $ref: 'https://example.com/bundle.json#name' },
		{
			cwd: __dirname + '/',
			fileName: 'Root.json',
			dialect: '2020-12',
			externalSchemas: {
				'https://example.com/bundle.json': {
					$defs: {
						name: Object.assign({ type: 'string' } satisfies JSONSchema, {
							$dynamicAnchor: 'name',
						}),
					},
				},
			},
		}
	);

	if (!isParsedJSONSchemaObject(parsed.root)) {
		throw new TypeError('Expected the root document to be an object');
	}

	expect(parsed.root[Meta].reference).toMatchObject({ type: 'string' });
});

test('reports a nested identifier once when it is also referenced directly', async () => {
	const bundle = Object.assign(
		{ $id: 'https://example.com/bundle.json', prefixItems: [{}] } satisfies JSONSchema,
		{
			definitions: {
				name: { $id: 'https://example.com/name.json', prefixItems: [{}] } satisfies JSONSchema,
			},
		}
	);
	const parsed = await parse(
		{
			allOf: [
				{ $ref: 'https://example.com/bundle.json' },
				{ $ref: 'https://example.com/name.json' },
			],
		},
		{
			cwd: __dirname + '/',
			fileName: 'Root.json',
			keywordPolicy: 'warn',
			externalSchemas: {
				'https://example.com/bundle.json': bundle,
			},
		}
	);

	expect(parsed.issues.map((issue) => issue.path.join('/'))).toEqual(['', 'definitions/name']);
	expect(parsed.referencedSchemas).toHaveLength(1);
});

test('does not index identifiers that live in schema data', () => {
	const index = indexExternalSchemas({
		'https://example.com/doc.json': {
			type: 'object',
			properties: {
				kind: { enum: [{ $id: 'https://example.com/enum.json', label: 'x' }] },
				fallback: { default: { $id: 'https://example.com/default.json' } },
				samples: { examples: [{ id: 'https://example.com/examples.json' }] },
			},
		} satisfies JSONSchema,
	});

	expect(index.has('https://example.com/enum.json')).toBe(false);
	expect(index.has('https://example.com/default.json')).toBe(false);
	expect(index.has('https://example.com/examples.json')).toBe(false);
});

test('indexes identifiers declared in schema positions', () => {
	const index = indexExternalSchemas({
		'https://example.com/bundle.json': {
			definitions: { name: { $id: 'https://example.com/name.json', type: 'string' } },
		} satisfies JSONSchema,
	});

	expect(index.get('https://example.com/name.json')).toMatchObject({ type: 'string' });
});

test('resolves nested identifiers against the current base URI', () => {
	const index = indexExternalSchemas({
		'https://example.com/root/bundle.json': {
			definitions: {
				name: { $id: 'name.json', type: 'string' },
			},
		} satisfies JSONSchema,
	});

	expect(index.get('https://example.com/root/name.json')).toMatchObject({ type: 'string' });
});

test('keeps explicit retrieval keys when a nested identifier resolves to the same URI', () => {
	const index = indexExternalSchemas({
		'https://example.com/bundle.json': {
			definitions: {
				name: { $id: 'https://example.com/shared.json', type: 'string' },
			},
		} satisfies JSONSchema,
		'https://example.com/shared.json': { type: 'number' },
	});

	expect(index.get('https://example.com/shared.json')).toMatchObject({ type: 'number' });
});

test('ignores identifiers next to a $ref in draft-07 and older', () => {
	const legacy = indexExternalSchemas({
		'https://example.com/bundle.json': {
			$schema: 'http://json-schema.org/draft-07/schema#',
			definitions: {
				sibling: { $ref: '#/definitions/name', $id: 'https://example.com/ignored.json' },
				name: { type: 'string' },
			},
		} satisfies JSONSchema,
	});

	expect(legacy.has('https://example.com/ignored.json')).toBe(false);

	// 2019-09 and newer apply the keywords next to `$ref`, so the identifier counts.
	const modern = indexExternalSchemas({
		'https://example.com/modern.json': {
			$schema: 'https://json-schema.org/draft/2020-12/schema',
			$defs: {
				sibling: { $ref: '#/$defs/name', $id: 'https://example.com/kept.json' },
				name: { type: 'string' },
			},
		} satisfies JSONSchema,
	});

	expect(modern.has('https://example.com/kept.json')).toBe(true);
});

test('indexes the draft-04 id keyword', async () => {
	const parsed = await parse(
		{
			type: 'object',
			properties: { bundle: { $ref: 'https://example.com/bundle.json' } },
		},
		{
			cwd: __dirname + '/',
			fileName: 'Root.json',
			externalSchemas: {
				'https://example.com/bundle.json': {
					definitions: {
						legacy: Object.assign({ type: 'number' } satisfies JSONSchema, {
							id: 'https://example.com/legacy.json',
						}),
					},
					items: { $ref: 'https://example.com/legacy.json' },
				},
			},
		}
	);

	const root = parsedObject(parsed.root);
	const reference = parsedObject(root.properties?.bundle);
	const bundle = parsedObject(reference[Meta].reference);
	const item = parsedObject(bundle.items);

	expect(item[Meta].reference).toMatchObject({ type: 'number' });
});

test('ignores a draft-04 sibling id while resolving an external ref', async () => {
	const parsed = await parse(
		{
			$schema: 'http://json-schema.org/draft-04/schema#',
			id: 'https://example.com/root.json',
			properties: {
				value: Object.assign({ $ref: 'integer.json' } satisfies JSONSchema, {
					id: 'https://example.com/missing/',
				}),
			},
		},
		{
			cwd: __dirname + '/',
			fileName: 'Root.json',
			dialect: 'draft-04',
			externalSchemas: { 'https://example.com/integer.json': { type: 'integer' } },
		}
	);

	const root = parsedObject(parsed.root);
	const value = parsedObject(root.properties?.value);

	expect(value[Meta].reference).toMatchObject({ type: 'integer' });
});

test('resolves external refs relative to a nested draft-04 id', async () => {
	const parsed = await parse(
		{
			$schema: 'http://json-schema.org/draft-04/schema#',
			id: 'https://example.com/root.json',
			items: Object.assign({ items: { $ref: 'integer.json' } } satisfies JSONSchema, {
				id: 'nested/',
			}),
		},
		{
			cwd: __dirname + '/',
			fileName: 'Root.json',
			dialect: 'draft-04',
			externalSchemas: {
				'https://example.com/nested/integer.json': { type: 'integer' },
			},
		}
	);

	const root = parsedObject(parsed.root);
	const nested = parsedObject(root.items);
	const item = parsedObject(nested.items);

	expect(item[Meta].reference).toMatchObject({ type: 'integer' });
	expect(root.$id).toBeUndefined();
	expect(nested.$id).toBeUndefined();
});
