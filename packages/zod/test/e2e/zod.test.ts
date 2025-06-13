import { describe, expect, test } from 'vitest';
import { z } from 'zod/v4';

const toJSONSchema = (schema: z.core.$ZodType) => {
	return z.toJSONSchema(schema, { target: 'draft-7' });
};

describe('Zod to JSON Schema', () => {
	test('Zod enum', () => {
		expect(toJSONSchema(z.enum(['foo', 'bar']))).toMatchInlineSnapshot(`
				{
				  "$schema": "http://json-schema.org/draft-07/schema#",
				  "enum": [
				    "foo",
				    "bar",
				  ],
				  "type": "string",
				}
			`);
	});

	test('Zod string', () => {
		expect(toJSONSchema(z.string())).toMatchInlineSnapshot(`
			{
			  "$schema": "http://json-schema.org/draft-07/schema#",
			  "type": "string",
			}
		`);
	});

	test('Zod number', () => {
		expect(toJSONSchema(z.number())).toMatchInlineSnapshot(`
      {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "type": "number",
      }
    `);
	});

	test('Zod integer', () => {
		expect(toJSONSchema(z.int())).toMatchInlineSnapshot(`
			{
			  "$schema": "http://json-schema.org/draft-07/schema#",
			  "maximum": 9007199254740991,
			  "minimum": -9007199254740991,
			  "type": "integer",
			}
		`);
	});

	test('Zod single literal', () => {
		expect(toJSONSchema(z.literal('foo'))).toMatchInlineSnapshot(`
			{
			  "$schema": "http://json-schema.org/draft-07/schema#",
			  "const": "foo",
			  "type": "string",
			}
		`);
	});

	test('Zod multiple literal values', () => {
		expect(toJSONSchema(z.literal(['foo', 'bar']))).toMatchInlineSnapshot(`
			{
			  "$schema": "http://json-schema.org/draft-07/schema#",
			  "enum": [
			    "foo",
			    "bar",
			  ],
			  "type": "string",
			}
		`);
	});

	test('Zod array', () => {
		expect(toJSONSchema(z.array(z.string()))).toMatchInlineSnapshot(`
      {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "items": {
          "type": "string",
        },
        "type": "array",
      }
    `);
	});

	test('Zod object with catchall', () => {
		expect(
			toJSONSchema(
				z
					.object({
						foobar: z.string(),
					})
					.catchall(z.number())
			)
		).toMatchInlineSnapshot(`
			{
			  "$schema": "http://json-schema.org/draft-07/schema#",
			  "additionalProperties": {
			    "type": "number",
			  },
			  "properties": {
			    "foobar": {
			      "type": "string",
			    },
			  },
			  "required": [
			    "foobar",
			  ],
			  "type": "object",
			}
		`);
	});

	test('Zod union of string and number', () => {
		expect(toJSONSchema(z.union([z.string(), z.number()])))
			.toMatchInlineSnapshot(`
      {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "anyOf": [
          {
            "type": "string",
          },
          {
            "type": "number",
          },
        ],
      }
    `);
	});

	test('Zod formats', () => {
		expect(
			toJSONSchema(
				z.object({
					date: z.string().datetime(),
					email: z.string().email(),
					url: z.string().url(),
					uuid: z.string().uuid(),
					ipv6: z.string().ipv6(),
				})
			)
		).toMatchInlineSnapshot(`
			{
			  "$schema": "http://json-schema.org/draft-07/schema#",
			  "additionalProperties": false,
			  "properties": {
			    "date": {
			      "format": "date-time",
			      "pattern": "^((\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\\d|3[01])|(0[469]|11)-(0[1-9]|[12]\\d|30)|(02)-(0[1-9]|1\\d|2[0-8])))T([01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(\\.\\d+)?(Z)$",
			      "type": "string",
			    },
			    "email": {
			      "format": "email",
			      "pattern": "^(?!\\.)(?!.*\\.\\.)([A-Za-z0-9_'+\\-\\.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9\\-]*\\.)+[A-Za-z]{2,}$",
			      "type": "string",
			    },
			    "ipv6": {
			      "format": "ipv6",
			      "pattern": "^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|::|([0-9a-fA-F]{1,4})?::([0-9a-fA-F]{1,4}:?){0,6})$",
			      "type": "string",
			    },
			    "url": {
			      "format": "uri",
			      "type": "string",
			    },
			    "uuid": {
			      "format": "uuid",
			      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000)$",
			      "type": "string",
			    },
			  },
			  "required": [
			    "date",
			    "email",
			    "url",
			    "uuid",
			    "ipv6",
			  ],
			  "type": "object",
			}
		`);
	});
});
