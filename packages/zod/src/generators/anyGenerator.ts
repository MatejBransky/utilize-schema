import { createGenerator } from './createGenerator';

import { ts } from '../utils';

export const anyGenerator = createGenerator(
	() => true,
	() => {
		return ts`z.unknown()`;
	}
);
