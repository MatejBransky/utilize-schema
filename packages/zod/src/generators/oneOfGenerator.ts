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

		return ts`z.union([${subschemas.join(', ')}])`;
	}
);
