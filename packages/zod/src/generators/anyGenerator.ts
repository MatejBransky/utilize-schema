import { createGenerator } from './createGenerator';

import { ts } from '../utils';

export const generator = createGenerator(
	() => true,
	() => {
		return ts`z.unknown()`;
	}
);
