import { assert, expect, test } from 'vitest';

import RefProperties from './RefProperties.json';

import { Meta, parse, type JSONSchema } from '../src';

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
	expect(parsed.root.properties?.externalRefOnly?.[Meta].parent)
		.toMatchInlineSnapshot(`
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
	expect(parsed.root.properties?.externalRefOnly?.[Meta].reference)
		.toMatchInlineSnapshot(`
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
