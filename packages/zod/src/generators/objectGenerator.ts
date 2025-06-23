import { Meta, type ParsedJSONSchemaObject } from '@utilize/json-schema';

import { createGenerator } from './createGenerator';
import { generateSchema } from './generateSchema';

import { NEWLINE, ts } from '../utils';

export const generator = createGenerator<
	ParsedJSONSchemaObject & {
		properties: Record<string, ParsedJSONSchemaObject>;
	}
>(
	(schema) => {
		if (typeof schema === 'object' && 'type' in schema && schema.properties) {
			return true;
		}

		return false;
	},
	(schema, context) => {
		// TODO: handle patternProperties

		const properties = Object.entries(schema.properties).map(([key, value]) => {
			let optionalPart = '.optional()';

			if (value.default !== undefined) {
				optionalPart = '';
			}

			if (schema.required?.includes(key)) {
				optionalPart = '';
			}

			if (value.$ref) {
				const metadata = value[Meta];
				if (metadata.isCircular) {
					return ts`get ${key} () {
            return ${generateSchema(value, context)}${optionalPart};
          }`;
				}
			}

			return `${key}: ${generateSchema(value, context)}${optionalPart}`;
		});
		const propertiesPart = properties.join(`,${NEWLINE}`);

		const additionalProperties =
			schema.additionalProperties !== undefined
				? generateSchema(schema.additionalProperties, context)
				: undefined;
		const catchAllPart = additionalProperties
			? ts`.catchall(${additionalProperties})`
			: '';

		if (schema.additionalProperties === false) {
			return ts`z.strictObject({
        ${propertiesPart}
      })`;
		}

		if (schema.additionalProperties === true) {
			return ts`z.looseObject({
        ${propertiesPart}
      })`;
		}

		return ts`z.object({
      ${propertiesPart}
    })${catchAllPart}`;
	}
);
