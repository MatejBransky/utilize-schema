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
});
