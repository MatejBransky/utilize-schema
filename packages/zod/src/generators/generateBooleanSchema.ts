import type { BooleanMatch, ExpressionGenerator } from './types';

import { ts } from '../utils';

export const generateBooleanSchema: ExpressionGenerator<BooleanMatch> = () => {
	return ts`z.boolean()`;
};
