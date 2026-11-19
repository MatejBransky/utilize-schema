import {
	type Dialect,
	dialectOf,
	containsBounds,
	isKeywordApplicable,
	type ParsedJSONSchema,
	type ParsedJSONSchemaObject,
	withSourceMeta,
} from '@utilize/json-schema';

import type { GeneratorContext } from './generators/types';
import { inferTypeKeyword } from './inferTypes';
import { ts } from './utils';

type Generate = (schema: ParsedJSONSchema, context: GeneratorContext) => string;

/**
 * Appends Zod refinements for keywords that constrain an already generated
 * schema: `not`, `if`/`then`/`else`, `contains`, `propertyNames`,
 * `dependencies` and type-specific keywords on schemas without `type`.
 *
 * The checks run on the original input before the base schema parses it. This
 * is important for object keywords: `z.object()` strips undeclared keys before
 * a normal `.superRefine()` would see them.
 */
export function applyRefinements(
	expression: string,
	schema: ParsedJSONSchemaObject,
	context: GeneratorContext,
	generate: Generate
): string {
	const checks: string[] = [];
	const contextType = typeof schema.type === 'string' ? schema.type : undefined;
	const implicitType = inferTypeKeyword(schema, context.dialect);

	if (implicitType) {
		const typedSchema = withSourceMeta(schema, {
			...schema,
			type: implicitType,
			default: undefined,
			title: undefined,
			description: undefined,
			examples: undefined,
			not: undefined,
			if: undefined,
			then: undefined,
			else: undefined,
			contains: undefined,
			propertyNames: undefined,
			dependencies: undefined,
		} as ParsedJSONSchemaObject);
		const typeCheck =
			implicitType === 'object'
				? `typeof value === 'object' && value !== null && !Array.isArray(value)`
				: implicitType === 'array'
					? 'Array.isArray(value)'
					: implicitType === 'string'
						? `typeof value === 'string'`
						: `typeof value === 'number'`;

		checks.push(ts`{
      if (${typeCheck}) {
        ${checkBlock(generate(typedSchema, context))}
      }
    }`);
	}

	if (schema.not !== undefined) {
		const not = generate(withContextType(schema.not, contextType, context.dialect), context);

		checks.push(ts`{
      const notResult = ${not}.safeParse(value);

      if (notResult.success) {
        ctx.addIssue({
          code: 'custom',
          message: 'Value must not match the "not" schema.',
          path: [],
        });
      }
    }`);
	}

	if (schema.if !== undefined && isKeywordApplicable(context.dialect, 'if')) {
		const condition = generate(
			withContextType(schema.if as unknown as ParsedJSONSchema, contextType, context.dialect),
			context
		);
		const thenSchema = schema.then as unknown as ParsedJSONSchema | undefined;
		const elseSchema = schema.else as unknown as ParsedJSONSchema | undefined;
		const thenBlock =
			thenSchema !== undefined
				? checkBlock(generate(withContextType(thenSchema, contextType, context.dialect), context))
				: '';
		const elseBlock =
			elseSchema !== undefined
				? checkBlock(generate(withContextType(elseSchema, contextType, context.dialect), context))
				: '';

		checks.push(ts`{
      if (${condition}.safeParse(value).success) {
        ${thenBlock}
      } else {
        ${elseBlock}
      }
    }`);
	}

	if (schema.contains !== undefined && isKeywordApplicable(context.dialect, 'contains')) {
		const contains = generate(schema.contains, context);
		const bounds = containsBounds(schema, context.dialect);

		if (bounds?.counted === true) {
			const outOfRange =
				bounds.max === undefined
					? `matches < ${bounds.min}`
					: `matches < ${bounds.min} || matches > ${bounds.max}`;

			checks.push(ts`{
      if (Array.isArray(value)) {
        const matches = value.filter((item) => ${contains}.safeParse(item).success).length;

        if (${outOfRange}) {
          ctx.addIssue({
            code: 'custom',
            message: 'Array does not contain the required number of matching items.',
            path: [],
          });
        }
      }
    }`);
		} else if (bounds !== undefined) {
			checks.push(ts`{
      if (Array.isArray(value) && !value.some((item) => ${contains}.safeParse(item).success)) {
        ctx.addIssue({
          code: 'custom',
          message: 'Array must contain an item matching the "contains" schema.',
          path: [],
        });
      }
    }`);
		}
	}

	if (schema.uniqueItems === true) {
		checks.push(ts`{
      if (Array.isArray(value)) {
        const seen = new Set(
          value.map((item) =>
            JSON.stringify(item, (_key, entry) =>
              entry && typeof entry === 'object' && !Array.isArray(entry)
                ? Object.fromEntries(
                    Object.entries(entry).sort(([left], [right]) => left.localeCompare(right))
                  )
                : entry
            )
          )
        );

        if (seen.size !== value.length) {
          ctx.addIssue({
            code: 'custom',
            message: 'Array items must be unique.',
            path: [],
          });
        }
      }
    }`);
	}

	if (typeof schema.minProperties === 'number') {
		checks.push(ts`{
      if (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value) &&
        Object.keys(value).length < ${schema.minProperties}
      ) {
        ctx.addIssue({
          code: 'custom',
          message: 'Object must have at least ${schema.minProperties} properties.',
          path: [],
        });
      }
    }`);
	}

	if (typeof schema.maxProperties === 'number') {
		checks.push(ts`{
      if (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value) &&
        Object.keys(value).length > ${schema.maxProperties}
      ) {
        ctx.addIssue({
          code: 'custom',
          message: 'Object must have at most ${schema.maxProperties} properties.',
          path: [],
        });
      }
    }`);
	}

	if (schema.propertyNames !== undefined && isKeywordApplicable(context.dialect, 'propertyNames')) {
		const propertyNames = generate(
			withContextType(schema.propertyNames, 'string', context.dialect),
			context
		);

		checks.push(ts`{
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        for (const key of Object.keys(value)) {
          const result = ${propertyNames}.safeParse(key);

          if (!result.success) {
            ${issueBlock('result', 'key')}
          }
        }
      }
    }`);
	}

	// `dependencies` is either native to the dialect or merged from
	// `dependentRequired` / `dependentSchemas` by the normalizer. A foreign
	// `dependencies` keyword was already dropped by the parser.
	if (schema.dependencies) {
		const dependencyChecks: string[] = [];

		for (const [key, dependency] of Object.entries(schema.dependencies)) {
			if (Array.isArray(dependency)) {
				dependencyChecks.push(ts`if (Object.hasOwn(value, ${JSON.stringify(key)})) {
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
				withContextType(dependency as ParsedJSONSchema, 'object', context.dialect),
				context
			);

			dependencyChecks.push(ts`if (Object.hasOwn(value, ${JSON.stringify(key)})) {
        ${checkBlock(dependencySchema)}
      }`);
		}

		checks.push(ts`{
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        ${dependencyChecks.join('\n')}
      }
    }`);
	}

	if (checks.length === 0) {
		return expression;
	}

	return ts`z.any().superRefine((value, ctx) => {
    ${checks.join('\n')}
  }).pipe(${expression})`;
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
function withContextType(
	schema: ParsedJSONSchema,
	type: string | undefined,
	fallback: Dialect
): ParsedJSONSchema {
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

	const dialect = dialectOf(schema, fallback);

	if (!hasTypeSpecificKeywords(schema, dialect)) {
		return schema;
	}

	return withSourceMeta(schema, { ...schema, type }) as ParsedJSONSchema;
}

const typeSpecificKeywords = [
	'properties',
	'required',
	'additionalProperties',
	'patternProperties',
	'propertyNames',
	'dependencies',
	'items',
	'prefixItems',
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

function hasTypeSpecificKeywords(schema: ParsedJSONSchemaObject, dialect: Dialect): boolean {
	const record = schema as unknown as Record<string, unknown>;

	return typeSpecificKeywords.some(
		(keyword) => record[keyword] !== undefined && isKeywordApplicable(dialect, keyword)
	);
}
