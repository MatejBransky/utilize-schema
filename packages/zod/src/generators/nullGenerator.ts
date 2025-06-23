import { createGenerator } from './createGenerator';

import { ts } from '../utils';

export const generator = createGenerator(
	(schema) => schema.type === 'null',
	() => ts`z.null()`
);
