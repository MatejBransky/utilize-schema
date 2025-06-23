import type { ExpressionGenerator, NullMatch } from './types';

import { ts } from '../utils';

export const generateNullSchema: ExpressionGenerator<NullMatch> = () => {
	return ts`z.null()`;
};
