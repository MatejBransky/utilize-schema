import { withSourceMeta } from '@utilize/json-schema';
import type { JSONSchemaTypeName, ParsedJSONSchemaObject } from '@utilize/json-schema';

import { createGenerator } from './createGenerator';

import { NEWLINE, ts } from '../utils';

/**
 * `generateSchema` adds the metadata, the default and `.readonly()` to the
 * whole union, so the branch for each type must not repeat them.
 */
const withoutUnionAnnotations = {
	$id: undefined,
	title: undefined,
	description: undefined,
	examples: undefined,
	deprecated: undefined,
	default: undefined,
	readOnly: undefined,
};

export const multipleTypeGenerator = createGenerator<
	ParsedJSONSchemaObject & {
		type: JSONSchemaTypeName[];
	}
>(
	(schema) => Array.isArray(schema.type),
	(schema, context, { generateSchema }) => {
		const subschemas = schema.type.map((type) =>
			generateSchema(
				withSourceMeta(schema, { ...schema, type, ...withoutUnionAnnotations }),
				context
			)
		);

		return ts`z.union([
      ${subschemas.join(`,${NEWLINE}`)}
    ])`;
	}
);
