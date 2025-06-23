import type { ParsedJSONSchemaObject } from '@utilize/json-schema';

import { createGenerator } from './createGenerator';
import { generateSchema } from './generateSchema';

import { ts } from '../utils';

export const generator = createGenerator<
	ParsedJSONSchemaObject & {
		oneOf: ParsedJSONSchemaObject[];
		discriminator?: string;
	}
>(
	(schema) => Array.isArray(schema.oneOf),
	(schema, context) => {
		const subschemas = schema.oneOf.map((subschema) =>
			generateSchema(subschema, context)
		);

		if (schema.discriminator) {
			return ts`z.discriminatedUnion('${schema.discriminator}', [${subschemas.join(', ')}])`;
		}

		return ts`z.union([${subschemas.join(', ')}])`;
	}
);
