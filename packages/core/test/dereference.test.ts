import { describe, expect, test } from 'vitest';

import RefProperties from './dereference/RefProperties.json';
import RootRef from './dereference/RootRef.json';

import { dereference } from '../src/dereference';
import { Reference, type JSONSchema } from '../src/types/JSONSchema';
import { assert } from '../src/utils';

describe('dereference', () => {
	test('root $ref', async () => {
		const schema = structuredClone(RootRef) as JSONSchema;
		const result = await dereference(schema, {
			$refOptions: {},
			cwd: __dirname + '/dereference/',
		});

		expect(result).toMatchInlineSnapshot(`
      {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "enum": [
          "a",
          "b",
          "c",
        ],
        "type": "string",
      }
    `);
	});

	test('$ref in properties', async () => {
		const schema = structuredClone(RefProperties) as JSONSchema;
		const result = await dereference(schema, {
			$refOptions: {},
			cwd: __dirname + '/dereference/',
		});

		expect(result).toMatchInlineSnapshot(`
			{
			  "$schema": "http://json-schema.org/draft-07/schema#",
			  "definitions": {
			    "internalEnum": {
			      "$id": "InternalEnum",
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
			  },
			  "type": "object",
			}
		`);

		assert(result.properties);
		expect(
			Object.entries(result.properties).map(([key, value]) => {
				return {
					key,
					$ref: value.$ref,
					reference: value[Reference],
				};
			})
		).toMatchInlineSnapshot(`
			[
			  {
			    "$ref": "#/definitions/internalEnum",
			    "key": "internalRefOnly",
			    "reference": {
			      "$id": "InternalEnum",
			      "enum": [
			        "value1",
			        "value2",
			        "value3",
			      ],
			      "type": "string",
			    },
			  },
			  {
			    "$ref": "#/definitions/internalEnum",
			    "key": "internalRefWithDefault",
			    "reference": {
			      "$id": "InternalEnum",
			      "enum": [
			        "value1",
			        "value2",
			        "value3",
			      ],
			      "type": "string",
			    },
			  },
			  {
			    "$ref": "./EnumSchema.json",
			    "key": "externalRefOnly",
			    "reference": {
			      "$id": "EnumSchema",
			      "$schema": "http://json-schema.org/draft-07/schema#",
			      "enum": [
			        "a",
			        "b",
			        "c",
			      ],
			    },
			  },
			  {
			    "$ref": "./EnumSchema.json",
			    "key": "externalRefWithDefault",
			    "reference": {
			      "$id": "EnumSchema",
			      "$schema": "http://json-schema.org/draft-07/schema#",
			      "enum": [
			        "a",
			        "b",
			        "c",
			      ],
			    },
			  },
			  {
			    "$ref": "./WithLocalRefs.json",
			    "key": "externalRefWithOwnRefs",
			    "reference": {
			      "$id": "WithLocalRefs",
			      "$schema": "http://json-schema.org/draft-07/schema#",
			      "definitions": {
			        "internalEnum": {
			          "enum": [
			            "x",
			            "y",
			            "z",
			          ],
			          "type": "string",
			        },
			      },
			      "properties": {
			        "field": {
			          "$ref": "#/definitions/internalEnum",
			        },
			      },
			      "type": "object",
			    },
			  },
			]
		`);
	});
});
