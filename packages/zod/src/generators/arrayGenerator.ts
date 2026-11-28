import type { ParsedJSONSchemaObject } from '@utilize/json-schema';

import { createGenerator } from './createGenerator';
import type { ExpressionGenerator } from './createGenerator';

import { ts } from '../utils';

export type ArraySchema = ParsedJSONSchemaObject & { type: 'array' };

export const arrayGenerator: ExpressionGenerator = createGenerator<ArraySchema>(
	(schema, dialect): schema is ArraySchema => {
		if (schema.type !== 'array') {
			return false;
		}

		return dialect.tuple === 'prefixItems'
			? schema.prefixItems === undefined
			: !Array.isArray(schema.items);
	},
	(schema, context, { generateSchema }) => {
		const items = Array.isArray(schema.items) ? undefined : schema.items;
		const itemsPart = generateSchema(items, context);
		let expression = ts`z.array(${itemsPart})`;

		if (schema.minItems !== undefined) {
			expression = ts`${expression}.min(${schema.minItems})`;
		}
		if (schema.maxItems !== undefined) {
			expression = ts`${expression}.max(${schema.maxItems})`;
		}

		return expression;
	}
);
