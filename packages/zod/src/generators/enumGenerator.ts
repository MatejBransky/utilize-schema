import type { ParsedJSONSchemaObject } from '@utilize/json-schema';

import { createGenerator } from './createGenerator';

import { NEWLINE, ts } from '../utils';

export const generator = createGenerator<
	ParsedJSONSchemaObject & {
		enum: unknown[];
	}
>(
	(schema) => {
		if ('enum' in schema) {
			return true;
		}

		return false;
	},
	(schema) => {
		const stringValues = schema.enum.filter(
			(value) => typeof value === 'string'
		);

		if (stringValues.length === schema.enum.length) {
			return ts`z.enum([${stringValues.map((value) => JSON.stringify(value)).join(`,${NEWLINE}`)}])`;
		}

		return ts`z.literal([${schema.enum.map((value) => JSON.stringify(value)).join(`,${NEWLINE}`)}])`;
	}
);
