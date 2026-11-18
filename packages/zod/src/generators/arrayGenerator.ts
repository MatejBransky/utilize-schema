import type { ParsedJSONSchema, ParsedJSONSchemaObject } from '@utilize/json-schema';

import { createGenerator } from './createGenerator';
import { generateSchema } from './generateSchema';

import { ts } from '../utils';

export const generator = createGenerator<
	ParsedJSONSchemaObject & { items: ParsedJSONSchemaObject }
>(
	(schema, dialect) => {
		if (schema.type !== 'array') {
			return false;
		}

		return dialect.tuple === 'prefixItems'
			? schema.prefixItems === undefined
			: !Array.isArray(schema.items);
	},
	(schema, context) => {
		const items =
			context.dialect.tuple === 'prefixItems' && Array.isArray(schema.items)
				? undefined
				: schema.items;
		const itemsPart = generateSchema(items as ParsedJSONSchema | undefined, context);
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
