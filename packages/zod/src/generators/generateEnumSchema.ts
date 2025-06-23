import type { EnumMatch, ExpressionGenerator } from './types';

import { NEWLINE, ts } from '../utils';

export const generateEnumSchema: ExpressionGenerator<EnumMatch> = (schema) => {
	const stringValues = schema.enum.filter((value) => typeof value === 'string');

	if (stringValues.length === schema.enum.length) {
		return ts`z.enum([${stringValues.map((value) => JSON.stringify(value)).join(`,${NEWLINE}`)}])`;
	}

	return ts`z.literal([${schema.enum.map((value) => JSON.stringify(value)).join(`,${NEWLINE}`)}])`;
};
