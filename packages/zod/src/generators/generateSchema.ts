import {
	type Dialect,
	dialectOf,
	type ParsedJSONSchema,
	type ParsedJSONSchemaObject,
} from '@utilize/json-schema';

import { generator as refGenerator } from './refGenerator';
import { selectGenerator } from './selectGenerator';
import type { GeneratorContext } from './types';

import { applyRefinements } from '../refinements';
import { NEWLINE, ts } from '../utils';

export const generateSchema = (schema: ParsedJSONSchema | undefined, context: GeneratorContext) => {
	if (schema === undefined) {
		return ts`z.unknown()`;
	}

	if (typeof schema !== 'object' || schema === null) {
		return schema === true ? ts`z.any()` : schema === false ? ts`z.never()` : ts`z.unknown()`;
	}

	const dialect = dialectOf(schema, context.dialect);
	const nodeContext = dialect === context.dialect ? context : { ...context, dialect };

	let expression = generateCore(schema, nodeContext);

	if (!ignoresRefSiblings(schema, dialect)) {
		expression = applyRefinements(expression, schema, nodeContext, generateSchema);
	}

	if (
		schema.$id ||
		schema.title ||
		schema.description ||
		schema.examples !== undefined ||
		schema.deprecated !== undefined
	) {
		expression = withMetadata(expression, schema);
	}

	if (schema.default !== undefined) {
		expression = withDefault(expression, schema.default, schema);
	}

	if (context.readOnlyKeyword && schema.readOnly === true) {
		expression = ts`${expression}.readonly()`;
	}

	return expression;
};

/**
 * True for a `$ref` node in a dialect that ignores every keyword next to the
 * reference (draft-07 and older), so no refinement may be applied to it.
 */
function ignoresRefSiblings(schema: ParsedJSONSchemaObject, dialect: Dialect): boolean {
	return typeof schema.$ref === 'string' && dialect.refSiblings === 'ignore';
}

/**
 * Generates the schema without applying refinements or metadata, and combines
 * keywords that would otherwise be lost.
 *
 * A schema can combine a `$ref` or a combinator with sibling keywords, e.g.
 * `{ allOf: [...], properties: {...} }` or `{ $ref: "#/x", maxItems: 2 }`. The
 * generator for the reference/combinator only reads its own keyword, so the
 * siblings are intersected with it, matching JSON Schema semantics.
 *
 * `$ref` siblings are dialect-specific: draft-07 and older override them, while
 * 2019-09 and newer apply them. Refinement keywords (`not`, `if`, ...) are left
 * for `applyRefinements`, which knows whether the dialect allows them.
 */
function generateCore(schema: ParsedJSONSchemaObject, context: GeneratorContext): string {
	const dialect = dialectOf(schema, context.dialect);

	if (typeof schema.$ref === 'string') {
		const reference = refGenerator.generate(schema, context);

		if (dialect.refSiblings === 'apply') {
			const rest = refSiblingConstraints(schema);

			if (rest) {
				return ts`z.intersection(${reference},${NEWLINE}${generateSchema(rest, context)})`;
			}
		}

		return reference;
	}

	const parts = composedSchemaParts(schema);

	if (parts) {
		return ts`z.intersection(${generateCore(parts.main, context)},${NEWLINE}${generateSchema(
			parts.rest,
			context
		)})`;
	}

	return selectGenerator(schema, context).generate(schema, context);
}

/**
 * The structural keywords of a `$ref` node, or `undefined` when the dialect
 * should ignore them or only annotations/refinements are present. Refinements
 * are applied by `applyRefinements` on the whole node instead.
 */
export function refSiblingConstraints(
	schema: ParsedJSONSchemaObject
): ParsedJSONSchemaObject | undefined {
	const rest = withoutKeys(schema, ['$ref', ...ownAnnotationKeywords, ...refinementKeywords]);

	return hasStructuralKeywords(rest) ? rest : undefined;
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

type CombinatorKeyword = 'allOf' | 'anyOf' | 'oneOf' | 'const' | 'enum';

/**
 * The keyword whose generator ignores the rest of the schema. `$ref` is handled
 * by `generateCore`, which reads the dialect before deciding whether siblings
 * apply.
 */
function pickCombinatorKeyword(schema: ParsedJSONSchemaObject): CombinatorKeyword | undefined {
	if (schema.anyOf) {
		return 'anyOf';
	}

	if (schema.allOf) {
		return 'allOf';
	}

	if (schema.oneOf) {
		return 'oneOf';
	}

	if (schema.const !== undefined) {
		return 'const';
	}

	if (schema.enum !== undefined) {
		return 'enum';
	}

	return undefined;
}

const structuralKeywords = new Set<string>([
	'allOf',
	'anyOf',
	'oneOf',
	'const',
	'enum',
	'type',
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
	{ $id, title, description, examples, deprecated }: ParsedJSONSchemaObject
) {
	return ts`${expression}.meta(${JSON.stringify({ id: $id, title, description, examples, deprecated })})`;
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
