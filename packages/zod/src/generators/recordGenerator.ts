import { isPlainObject } from '@utilize/json-schema';
import type { ParsedJSONSchemaObject } from '@utilize/json-schema';

import { createGenerator } from './createGenerator';
import type { ExpressionGenerator } from './createGenerator';
import { protoInputCheck } from './protoProperty';

import { ts } from '../utils';

export type RecordSchema = ParsedJSONSchemaObject & {
	additionalProperties: ParsedJSONSchemaObject;
};

export const recordGenerator: ExpressionGenerator = createGenerator<RecordSchema>(
	(schema): schema is RecordSchema => {
		if (
			!schema.properties &&
			!schema.required?.length &&
			isPlainObject(schema.additionalProperties)
		) {
			return true;
		}

		return false;
	},
	(schema, context, { generateSchema }) => {
		// TODO: handle patternProperties

		const additionalProperties = generateSchema(schema.additionalProperties, context);

		// `z.record` skips an own `__proto__` key, so validate it on the raw
		// input. A value schema that accepts everything has nothing to check.
		if (additionalProperties === 'z.unknown()' || additionalProperties === 'z.any()') {
			return ts`z.record(z.string(), ${additionalProperties})`;
		}

		return ts`z.any().superRefine((value, ctx) => {
        ${protoInputCheck({ required: false, valueExpressions: [additionalProperties] })}
      }).pipe(z.record(z.string(), ${additionalProperties}))`;
	}
);
