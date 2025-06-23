import { createGenerator } from './createGenerator';

import { ts } from '../utils';

export const generator = createGenerator<{ const: unknown }>(
	(schema) => schema.const !== undefined,
	(schema) => {
		return ts`z.literal(${JSON.stringify(schema.const)})`;
	}
);
