import type { ParsedJSONSchema, ParsedJSONSchemaObject } from '@utilize/json-schema';

import { selectGenerator } from './selectGenerator';
import type { GeneratorContext } from './types';

import { applyRefinements } from '../refinements';
import { NEWLINE, ts } from '../utils';

export const generateSchema = (schema: ParsedJSONSchema, context: GeneratorContext) => {
	if (schema === undefined) {
		return ts`z.unknown()`;
	}

	if (typeof schema !== 'object' || schema === null) {
		return schema === true ? ts`z.any()` : schema === false ? ts`z.never()` : ts`z.unknown()`;
	}

	let expression = generateCore(schema, context);

	expression = applyRefinements(expression, schema, context, generateSchema);

	if (schema.$id || schema.title || schema.description || schema.examples !== undefined) {
		expression = withMetadata(expression, schema);
	}

	if (schema.default !== undefined) {
		expression = withDefault(expression, schema.default, schema);
	}

	return expression;
};

/**
 * Generates the schema without applying refinements or metadata, and combines
 * keywords that would otherwise be lost.
 *
 * A schema can combine a `$ref` or a combinator with sibling keywords, e.g.
 * `{ allOf: [...], properties: {...} }` or `{ $ref: "#/x", maxItems: 2 }`. The
 * generator for the reference/combinator only reads its own keyword, so the
 * siblings are intersected with it, matching JSON Schema semantics.
 */
function generateCore(schema: ParsedJSONSchemaObject, context: GeneratorContext): string {
	const parts = composedSchemaParts(schema);

	if (parts) {
		return ts`z.intersection(${generateCore(parts.main, context)},${NEWLINE}${generateSchema(
			parts.rest,
			context
		)})`;
	}

	return selectGenerator(schema).generate(schema, context);
}

/**
 * Splits a schema that combines a combinator with sibling constraints into the
 * combinator alone and the remaining structural keywords. Returns `undefined`
 * when there is nothing to intersect. The value-type renderer mirrors this
 * split, so generated types match runtime validation.
 */
export function composedSchemaParts(
	schema: ParsedJSONSchemaObject
): { main: ParsedJSONSchemaObject; rest: ParsedJSONSchemaObject } | undefined {
	const keyword = pickCombinatorKeyword(schema);

	if (!keyword) {
		return undefined;
	}

	const rest = withoutKeys(schema, [keyword, ...ownAnnotationKeywords, ...refinementKeywords]);

	if (!hasStructuralKeywords(rest)) {
		return undefined;
	}

	return {
		main: {
			[keyword]: schema[keyword],
			discriminator: schema.discriminator,
		} as unknown as ParsedJSONSchemaObject,
		rest,
	};
}

type CombinatorKeyword = 'allOf' | 'anyOf' | 'oneOf';

/**
 * The keyword whose generator ignores the rest of the schema. `$ref` takes
 * precedence and, in draft-07, overrides every sibling keyword, so it is not
 * split: the generator emits only the reference.
 */
function pickCombinatorKeyword(schema: ParsedJSONSchemaObject): CombinatorKeyword | undefined {
	if ('$ref' in schema) {
		return undefined;
	}

	if (schema.anyOf) {
		return 'anyOf';
	}

	if (schema.allOf) {
		return 'allOf';
	}

	if (schema.oneOf) {
		return 'oneOf';
	}

	return undefined;
}

const structuralKeywords = new Set<string>([
	'allOf',
	'anyOf',
	'oneOf',
	'type',
	'enum',
	'const',
	'properties',
	'required',
	'additionalProperties',
	'items',
	'prefixItems',
	'additionalItems',
	'minItems',
	'maxItems',
	'minLength',
	'maxLength',
	'pattern',
	'format',
	'minimum',
	'maximum',
	'exclusiveMinimum',
	'exclusiveMaximum',
	'multipleOf',
]);

/**
 * True when the rest of the schema constrains the instance on its own. A rest
 * made of annotations, or of keywords handled by `applyRefinements`, does not
 * need an intersection: the outer schema already applies those.
 */
function hasStructuralKeywords(schema: ParsedJSONSchemaObject): boolean {
	const record = schema as unknown as Record<string, unknown>;

	for (const keyword of structuralKeywords) {
		if (record[keyword] !== undefined) {
			return true;
		}
	}

	return false;
}

function withoutKeys(
	schema: ParsedJSONSchemaObject,
	keys: readonly string[]
): ParsedJSONSchemaObject {
	const clone = { ...schema } as unknown as Record<string, unknown>;

	for (const key of keys) {
		delete clone[key];
	}

	return clone as unknown as ParsedJSONSchemaObject;
}

/**
 * Keywords applied by `generateSchema` itself. They are removed from the
 * intersected part so they are emitted once, on the whole schema.
 */
const ownAnnotationKeywords = [
	'$id',
	'title',
	'description',
	'examples',
	'default',
	'$comment',
	'$schema',
	'deprecated',
	'readOnly',
	'writeOnly',
] as const;

/** Keywords handled by `applyRefinements` on the whole schema. */
const refinementKeywords = [
	'not',
	'if',
	'then',
	'else',
	'contains',
	'propertyNames',
	'dependencies',
	'uniqueItems',
	'minProperties',
	'maxProperties',
] as const;

function withMetadata(
	expression: string,
	{ $id, title, description, examples }: ParsedJSONSchemaObject
) {
	return ts`${expression}.meta(${JSON.stringify({ id: $id, title, description, examples })})`;
}

function withDefault(expression: string, defaultValue: unknown, schema: ParsedJSONSchemaObject) {
	if (schema.type === 'boolean' && typeof defaultValue === 'string') {
		if (defaultValue === 'true') {
			return ts`${expression}.default(true)`;
		}
		if (defaultValue === 'false') {
			return ts`${expression}.default(false)`;
		}
	}
	return ts`${expression}.default(${JSON.stringify(defaultValue)})`;
}
