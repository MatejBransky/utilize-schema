import type { ParsedJSONSchemaObject } from '@utilize/json-schema';

import { createGenerator } from './createGenerator';

import { ts } from '../utils';

export const arrayGenerator = createGenerator<
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
	(schema, context, { generateSchema }) => {
		const items =
			context.dialect.tuple === 'prefixItems' && Array.isArray(schema.items)
				? undefined
				: schema.items;
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
