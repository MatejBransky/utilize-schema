import { generateSchema } from './generateSchema';
import type { ExpressionGenerator, TupleMatch } from './types';

import { NEWLINE, ts } from '../utils';

export const generateTupleSchema: ExpressionGenerator<TupleMatch> = (
	schema
) => {
	const itemsPart = schema.items.map((item, index) =>
		generateSchema(item, `items[${index}]`)
	);
	const spreadPart = schema.additionalItems
		? ts`,${NEWLINE}${generateSchema(schema.additionalItems, 'additionalItems')}`
		: '';
	const expression = ts`z.tuple([
    ${itemsPart.join(`,${NEWLINE}`)}
  ]${spreadPart})`;

	return expression;
};
