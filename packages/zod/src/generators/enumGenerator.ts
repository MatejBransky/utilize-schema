import type { ParsedJSONSchemaObject } from '@utilize/json-schema';

import { createGenerator } from './createGenerator';
import type { ExpressionGenerator } from './createGenerator';
import { renderLiteral } from './renderLiteral';

import { NEWLINE, ts } from '../utils';

export type EnumSchema = ParsedJSONSchemaObject & {
	enum: unknown[];
};

export const enumGenerator: ExpressionGenerator = createGenerator<EnumSchema>(
	(schema): schema is EnumSchema => Array.isArray(schema.enum),
	(schema) => {
		if (schema.enum.length === 0) {
			return ts`z.never()`;
		}

		const stringValues = schema.enum.filter((value) => typeof value === 'string');

		if (stringValues.length === schema.enum.length) {
			return ts`z.enum([${stringValues.map((value) => JSON.stringify(value)).join(`,${NEWLINE}`)}])`;
		}

		if (schema.enum.every(isPrimitive)) {
			return ts`z.literal([${schema.enum.map((value) => JSON.stringify(value)).join(`,${NEWLINE}`)}])`;
		}

		// Composite values have to be compared by deep equality.
		return ts`z.union([${schema.enum.map(renderLiteral).join(`,${NEWLINE}`)}])`;
	}
);

function isPrimitive(value: unknown) {
	return value === null || typeof value !== 'object';
}
