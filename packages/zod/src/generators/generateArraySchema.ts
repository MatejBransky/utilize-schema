import { generateSchema } from './generateSchema';
import type { ArrayMatch, ExpressionGenerator } from './types';

import { ts } from '../utils';

export const generateArraySchema: ExpressionGenerator<ArrayMatch> = (
	schema,
	name
) => {
	const itemsPart = generateSchema(schema.items, name);
	let expression = ts`z.array(${itemsPart})`;

	if (schema.minItems !== undefined) {
		expression = ts`${expression}.min(${schema.minItems})`;
	}
	if (schema.maxItems !== undefined) {
		expression = ts`${expression}.max(${schema.maxItems})`;
	}

	return expression;
};
