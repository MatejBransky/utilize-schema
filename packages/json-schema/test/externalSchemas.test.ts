import { expect, test } from 'vitest';

import { Meta, parse, indexExternalSchemas } from '../src';
import type { JSONSchema, ParsedJSONSchemaObject } from '../src';

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

	const user = (parsed.root as ParsedJSONSchemaObject).properties?.user as ParsedJSONSchemaObject;

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

	const root = parsed.root as ParsedJSONSchemaObject;
	const reference = root.properties?.bundle as ParsedJSONSchemaObject;
	const bundle = reference[Meta].reference as ParsedJSONSchemaObject;
	const name = bundle.allOf?.[0] as ParsedJSONSchemaObject;

	expect(name[Meta].reference).toMatchObject({ type: 'string' });
});

test('reports a nested identifier once when it is also referenced directly', async () => {
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
				'https://example.com/bundle.json': {
					$id: 'https://example.com/bundle.json',
					prefixItems: [{}],
					definitions: {
						name: { $id: 'https://example.com/name.json', prefixItems: [{}] },
					},
				} as unknown as JSONSchema,
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
		} as unknown as JSONSchema,
	});

	expect(index.has('https://example.com/enum.json')).toBe(false);
	expect(index.has('https://example.com/default.json')).toBe(false);
	expect(index.has('https://example.com/examples.json')).toBe(false);
});

test('indexes identifiers declared in schema positions', () => {
	const index = indexExternalSchemas({
		'https://example.com/bundle.json': {
			definitions: { name: { $id: 'https://example.com/name.json', type: 'string' } },
		} as unknown as JSONSchema,
	});

	expect(index.get('https://example.com/name.json')).toMatchObject({ type: 'string' });
});

test('resolves nested identifiers against the current base URI', () => {
	const index = indexExternalSchemas({
		'https://example.com/root/bundle.json': {
			definitions: {
				name: { $id: 'name.json', type: 'string' },
			},
		} as unknown as JSONSchema,
	});

	expect(index.get('https://example.com/root/name.json')).toMatchObject({ type: 'string' });
});

test('keeps explicit retrieval keys when a nested identifier resolves to the same URI', () => {
	const index = indexExternalSchemas({
		'https://example.com/bundle.json': {
			definitions: {
				name: { $id: 'https://example.com/shared.json', type: 'string' },
			},
		} as unknown as JSONSchema,
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
		} as unknown as JSONSchema,
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
		} as unknown as JSONSchema,
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
						legacy: {
							id: 'https://example.com/legacy.json',
							type: 'number',
						} as unknown as JSONSchema,
					},
					items: { $ref: 'https://example.com/legacy.json' },
				},
			},
		}
	);

	const root = parsed.root as ParsedJSONSchemaObject;
	const reference = root.properties?.bundle as ParsedJSONSchemaObject;
	const bundle = reference[Meta].reference as ParsedJSONSchemaObject;
	const item = bundle.items as ParsedJSONSchemaObject;

	expect(item[Meta].reference).toMatchObject({ type: 'number' });
});
