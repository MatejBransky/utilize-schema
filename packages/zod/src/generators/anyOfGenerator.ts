import type { ParsedJSONSchemaObject } from '@utilize/json-schema';

import { createGenerator } from './createGenerator';
import type { ExpressionGenerator } from './createGenerator';

import { ts } from '../utils';

export type AnyOfSchema = ParsedJSONSchemaObject & {
	anyOf: ParsedJSONSchemaObject[];
};

export const anyOfGenerator: ExpressionGenerator = createGenerator<AnyOfSchema>(
	(schema): schema is AnyOfSchema => Array.isArray(schema.anyOf),
	(schema, context, { generateSchema }) => {
		const subschemas = schema.anyOf.map((subschema) => generateSchema(subschema, context));

		return ts`z.union([${subschemas.join(', ')}])`;
	}
);
