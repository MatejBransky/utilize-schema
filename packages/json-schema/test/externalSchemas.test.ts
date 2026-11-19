import { expect, test } from 'vitest';

import { type JSONSchema, Meta, parse, type ParsedJSONSchemaObject } from '../src';

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
		} as JSONSchema,
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
	const parsed = await parse({ $ref: 'https://example.com/bundle.json' } as JSONSchema, {
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
	});

	const bundle = parsed.root as ParsedJSONSchemaObject;
	const name = bundle.allOf?.[0] as ParsedJSONSchemaObject;

	expect(name[Meta].reference).toMatchObject({ type: 'string' });
});

test('indexes the draft-04 id keyword', async () => {
	const parsed = await parse({ $ref: 'https://example.com/bundle.json' } as JSONSchema, {
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
	});

	const bundle = parsed.root as ParsedJSONSchemaObject;
	const item = bundle.items as ParsedJSONSchemaObject;

	expect(item[Meta].reference).toMatchObject({ type: 'number' });
});
