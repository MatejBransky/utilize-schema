import { Meta, type ParsedJSONSchemaObject } from '@utilize/json-schema';

import { createGenerator } from './createGenerator';
import { generateSchema } from './generateSchema';

import { isSchemaObject, NEWLINE, ts } from '../utils';

export const generator = createGenerator(
	(schema) => schema.type === 'object',
	(schema, context) => {
		// TODO: handle patternProperties

		const properties = Object.entries(schema.properties ?? {}).map(([key, value]) => {
			const keyLiteral = JSON.stringify(key);
			let optionalPart = '.optional()';

			if (
				typeof value === 'object' &&
				value !== null &&
				'default' in value &&
				value.default !== undefined
			) {
				optionalPart = '';
			}

			if (schema.required?.includes(key)) {
				optionalPart = '';
			}

			if (containsCircularRef(value)) {
				return ts`get ${keyLiteral}() {
            return ${generateSchema(value, context)}${optionalPart};
          }`;
			}

			return `${keyLiteral}: ${generateSchema(value, context)}${optionalPart}`;
		});
		const propertiesPart = properties.join(`,${NEWLINE}`);
		const requiredWithoutProperties = (schema.required ?? []).filter(
			(key) => !Object.hasOwn(schema.properties ?? {}, key)
		);
		const additionalProperties = schema.additionalProperties;
		const requiredValue =
			additionalProperties === false
				? ts`z.never()`
				: isSchemaObject<ParsedJSONSchemaObject>(additionalProperties)
					? generateSchema(additionalProperties, context)
					: ts`z.unknown()`;
		const requiredPart = requiredWithoutProperties
			.map((key) => `${JSON.stringify(key)}: ${requiredValue}`)
			.join(`,${NEWLINE}`);
		const allProperties = [propertiesPart, requiredPart].filter(Boolean).join(`,${NEWLINE}`);
		const requiredCheck =
			requiredWithoutProperties.length > 0
				? ts`.superRefine((value, ctx) => {
        for (const key of ${JSON.stringify(requiredWithoutProperties)}) {
          if (!Object.hasOwn(value, key)) {
            ctx.addIssue({
              code: 'custom',
              message: 'Required property is missing.',
              path: [key],
            });
          }
        }
      })`
				: '';

		const catchAllPart = isSchemaObject<ParsedJSONSchemaObject>(additionalProperties)
			? ts`.catchall(${generateSchema(additionalProperties, context)})`
			: '';

		if (additionalProperties === false) {
			return ts`z.strictObject({
        ${allProperties}
      })${requiredCheck}`;
		}

		if (additionalProperties === true) {
			return ts`z.looseObject({
        ${allProperties}
      })${requiredCheck}`;
		}

		return ts`z.object({
      ${allProperties}
    })${catchAllPart}${requiredCheck}`;
	}
);

function containsCircularRef(schema: ParsedJSONSchemaObject | boolean): boolean {
	if (typeof schema !== 'object' || schema === null) {
		return false;
	}

	if (schema.$ref) {
		return schema[Meta].isCircular === true;
	}

	return subschemasOf(schema).some(containsCircularRef);
}

function subschemasOf(schema: ParsedJSONSchemaObject): ParsedJSONSchemaObject[] {
	return [
		Object.values(schema.properties ?? {}),
		schema.additionalProperties,
		schema.items,
		schema.additionalItems,
		schema.allOf,
		schema.anyOf,
		schema.oneOf,
		schema.not,
	]
		.flat()
		.filter(isSchemaObject<ParsedJSONSchemaObject>);
}
