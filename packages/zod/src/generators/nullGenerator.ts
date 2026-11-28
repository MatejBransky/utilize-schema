import type { ParsedJSONSchemaObject } from '@utilize/json-schema';

import { createGenerator } from './createGenerator';
import type { ExpressionGenerator } from './createGenerator';

import { ts } from '../utils';

export type NullSchema = ParsedJSONSchemaObject & { type: 'null' };

export const nullGenerator: ExpressionGenerator = createGenerator<NullSchema>(
	(schema): schema is NullSchema => schema.type === 'null',
	() => ts`z.null()`
);
