import type { ParsedJSONSchemaObject } from '@utilize/json-schema';

import { generateArray } from './array';
import type { Context } from './context';
import { generateNumber } from './number';
import { generateObject } from './object';
import { generateString } from './string';

/**
 * The constructor for each declared `type`. A type that is not here falls
 * through to `generateUntyped`, which narrows on the keywords instead.
 */
export const TYPE_GENERATORS = new Map<
	string,
	(schema: ParsedJSONSchemaObject, context: Context) => string
>([
	['string', generateString],
	['number', (schema) => generateNumber(schema, false)],
	['integer', (schema) => generateNumber(schema, true)],
	['boolean', () => 'Schema.Boolean'],
	['null', () => 'Schema.Null'],
	['array', generateArray],
	['object', generateObject],
]);
