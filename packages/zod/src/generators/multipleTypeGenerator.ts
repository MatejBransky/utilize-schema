import {
	type JSONSchemaTypeName,
	type ParsedJSONSchemaObject,
	withSourceMeta,
} from '@utilize/json-schema';

import { createGenerator } from './createGenerator';
import { generateSchema } from './generateSchema';

import { NEWLINE, ts } from '../utils';

export const generator = createGenerator<
	ParsedJSONSchemaObject & {
		type: JSONSchemaTypeName[];
	}
>(
	(schema) => Array.isArray(schema.type),
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
