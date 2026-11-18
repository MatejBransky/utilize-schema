import { assert, expect, test } from 'vitest';

import RefProperties from './RefProperties.json';

import { Meta, parse, type JSONSchema, type ParsedJSONSchemaObject } from '../src';

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
