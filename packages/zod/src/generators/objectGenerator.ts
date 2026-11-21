import { Meta, type ParsedJSONSchemaObject } from '@utilize/json-schema';

import { createGenerator } from './createGenerator';
import { generateSchema } from './generateSchema';
import { protoInputCheck } from './protoProperty';
import type { GeneratorContext } from './types';

import { unicodePattern } from '../regex';
import { isSchemaObject, NEWLINE, shapeKey, ts } from '../utils';

const PROTO = '__proto__';

export const generator = createGenerator(
	(schema) => schema.type === 'object',
	(schema, context) => {
		const declaredProperties = schema.properties ?? {};
		const properties = Object.entries(declaredProperties).map(([key, value]) => {
			const keyExpression = shapeKey(key);
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
				return ts`get ${keyExpression}() {
            return ${generateSchema(value, context)}${optionalPart};
          }`;
			}

			return `${keyExpression}: ${generateSchema(value, context)}${optionalPart}`;
		});
		const propertiesPart = properties.join(`,${NEWLINE}`);
		// `__proto__` is validated against the raw input below, because Zod's
		// object parser skips that key in both the shape and the output.
		const requiredWithoutProperties = (schema.required ?? []).filter(
			(key) => key !== PROTO && !Object.hasOwn(declaredProperties, key)
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
			.map((key) => `${shapeKey(key)}: ${requiredValue}`)
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
		const protoCheck = protoPropertyCheck(schema, context);
		const withProtoCheck = (expression: string) => {
			const checked =
				protoCheck === ''
					? expression
					: ts`z.any().superRefine((value, ctx) => {
        ${protoCheck}
      }).pipe(${expression})`;

			// Zod finds a declared key with `key in input` and reads `input[key]`,
			// so a name that exists on `Object.prototype` is validated against the
			// inherited value when the input does not own it. A null-prototype
			// clone hides the inherited names.
			return needsPrototypeNamesClone(schema)
				? ts`z.preprocess((value) =>
        typeof value === 'object' && value !== null && !Array.isArray(value)
          ? Object.assign(Object.create(null), value)
          : value,
        ${checked}
      )`
				: checked;
		};

		if (patterns.length > 0) {
			return withProtoCheck(ts`z.looseObject({
        ${allProperties}
      })${patternRefinement(schema, patterns, context)}${requiredCheck}`);
		}

		const catchAllPart = isSchemaObject<ParsedJSONSchemaObject>(additionalProperties)
			? ts`.catchall(${generateSchema(additionalProperties, context)})`
			: '';

		if (additionalProperties === false) {
			return withProtoCheck(ts`z.strictObject({
        ${allProperties}
      })${requiredCheck}`);
		}

		if (additionalProperties === true) {
			return withProtoCheck(ts`z.looseObject({
        ${allProperties}
      })${requiredCheck}`);
		}

		return withProtoCheck(ts`z.object({
      ${allProperties}
    })${catchAllPart}${requiredCheck}`);
	}
);

/**
 * Zod's object parser skips an own `__proto__` key: the shape never validates
 * it, a `required` one is never enforced, and the parsed output drops it. This
 * returns a check for the raw input, which still has the property when the
 * value comes from JSON, or an empty string when the schema does not use it.
 *
 * `patternProperties` and `additionalProperties` apply to `__proto__` like to
 * any other key, but Zod's catchall skips it as well, so they are checked here
 * too. The key is constant, so a pattern that matches it is known at
 * generation time.
 */
function protoPropertyCheck(schema: ParsedJSONSchemaObject, context: GeneratorContext): string {
	const properties = schema.properties ?? {};
	const declared = Object.hasOwn(properties, PROTO);
	const required = schema.required?.includes(PROTO) ?? false;
	const patterns = Object.entries(schema.patternProperties ?? {});
	const matchingPatterns = patterns.filter(([pattern]) =>
		unicodePattern(pattern, 'patternProperties').test(PROTO)
	);
	const additionalProperties = schema.additionalProperties;
	// A matching pattern covers the key, so `additionalProperties` does not.
	const additionalSchema =
		!declared &&
		matchingPatterns.length === 0 &&
		isSchemaObject<ParsedJSONSchemaObject>(additionalProperties)
			? generateSchema(additionalProperties, context)
			: '';
	// Without patterns, `z.strictObject` reports the key itself.
	const additionalRejection =
		!declared &&
		matchingPatterns.length === 0 &&
		patterns.length > 0 &&
		additionalProperties === false;

	if (
		!declared &&
		!required &&
		matchingPatterns.length === 0 &&
		additionalSchema === '' &&
		!additionalRejection
	) {
		return '';
	}

	return protoInputCheck({
		required,
		rejectAsAdditional: additionalRejection,
		valueExpressions: [
			declared ? generateSchema(properties[PROTO], context) : '',
			...matchingPatterns.map(([, subschema]) => generateSchema(subschema, context)),
			additionalSchema,
		].filter(Boolean),
	});
}

/** True when Zod could find a declared key on `Object.prototype`. */
function needsPrototypeNamesClone(schema: ParsedJSONSchemaObject): boolean {
	return [...Object.keys(schema.properties ?? {}), ...(schema.required ?? [])].some(
		(key) => key !== PROTO && Object.hasOwn(Object.prototype, key)
	);
}

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
          if (${unicodePattern(pattern, 'patternProperties')}.test(key)) {
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
