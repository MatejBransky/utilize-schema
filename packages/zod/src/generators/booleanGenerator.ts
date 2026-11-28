import type { ParsedJSONSchemaObject } from '@utilize/json-schema';

import { createGenerator } from './createGenerator';

import { ts } from '../utils';

export const booleanGenerator = createGenerator(
	(schema): schema is ParsedJSONSchemaObject => {
		if ('enum' in schema) {
			return false;
		}
		if (schema.type === 'boolean') {
			return true;
		}

		if (schema.type && !schema.type.includes('boolean')) {
			return false;
		}

		if (!schema.type && typeof schema.default === 'boolean') {
			return true;
		}

		return false;
	},
	() => ts`z.boolean()`
);
