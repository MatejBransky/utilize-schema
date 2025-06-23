import {
	isPlainObject,
	type ParsedJSONSchemaObject,
} from '@utilize/json-schema';

import { createGenerator } from './createGenerator';
import { generateSchema } from './generateSchema';

import { ts } from '../utils';

export const generator = createGenerator<{
	additionalProperties: ParsedJSONSchemaObject;
}>(
	(schema) => {
		if (!schema.properties && isPlainObject(schema.additionalProperties)) {
			return true;
		}

		return false;
	},
	(schema, context) => {
		// TODO: handle patternProperties

		const additionalProperties = generateSchema(
			schema.additionalProperties,
			context
		);

		return ts`z.record(z.string(), ${additionalProperties})`;
	}
);
