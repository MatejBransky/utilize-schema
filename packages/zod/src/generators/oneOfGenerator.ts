import type { ParsedJSONSchemaObject } from '@utilize/json-schema';

import { createGenerator } from './createGenerator';
import { composedSchemaParts, generateSchema } from './generateSchema';
import { generator as objectGenerator } from './objectGenerator';
import { selectGenerator } from './selectGenerator';

import { ts } from '../utils';

export const generator = createGenerator<
	ParsedJSONSchemaObject & {
		oneOf: ParsedJSONSchemaObject[];
		discriminator?: string;
	}
>(
	(schema) => Array.isArray(schema.oneOf),
	(schema, context) => {
		const subschemas = schema.oneOf.map((subschema) => generateSchema(subschema, context));

		const discriminable = schema.oneOf.every(
			(subschema) =>
				typeof subschema === 'object' &&
				subschema !== null &&
				selectGenerator(subschema) === objectGenerator &&
				composedSchemaParts(subschema) === undefined
		);

		if (schema.discriminator && discriminable) {
			return ts`z.discriminatedUnion('${schema.discriminator}', [${subschemas.join(', ')}])`;
		}

		if (subschemas.length === 0) {
			return ts`z.never()`;
		}

		if (subschemas.length === 1) {
			return subschemas[0]!;
		}

		// `oneOf` matches exactly one branch, while `z.union()` accepts a value
		// that matches several. The branches are repeated to count the matches.
		const options = `[${subschemas.join(', ')}]`;

		return ts`z.union(${options}).superRefine((value, ctx) => {
  const matches = ${options}.filter((option) => option.safeParse(value).success).length;

  if (matches !== 1) {
    ctx.addIssue({
      code: 'custom',
      message: 'Value must match exactly one "oneOf" schema.',
      path: [],
    });
  }
})`;
	}
);
