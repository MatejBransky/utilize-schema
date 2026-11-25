import { assert, expect, test } from 'vitest';

import RefProperties from './RefProperties.json';

import { Meta, parse } from '../src';
import type { JSONSchema, ParsedJSONSchemaObject } from '../src';

test('parser', async () => {
	const parsed = await parse(RefProperties as JSONSchema, {
		cwd: __dirname + '/',
		fileName: 'RefProperties.json',
	});

	expect(parsed.root).toMatchInlineSnapshot(`
		{
		  "$schema": "http://json-schema.org/draft-07/schema#",
		  "definitions": {
		    "internalEnum": {
		      "enum": [
		        "value1",
		        "value2",
		        "value3",
		      ],
		      "type": "string",
		    },
		  },
		  "properties": {
		    "externalRefOnly": {
		      "$ref": "./EnumSchema.json",
		    },
		    "externalRefWithDefault": {
		      "$ref": "./EnumSchema.json",
		      "default": "value1",
		    },
		    "externalRefWithOwnRefs": {
		      "$ref": "./WithLocalRefs.json",
		    },
		    "internalRefOnly": {
		      "$ref": "#/definitions/internalEnum",
		    },
		    "internalRefWithDefault": {
		      "$ref": "#/definitions/internalEnum",
		      "default": "value1",
		    },
		    "luarc": {
		      "$ref": "https://www.schemastore.org/luaurc.json",
		    },
		  },
		  "type": "object",
		}
	`);

	assert(
		typeof parsed.root === 'object' && parsed.root !== null,
		'Meta should be defined on root schema'
	);

	expect(parsed.root[Meta].parent).toBeNull();
	expect(parsed.root[Meta].path).toEqual([]);
	expect(parsed.root.properties?.externalRefOnly?.[Meta].parent).toMatchInlineSnapshot(`
			{
			  "externalRefOnly": {
			    "$ref": "./EnumSchema.json",
			  },
			  "externalRefWithDefault": {
			    "$ref": "./EnumSchema.json",
			    "default": "value1",
			  },
			  "externalRefWithOwnRefs": {
			    "$ref": "./WithLocalRefs.json",
			  },
			  "internalRefOnly": {
			    "$ref": "#/definitions/internalEnum",
			  },
			  "internalRefWithDefault": {
			    "$ref": "#/definitions/internalEnum",
			    "default": "value1",
			  },
			  "luarc": {
			    "$ref": "https://www.schemastore.org/luaurc.json",
			  },
			}
		`);
	expect(parsed.root.properties?.externalRefOnly?.[Meta].reference).toMatchInlineSnapshot(`
		{
		  "$schema": "http://json-schema.org/draft-07/schema#",
		  "enum": [
		    "a",
		    "b",
		    "c",
		  ],
		}
	`);
});

test('a property named $ref is not treated as a reference', async () => {
	const schema: JSONSchema = {
		type: 'object',
		properties: {
			$ref: { type: 'string' },
		},
		required: ['$ref'],
	};
	const parsed = await parse(schema, {
		cwd: __dirname + '/',
		fileName: 'Unknown',
	});

	assert(typeof parsed.root === 'object' && parsed.root !== null);
	expect(parsed.root.properties?.$ref?.[Meta].reference).toBeUndefined();
});

test('links sibling definitions when the root is a $ref', async () => {
	const schema: JSONSchema = {
		$ref: '#/$defs/Child',
		$defs: { Child: { type: 'string' } },
	};
	const parsed = await parse(schema, {
		cwd: __dirname + '/',
		fileName: 'Unknown',
	});

	assert(typeof parsed.root === 'object' && parsed.root !== null);
	const defs = (parsed.root as { $defs?: Record<string, ParsedJSONSchemaObject> }).$defs;
	expect(defs?.Child?.[Meta]).toBeDefined();
});

test('links tuple items with numeric paths and their array parent', async () => {
	const schema: JSONSchema = {
		type: 'array',
		items: [{ type: 'string' }, { type: 'number' }],
	};
	const parsed = await parse(schema, {
		cwd: __dirname + '/',
		fileName: 'Unknown',
	});

	assert(typeof parsed.root === 'object' && parsed.root !== null);
	const items = parsed.root.items;
	assert(Array.isArray(items));
	expect(items[0]?.[Meta]).toMatchObject({ path: ['items', 0], parent: items });
	expect(items[1]?.[Meta]).toMatchObject({ path: ['items', 1], parent: items });
});

test('circular references', async () => {
	const schema: JSONSchema = {
		type: 'object',
		properties: {
			self: { $ref: '#' },
		},
	};
	const parsed = await parse(schema, {
		cwd: __dirname + '/',
		fileName: 'Unknown',
	});

	expect(parsed.root).toMatchInlineSnapshot(`
    {
      "properties": {
        "self": {
          "$ref": "#",
        },
      },
      "type": "object",
    }
  `);

	assert(
		typeof parsed.root === 'object' && parsed.root !== null,
		'Meta should be defined on root schema'
	);

	expect(parsed.root.properties?.self?.[Meta]).toMatchInlineSnapshot(`
		{
		  "dialect": "draft-07",
		  "dialectSource": "fallback",
		  "fileName": "Unknown",
		  "filePath": "#",
		  "isCircular": true,
		  "parent": {
		    "self": {
		      "$ref": "#",
		    },
		  },
		  "path": [
		    "properties",
		    "self",
		  ],
		  "reference": {
		    "properties": {
		      "self": {
		        "$ref": "#",
		      },
		    },
		    "type": "object",
		  },
		}
	`);
});

test('resolves a $ref to a fragment-only $id', async () => {
	const schema = {
		allOf: [{ $ref: '#foo' }],
		definitions: {
			A: { $id: '#foo', type: 'integer' },
		},
	} as JSONSchema;
	const parsed = await parse(schema, { cwd: __dirname + '/', fileName: 'Unknown' });

	assert(typeof parsed.root === 'object' && parsed.root !== null);
	const reference = parsed.root.allOf?.[0]?.[Meta].reference;

	assert(typeof reference === 'object' && reference !== null);
	expect(reference.type).toBe('integer');
});

test('indexes identifiers in schema children but not annotation values', async () => {
	const schema = {
		definitions: {
			A: { $id: '#foo', type: 'integer' },
		},
		default: { $id: '#foo', type: 'string' },
		examples: [{ $id: '#foo', type: 'boolean' }],
		dependencies: { a: ['b'] },
		allOf: [{ $ref: '#foo' }],
	} as JSONSchema;
	const parsed = await parse(schema, { cwd: __dirname + '/', fileName: 'Unknown' });

	assert(typeof parsed.root === 'object' && parsed.root !== null);
	const reference = parsed.root.allOf?.[0]?.[Meta].reference;

	assert(typeof reference === 'object' && reference !== null);
	expect(reference.type).toBe('integer');
});

test('resolves a $ref against the nearest $id', async () => {
	const schema = {
		$id: 'http://example.com/root/',
		properties: {
			value: { $ref: 'nested/child.json' },
		},
		definitions: {
			child: { $id: 'nested/child.json', type: 'string' },
		},
	} as JSONSchema;
	const parsed = await parse(schema, { cwd: __dirname + '/', fileName: 'Unknown' });

	assert(typeof parsed.root === 'object' && parsed.root !== null);
	const reference = parsed.root.properties?.value?.[Meta].reference;

	assert(typeof reference === 'object' && reference !== null);
	expect(reference.type).toBe('string');
});

test('resolves a $ref to an $anchor', async () => {
	const schema = {
		$id: 'https://example.com/schema',
		$defs: {
			A: { $anchor: 'foo', type: 'boolean' },
		},
		allOf: [{ $ref: '#foo' }],
	} as JSONSchema;
	const parsed = await parse(schema, { cwd: __dirname + '/', fileName: 'Unknown' });

	assert(typeof parsed.root === 'object' && parsed.root !== null);
	const reference = parsed.root.allOf?.[0]?.[Meta].reference;

	assert(typeof reference === 'object' && reference !== null);
	expect(reference.type).toBe('boolean');
});

test('resolves an anchor declared under a nested $id', async () => {
	const schema = {
		$id: 'http://localhost:1234/root',
		allOf: [{ $ref: 'http://localhost:1234/nested.json#foo' }],
		definitions: {
			A: {
				$id: 'nested.json',
				definitions: {
					B: { $id: '#foo', type: 'integer' },
				},
			},
		},
	} as JSONSchema;
	const parsed = await parse(schema, { cwd: __dirname + '/', fileName: 'Unknown' });

	assert(typeof parsed.root === 'object' && parsed.root !== null);
	const reference = parsed.root.allOf?.[0]?.[Meta].reference;

	assert(typeof reference === 'object' && reference !== null);
	expect(reference.type).toBe('integer');
});

test('resolves a URN reference to its resource', async () => {
	const schema = {
		$id: 'urn:uuid:deadbeef-1234-ffff-ffff-4321feebdaed',
		type: 'number',
		definitions: { unused: { type: 'string' } },
		allOf: [{ $ref: 'urn:uuid:deadbeef-1234-ffff-ffff-4321feebdaed' }],
	} as JSONSchema;
	const parsed = await parse(schema, { cwd: __dirname + '/', fileName: 'Unknown' });

	assert(typeof parsed.root === 'object' && parsed.root !== null);
	expect(parsed.root.allOf?.[0]?.[Meta].reference).toBe(parsed.root);
});

test('resolves a $ref against a sibling $id in 2020-12', async () => {
	const schema = {
		$schema: 'https://json-schema.org/draft/2020-12/schema',
		$id: 'http://example.com/root.json',
		properties: {
			value: { $id: 'http://example.com/nested/', $ref: 'item.json' },
		},
		$defs: {
			root: { $id: 'http://example.com/item.json', type: 'string' },
			nested: { $id: 'http://example.com/nested/item.json', type: 'integer' },
		},
	} as JSONSchema;
	const parsed = await parse(schema, { cwd: __dirname + '/', fileName: 'Unknown' });

	assert(typeof parsed.root === 'object' && parsed.root !== null);
	const reference = parsed.root.properties?.value?.[Meta].reference;

	assert(typeof reference === 'object' && reference !== null);
	expect(reference.type).toBe('integer');
});

test('ignores a sibling $id of a $ref in draft-07', async () => {
	const schema = {
		$schema: 'http://json-schema.org/draft-07/schema#',
		$id: 'http://example.com/root.json',
		properties: {
			value: { $id: 'http://example.com/nested/', $ref: 'item.json' },
		},
		definitions: {
			root: { $id: 'http://example.com/item.json', type: 'string' },
			nested: { $id: 'http://example.com/nested/item.json', type: 'integer' },
		},
	} as JSONSchema;
	const parsed = await parse(schema, { cwd: __dirname + '/', fileName: 'Unknown' });

	assert(typeof parsed.root === 'object' && parsed.root !== null);
	const reference = parsed.root.properties?.value?.[Meta].reference;

	assert(typeof reference === 'object' && reference !== null);
	expect(reference.type).toBe('string');
});

test('resolves draft-04 id identifiers', async () => {
	const schema = {
		$schema: 'http://json-schema.org/draft-04/schema#',
		id: 'http://example.com/root.json',
		properties: {
			byUri: { $ref: 'item.json' },
			byFragment: { $ref: '#flag' },
		},
		definitions: {
			item: { id: 'item.json', type: 'integer' },
			flag: { id: '#flag', type: 'boolean' },
		},
	} as JSONSchema;
	const parsed = await parse(schema, { cwd: __dirname + '/', fileName: 'Unknown' });

	assert(typeof parsed.root === 'object' && parsed.root !== null);
	const byUri = parsed.root.properties?.byUri?.[Meta].reference;
	const byFragment = parsed.root.properties?.byFragment?.[Meta].reference;

	assert(typeof byUri === 'object' && byUri !== null);
	assert(typeof byFragment === 'object' && byFragment !== null);
	expect(byUri.type).toBe('integer');
	expect(byFragment.type).toBe('boolean');
});

test('resolves a JSON pointer against the embedded resource that contains it', async () => {
	const schema = {
		$id: 'http://example.com/root.json',
		definitions: {
			a: { type: 'string' },
			nested: {
				$id: 'http://example.com/nested.json',
				definitions: {
					a: { type: 'integer' },
				},
				properties: {
					value: { $ref: '#/definitions/a' },
				},
			},
		},
	} as JSONSchema;
	const parsed = await parse(schema, { cwd: __dirname + '/', fileName: 'Unknown' });

	assert(typeof parsed.root === 'object' && parsed.root !== null);
	const nested = parsed.root.definitions?.nested;

	assert(typeof nested === 'object' && nested !== null);
	expect(nested.properties?.value?.[Meta].reference).toBe(nested.definitions?.a);
});

test('resolves a JSON pointer after an $id URI', async () => {
	const schema = {
		$id: 'http://example.com/root.json',
		properties: {
			value: { $ref: 'other.json#/definitions/b' },
		},
		definitions: {
			other: {
				$id: 'other.json',
				definitions: {
					b: { type: 'boolean' },
				},
			},
		},
	} as JSONSchema;
	const parsed = await parse(schema, { cwd: __dirname + '/', fileName: 'Unknown' });

	assert(typeof parsed.root === 'object' && parsed.root !== null);
	const other = parsed.root.definitions?.other;

	assert(typeof other === 'object' && other !== null);
	expect(parsed.root.properties?.value?.[Meta].reference).toBe(other.definitions?.b);
});

test('resolves a JSON pointer relative to the referenced file that contains it', async () => {
	const schema = {
		properties: {
			item: { $ref: './resources/item.json' },
		},
	} as JSONSchema;
	const parsed = await parse(schema, {
		cwd: __dirname + '/CrossFilePointer/',
		fileName: 'root.json',
	});

	assert(typeof parsed.root === 'object' && parsed.root !== null);
	const item = parsed.root.properties?.item?.[Meta].reference;

	assert(typeof item === 'object' && item !== null);
	const types = parsed.referencedSchemas.find(
		(referenced) => typeof referenced === 'object' && referenced !== null && referenced !== item
	);

	assert(typeof types === 'object' && types !== null);
	expect(item.properties?.location?.[Meta].reference).toBe(types.definitions?.location);
});

test('decodes escaped tokens in a JSON pointer', async () => {
	// The definitions live in an embedded resource, so only the identifier index
	// can resolve them; the `$RefParser` fallback would look in the root.
	const schema = {
		$id: 'http://example.com/root.json',
		definitions: {
			nested: {
				$id: 'http://example.com/nested.json',
				definitions: {
					'tilde~field': { type: 'string' },
					'slash/field': { type: 'integer' },
					'percent%field': { type: 'boolean' },
				},
				properties: {
					tilde: { $ref: '#/definitions/tilde~0field' },
					slash: { $ref: '#/definitions/slash~1field' },
					percent: { $ref: '#/definitions/percent%25field' },
				},
			},
		},
	} as JSONSchema;
	const parsed = await parse(schema, { cwd: __dirname + '/', fileName: 'Unknown' });

	assert(typeof parsed.root === 'object' && parsed.root !== null);
	const nested = parsed.root.definitions?.nested;

	assert(typeof nested === 'object' && nested !== null);
	expect(nested.properties?.tilde?.[Meta].reference).toBe(nested.definitions?.['tilde~field']);
	expect(nested.properties?.slash?.[Meta].reference).toBe(nested.definitions?.['slash/field']);
	expect(nested.properties?.percent?.[Meta].reference).toBe(nested.definitions?.['percent%field']);
});

test('a $ref to a boolean schema keeps the boolean as its reference', async () => {
	const schema = {
		type: 'object',
		properties: {
			allowed: { $ref: '#/$defs/allowed' },
			denied: { $ref: '#/$defs/denied' },
		},
		$defs: { allowed: true, denied: false },
	} as unknown as JSONSchema;
	const parsed = await parse(schema, {
		cwd: __dirname + '/',
		fileName: 'Unknown',
	});

	assert(typeof parsed.root === 'object' && parsed.root !== null);
	expect(parsed.root.properties?.allowed?.[Meta].reference).toBe(true);
	expect(parsed.root.properties?.denied?.[Meta].reference).toBe(false);
});

test('keeps the document root when it is a $ref', async () => {
	const schema = {
		$ref: '#/definitions/name',
		title: 'Root title',
		definitions: { name: { type: 'string' } },
	} as unknown as JSONSchema;
	const parsed = await parse(schema, { cwd: __dirname + '/', fileName: 'Root.json' });

	assert(typeof parsed.root === 'object' && parsed.root !== null);
	expect(parsed.root[Meta]).toMatchObject({ parent: null, fileName: 'Root.json', path: [] });
	expect(parsed.root.$ref).toBe('#/definitions/name');
	expect(parsed.root[Meta].reference).toMatchObject({ type: 'string' });
	expect(parsed.get('#')).toMatchObject({ type: 'string' });
	// The root document is not an external schema.
	expect(parsed.referencedSchemas).toEqual([]);
});

test('get("#") resolves a root pointer and returns the target document for a file reference', async () => {
	const localPointer = await parse(
		{
			$ref: '#/definitions/name',
			title: 'Root title',
			definitions: { name: { type: 'string' } },
		} as unknown as JSONSchema,
		{ cwd: __dirname + '/', fileName: 'Root.json' }
	);

	expect(localPointer.get('#')).toMatchObject({ type: 'string' });

	const fileReference = await parse(
		{ $ref: './EnumSchema.json', title: 'Doc' },
		{
			cwd: __dirname + '/',
			fileName: 'Root.json',
		}
	);

	assert(typeof fileReference.root === 'object' && fileReference.root !== null);
	expect(fileReference.root[Meta].reference).toMatchObject({ enum: ['a', 'b', 'c'] });
	// `#` resolves to the root of the referenced document, not to its `$ref`.
	expect(fileReference.get('#')).toMatchObject({ title: 'Doc' });
});

test('parses a boolean root schema', async () => {
	const parsed = await parse(true, { cwd: __dirname + '/', fileName: 'Root.json' });

	expect(parsed.root).toBe(true);
	expect(parsed.referencedSchemas).toEqual([]);
});
