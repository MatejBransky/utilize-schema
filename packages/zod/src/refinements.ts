import {
	isKeywordApplicable,
	narrowUntypedSchema,
	type ParsedJSONSchema,
	type ParsedJSONSchemaObject,
	withSourceMeta,
} from '@utilize/json-schema';

import type { GeneratorContext } from './generators/types';
import { inferTypeKeywords } from './inferTypes';
import { ts } from './utils';

type Generate = (schema: ParsedJSONSchema, context: GeneratorContext) => string;

/**
 * Guards for the types `inferTypeKeywords` can infer. Keywords on an untyped
 * schema must not reject values of other types.
 */
const typeGuards: Record<string, string> = {
	object: `typeof value === 'object' && value !== null && !Array.isArray(value)`,
	array: 'Array.isArray(value)',
	string: `typeof value === 'string'`,
	number: `typeof value === 'number'`,
};

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

	// Keywords on a schema without `type` only apply to their own type, so each
	// constrained type gets a separate guarded check. A schema can constrain
	// more than one type, e.g. `{ minLength: 2, minimum: 5 }`.
	for (const implicitType of inferTypeKeywords(schema, context.dialect)) {
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
			// Applied by the node-level blocks below for typed and untyped
			// schemas alike, so keeping them on the typed copy would duplicate
			// every issue.
			minProperties: undefined,
			maxProperties: undefined,
			uniqueItems: undefined,
		} as ParsedJSONSchemaObject);

		checks.push(ts`{
      if (${typeGuards[implicitType]}) {
        ${checkBlock(generate(typedSchema, context))}
      }
    }`);
	}

	if (schema.not !== undefined) {
		const not = generate(narrowUntypedSchema(schema.not, contextType, context.dialect), context);

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
			narrowUntypedSchema(schema.if as unknown as ParsedJSONSchema, contextType, context.dialect),
			context
		);
		const thenSchema = schema.then as unknown as ParsedJSONSchema | undefined;
		const elseSchema = schema.else as unknown as ParsedJSONSchema | undefined;
		const thenBlock =
			thenSchema !== undefined
				? checkBlock(
						generate(narrowUntypedSchema(thenSchema, contextType, context.dialect), context)
					)
				: '';
		const elseBlock =
			elseSchema !== undefined
				? checkBlock(
						generate(narrowUntypedSchema(elseSchema, contextType, context.dialect), context)
					)
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
			narrowUntypedSchema(schema.propertyNames, 'string', context.dialect),
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
				narrowUntypedSchema(dependency as ParsedJSONSchema, 'object', context.dialect),
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
