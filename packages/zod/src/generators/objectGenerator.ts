import { Meta, type ParsedJSONSchemaObject } from '@utilize/json-schema';

import { createGenerator } from './createGenerator';
import { generateSchema } from './generateSchema';
import type { GeneratorContext } from './types';

import { isSchemaObject, NEWLINE, ts } from '../utils';

export const generator = createGenerator(
	(schema) => schema.type === 'object',
	(schema, context) => {
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

			if (containsCircularRef(value, context)) {
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
		const patterns = Object.entries(schema.patternProperties ?? {});

		// A required key that is not declared in `properties` is validated by a
		// matching pattern, or by `additionalProperties`, not by the property
		// placeholder itself.
		const requiredValue =
			patterns.length > 0
				? ts`z.unknown()`
				: additionalProperties === false
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

		if (patterns.length > 0) {
			return ts`z.looseObject({
        ${allProperties}
      })${patternRefinement(schema, patterns, context)}${requiredCheck}`;
		}

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

/**
 * `patternProperties` can apply several schemas to the same key and only
 * applies to keys that match, so a `catchall` cannot express it. The object is
 * kept open and a refinement validates matching keys; keys that match no
 * pattern fall through to `additionalProperties`.
 */
function patternRefinement(
	schema: ParsedJSONSchemaObject,
	patterns: Array<[string, ParsedJSONSchemaObject]>,
	context: GeneratorContext
): string {
	const declared = Object.keys(schema.properties ?? {});
	// An empty array literal is typed `never[]`, so `[].includes(key)` would not
	// type-check in the generated code.
	const isKnownKey =
		declared.length > 0 ? `matched || ${JSON.stringify(declared)}.includes(key)` : 'matched';
	const additionalProperties = schema.additionalProperties;
	const additionalCheck = isSchemaObject<ParsedJSONSchemaObject>(additionalProperties)
		? ts`
        const result = ${generateSchema(additionalProperties, context)}.safeParse(entry);

        if (!result.success) {
          for (const issue of result.error.issues) {
            ctx.addIssue({
              code: 'custom',
              message: issue.message,
              path: [key, ...issue.path],
            });
          }
        }`
		: additionalProperties === false
			? ts`
        ctx.addIssue({
          code: 'custom',
          message: 'Unrecognized key.',
          path: [key],
        });`
			: '';

	const checks = patterns
		.map(
			([pattern, subschema]) => ts`{
          if (${new RegExp(pattern)}.test(key)) {
            matched = true;
            const result = ${generateSchema(subschema, context)}.safeParse(entry);

            if (!result.success) {
              for (const issue of result.error.issues) {
                ctx.addIssue({
                  code: 'custom',
                  message: issue.message,
                  path: [key, ...issue.path],
                });
              }
            }
          }
        }`
		)
		.join('\n');

	return ts`.superRefine((value, ctx) => {
      for (const [key, entry] of Object.entries(value)) {
        let matched = false;

        ${checks}

        if (${isKnownKey}) {
          continue;
        }

        ${additionalCheck}
      }
    })`;
}

function containsCircularRef(
	schema: ParsedJSONSchemaObject | boolean,
	context: GeneratorContext
): boolean {
	if (typeof schema !== 'object' || schema === null) {
		return false;
	}

	if (schema.$ref || context.declarationOf?.(schema)) {
		return schema[Meta].isCircular === true;
	}

	return subschemasOf(schema).some((subschema) => containsCircularRef(subschema, context));
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
