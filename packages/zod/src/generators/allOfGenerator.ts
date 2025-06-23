import type { ParsedJSONSchemaObject } from '@utilize/json-schema';

import { createGenerator } from './createGenerator';
import { generateSchema } from './generateSchema';

import { NEWLINE, ts } from '../utils';

export const generator = createGenerator<
	ParsedJSONSchemaObject & {
		allOf: ParsedJSONSchemaObject[];
	}
>(
	(schema) => Array.isArray(schema.allOf),
	(schema, context) => {
		if (schema.allOf.length === 0) {
			return ts`z.never()`;
		}

		if (schema.allOf.length > 2) {
			throw new Error('Intersection of more than two schemas is not supported');
		}

		if (schema.allOf.length === 1 && schema.allOf[0]) {
			return generateSchema(schema.allOf[0], context);
		}

		const subschemas = schema.allOf.map((subschema) =>
			generateSchema(subschema, context)
		);

		return ts`z.intersection(${subschemas.join(`,${NEWLINE}`)})`;
	}
);
