import { generateSchema } from './generateSchema';
import type { ExpressionGenerator, ObjectMatch } from './types';

import { NEWLINE, ts } from '../utils';

export const generateObjectSchema: ExpressionGenerator<ObjectMatch> = (
	schema
) => {
	// TODO: handle patternProperties
	const properties = Object.entries(schema.properties).map(([key, value]) => {
		let optionalPart = '.optional()';

		if (value.default !== undefined) {
			optionalPart = '';
		}

		if (schema.required?.includes(key)) {
			optionalPart = '';
		}

		return `${key}: ${generateSchema(value, key)}${optionalPart}`;
	});
	const propertiesPart = properties.join(`,${NEWLINE}`);

	const additionalProperties =
		schema.additionalProperties !== undefined
			? generateSchema(schema.additionalProperties, 'additionalProperties')
			: undefined;
	const catchAllPart = additionalProperties
		? ts`.catchall(${additionalProperties})`
		: '';

	if (schema.additionalProperties === false) {
		return ts`z.strictObject({
      ${propertiesPart}
    })${catchAllPart}`;
	}

	if (schema.additionalProperties === true) {
		return ts`z.looseObject({
      ${propertiesPart}
    })`;
	}

	return ts`z.object({
    ${propertiesPart}
  })${catchAllPart}`;
};
