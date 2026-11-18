import {
	type JSONSchemaTypeName,
	type ParsedJSONSchemaObject,
	withSourceMeta,
} from '@utilize/json-schema';

import { createGenerator } from './createGenerator';
import { generateSchema, isTypedLiteral } from './generateSchema';

import { NEWLINE, ts } from '../utils';

export const generator = createGenerator<
	ParsedJSONSchemaObject & {
		type: JSONSchemaTypeName[];
	}
>(
	(schema) => Array.isArray(schema.type) && !isTypedLiteral(schema),
	(schema, context) => {
		const subschemas = schema.type.map((type) =>
			generateSchema(
				withSourceMeta(schema, { ...schema, type, default: undefined, title: undefined }),
				context
			)
		);

		return ts`z.union([
      ${subschemas.join(`,${NEWLINE}`)}
    ])`;
	}
);
