import type { ParsedJSONSchema, ParsedJSONSchemaObject } from '@utilize/json-schema';

import type { GeneratorContext } from './generators/types';
import { ts } from './utils';

type Generate = (schema: ParsedJSONSchema, context: GeneratorContext) => string;

/**
 * Appends Zod refinements for keywords that constrain an already generated
 * schema: `not`, `if`/`then`/`else`, `contains`, `propertyNames` and
 * `dependencies`. None of them change the output type, so they are applied as
 * checks after the base expression.
 */
export function applyRefinements(
	expression: string,
	schema: ParsedJSONSchemaObject,
	context: GeneratorContext,
	generate: Generate
): string {
	let result = expression;
	const contextType = typeof schema.type === 'string' ? schema.type : undefined;

	if (schema.not !== undefined) {
		const not = generate(withContextType(schema.not, contextType), context);

		result = ts`${result}.refine(
      (value) => !${not}.safeParse(value).success,
      { message: 'Value must not match the "not" schema.' }
    )`;
	}

	if (schema.if !== undefined) {
		const condition = generate(
			withContextType(schema.if as unknown as ParsedJSONSchema, contextType),
			context
		);
		const thenSchema = schema.then as unknown as ParsedJSONSchema | undefined;
		const elseSchema = schema.else as unknown as ParsedJSONSchema | undefined;
		const thenBlock =
			thenSchema !== undefined
				? checkBlock(generate(withContextType(thenSchema, contextType), context))
				: '';
		const elseBlock =
			elseSchema !== undefined
				? checkBlock(generate(withContextType(elseSchema, contextType), context))
				: '';

		result = ts`${result}.superRefine((value, ctx) => {
      if (${condition}.safeParse(value).success) {
        ${thenBlock}
      } else {
        ${elseBlock}
      }
    })`;
	}

	if (schema.contains !== undefined) {
		const contains = generate(schema.contains, context);

		result = ts`${result}.superRefine((value, ctx) => {
      if (!Array.isArray(value)) {
        return;
      }

      if (!value.some((item) => ${contains}.safeParse(item).success)) {
        ctx.addIssue({
          code: 'custom',
          message: 'Array must contain an item matching the "contains" schema.',
          path: [],
        });
      }
    })`;
	}

	if (schema.propertyNames !== undefined) {
		const propertyNames = generate(withContextType(schema.propertyNames, 'string'), context);

		result = ts`${result}.superRefine((value, ctx) => {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return;
      }

      for (const key of Object.keys(value)) {
        const result = ${propertyNames}.safeParse(key);

        if (!result.success) {
          ${issueBlock('result', 'key')}
        }
      }
    })`;
	}

	if (schema.dependencies) {
		const checks: string[] = [];

		for (const [key, dependency] of Object.entries(schema.dependencies)) {
			if (Array.isArray(dependency)) {
				checks.push(ts`if (Object.hasOwn(value, ${JSON.stringify(key)})) {
          for (const required of ${JSON.stringify(dependency)}) {
            if (!Object.hasOwn(value, required)) {
              ctx.addIssue({
                code: 'custom',
                message: 'Required dependency is missing.',
                path: [required],
              });
            }
          }
        }`);
				continue;
			}

			const dependencySchema = generate(
				withContextType(dependency as ParsedJSONSchema, 'object'),
				context
			);

			checks.push(ts`if (Object.hasOwn(value, ${JSON.stringify(key)})) {
        ${checkBlock(dependencySchema)}
      }`);
		}

		result = ts`${result}.superRefine((value, ctx) => {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return;
      }

      ${checks.join('\n')}
    })`;
	}

	return result;
}

function checkBlock(expression: string, pathPrefix?: string): string {
	return ts`const result = ${expression}.safeParse(value);

        if (!result.success) {
          ${issueBlock('result', pathPrefix)}
        }`;
}

/**
 * Emits the loop that copies Zod issues into the surrounding `superRefine`
 * context. `pathPrefix` narrows issues to a nested key.
 */
function issueBlock(resultName: string, pathPrefix?: string): string {
	const path = pathPrefix ? `[${pathPrefix}, ...issue.path]` : '[...issue.path]';

	return ts`for (const issue of ${resultName}.error.issues) {
      ctx.addIssue({
        code: 'custom',
        message: issue.message,
        path: ${path},
      });
    }`;
}

/**
 * JSON Schema keywords apply only to instances of the matching type, so a
 * subschema without `type` is permissive. Refinements know the type of the
 * value they run on, so they can safely narrow a keyword-only subschema to that
 * type (`propertyNames` always validates strings, a schema dependency always
 * validates objects, and `not`/`if`/`then`/`else` inherit the parent type).
 */
function withContextType(schema: ParsedJSONSchema, type: string | undefined): ParsedJSONSchema {
	if (type === undefined || typeof schema !== 'object' || schema === null) {
		return schema;
	}

	if (
		schema.type !== undefined ||
		'$ref' in schema ||
		schema.anyOf ||
		schema.oneOf ||
		schema.allOf ||
		schema.const !== undefined ||
		schema.enum
	) {
		return schema;
	}

	if (!hasTypeSpecificKeywords(schema)) {
		return schema;
	}

	return { ...schema, type } as ParsedJSONSchema;
}

const typeSpecificKeywords = [
	'properties',
	'required',
	'additionalProperties',
	'patternProperties',
	'propertyNames',
	'dependencies',
	'items',
	'additionalItems',
	'contains',
	'minItems',
	'maxItems',
	'uniqueItems',
	'minLength',
	'maxLength',
	'pattern',
	'format',
	'minimum',
	'maximum',
	'exclusiveMinimum',
	'exclusiveMaximum',
	'multipleOf',
] as const;

function hasTypeSpecificKeywords(schema: ParsedJSONSchemaObject): boolean {
	const record = schema as unknown as Record<string, unknown>;

	return typeSpecificKeywords.some((keyword) => record[keyword] !== undefined);
}
