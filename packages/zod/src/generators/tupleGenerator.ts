import type { ParsedJSONSchemaObject } from '@utilize/json-schema';

import { createGenerator } from './createGenerator';
import { generateSchema } from './generateSchema';

import { NEWLINE, ts } from '../utils';

export const generator = createGenerator<
	ParsedJSONSchemaObject & {
		items: ParsedJSONSchemaObject[];
	}
>(
	(schema) => {
		if (schema.type === 'array' && Array.isArray(schema.items)) {
			return true;
		}

		return false;
	},
	(schema, context) => {
		const itemsPart = schema.items.map((item) => generateSchema(item, context));
		const spreadPart = schema.additionalItems
			? ts`,${NEWLINE}${generateSchema(schema.additionalItems, context)}`
			: '';
		const expression = ts`z.tuple([
    ${itemsPart.join(`,${NEWLINE}`)}
  ]${spreadPart})`;

		return expression;
	}
);
