import { generateSchema } from './generateSchema';
import type { ExpressionGenerator, RecordMatch } from './types';

import { ts } from '../utils';

export const generateRecordSchema: ExpressionGenerator<RecordMatch> = (
	schema,
	name
) => {
	// TODO: handle patternProperties
	const additionalProperties = generateSchema(
		schema.additionalProperties,
		name
	);
	return ts`z.record(${additionalProperties})`;
};
