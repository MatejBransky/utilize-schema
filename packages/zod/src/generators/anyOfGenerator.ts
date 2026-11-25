import type { ParsedJSONSchemaObject } from '@utilize/json-schema';

import { createGenerator } from './createGenerator';

import { ts } from '../utils';

export const generator = createGenerator<
	ParsedJSONSchemaObject & {
		anyOf: ParsedJSONSchemaObject[];
	}
>(
	(schema) => Array.isArray(schema.anyOf),
	(schema, context, { generateSchema }) => {
		const subschemas = schema.anyOf.map((subschema) => generateSchema(subschema, context));

		return ts`z.union([${subschemas.join(', ')}])`;
	}
);
