import type { ExpressionGenerator, NumberMatch } from './types';

import { ts } from '../utils';

export const generateNumberSchema: ExpressionGenerator<NumberMatch> = (
	schema
) => {
	let expression = schema.type === 'integer' ? ts`z.int()` : ts`z.number()`;
	expression = applyNumberConstraints({ expression, schema });

	return expression;
};

interface NumberConstraints {
	expression: string;
	schema: {
		minimum?: number;
		maximum?: number;
		exclusiveMinimum?: number;
		exclusiveMaximum?: number;
		multipleOf?: number;
	};
}

function applyNumberConstraints({
	expression,
	schema: { minimum, maximum, exclusiveMinimum, exclusiveMaximum, multipleOf },
}: NumberConstraints): string {
	if (minimum !== undefined) {
		expression += `.min(${minimum})`;
	}
	if (maximum !== undefined) {
		expression += `.max(${maximum})`;
	}
	if (exclusiveMinimum !== undefined) {
		expression += `.gt(${exclusiveMinimum})`;
	}
	if (exclusiveMaximum !== undefined) {
		expression += `.lt(${exclusiveMaximum})`;
	}
	if (multipleOf !== undefined) {
		expression += `.multipleOf(${multipleOf})`;
	}
	return expression;
}
