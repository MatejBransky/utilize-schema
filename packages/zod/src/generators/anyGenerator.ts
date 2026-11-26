import type { ParsedJSONSchemaObject } from '@utilize/json-schema';

import { createGenerator } from './createGenerator';

import { ts } from '../utils';

export const anyGenerator = createGenerator(
	(_schema): _schema is ParsedJSONSchemaObject => true,
	() => {
		return ts`z.unknown()`;
	}
);
