import { createGenerator } from './createGenerator';

import { ts } from '../utils';

export const generator = createGenerator(
	(schema) => {
		const numberTypes = ['number', 'integer'];

		if ('enum' in schema) {
			return false;
		}

		if (typeof schema.type === 'string' && numberTypes.includes(schema.type)) {
			return true;
		}

		if (!schema.type && typeof schema.default === 'number') {
			return true;
		}

		return false;
	},
	(schema) => {
		let expression = schema.type === 'integer' ? ts`z.int()` : ts`z.number()`;
		expression = applyNumberConstraints({ expression, schema });

		return expression;
	}
);

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
