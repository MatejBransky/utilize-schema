import type { ExpressionGenerator, UnknownMatch } from './types';

import { ts } from '../utils';

export const generateUnknownSchema: ExpressionGenerator<UnknownMatch> = () => {
	return ts`z.unknown()`;
};
