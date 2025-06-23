import { createGenerator } from './createGenerator';

import { ts } from '../utils';

export const generator = createGenerator(
	(schema) => {
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
