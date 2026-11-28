import { expectDefined } from '@utilize/json-schema';
import type { ParsedJSONSchemaObject } from '@utilize/json-schema';

import { createGenerator } from './createGenerator';
import type { ExpressionGenerator } from './createGenerator';

import { NEWLINE, ts } from '../utils';

export type AllOfSchema = ParsedJSONSchemaObject & {
	allOf: ParsedJSONSchemaObject[];
};

export const allOfGenerator: ExpressionGenerator = createGenerator<AllOfSchema>(
	(schema): schema is AllOfSchema => Array.isArray(schema.allOf),
	(schema, context, { generateSchema }) => {
		if (schema.allOf.length === 0) {
			return ts`z.never()`;
		}

		if (schema.allOf.length === 1 && schema.allOf[0]) {
			return generateSchema(schema.allOf[0], context);
		}

		const [first, ...rest] = schema.allOf.map((subschema) => generateSchema(subschema, context));

		return rest.reduce(
			(expression, next) => ts`z.intersection(${expression},${NEWLINE}${next})`,
			expectDefined(first)
		);
	}
);
