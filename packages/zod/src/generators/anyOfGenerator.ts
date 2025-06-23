import type { ParsedJSONSchemaObject } from '@utilize/json-schema';

import { createGenerator } from './createGenerator';
import { generateSchema } from './generateSchema';

import { ts } from '../utils';

export const generator = createGenerator<
	ParsedJSONSchemaObject & {
		anyOf: ParsedJSONSchemaObject[];
	}
>(
	(schema) => Array.isArray(schema.anyOf),
	(schema, context) => {
		const subschemas = schema.anyOf.map((subschema) =>
			generateSchema(subschema, context)
		);

		return ts`z.union([${subschemas.join(', ')}])`;
	}
);
