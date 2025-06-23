import type { ParsedJSONSchemaObject } from '@utilize/json-schema';

import { createGenerator } from './createGenerator';
import { generateSchema } from './generateSchema';

import { ts } from '../utils';

export const generator = createGenerator<
	ParsedJSONSchemaObject & { items: ParsedJSONSchemaObject }
>(
	(schema) => {
		if (schema.type === 'array' && !Array.isArray(schema.items)) {
			return true;
		}

		return false;
	},
	(schema, context) => {
		const itemsPart = generateSchema(schema.items, context);
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
