import {
	ANNOTATION_KEYWORDS,
	schemaRecord,
	dialectOf,
	isKeywordApplicable,
	withSourceMeta,
} from '@utilize/json-schema';
import type { Dialect, ParsedJSONSchemaObject } from '@utilize/json-schema';

import { valueHasType } from './jsonValues';

/**
 * The structural keywords of a `$ref` node, or `undefined` when the dialect
 * should ignore them or only annotations/refinements are present. Refinements
 * are applied by `applyRefinements` on the whole node instead.
 */
export function refSiblingConstraints(
	schema: ParsedJSONSchemaObject
): ParsedJSONSchemaObject | undefined {
	const rest = withoutKeys(schema, ['$ref', ...ANNOTATION_KEYWORDS, ...refinementKeywords]);

	return hasStructuralKeywords(rest) ? rest : undefined;
}

/**
 * Splits a schema that combines a combinator with sibling constraints into the
 * combinator alone and the remaining structural keywords. Returns `undefined`
 * when there is nothing to intersect. The value-type renderer mirrors this
 * split, so generated types match runtime validation.
 *
 * Callers handle a `$ref` node first (see `isRefNode`), so it never gets here.
 */
export function composedSchemaParts(
	schema: ParsedJSONSchemaObject
): { main: ParsedJSONSchemaObject; rest: ParsedJSONSchemaObject } | undefined {
	const keyword = pickCombinatorKeyword(schema);

	if (!keyword) {
		return undefined;
	}

	const rest = withoutKeys(schema, [keyword, ...ANNOTATION_KEYWORDS, ...refinementKeywords]);

	if (!hasStructuralKeywords(rest) || isTypedLiteral(schema)) {
		return undefined;
	}

	const value: unknown = schema[keyword];
	const main = withSourceMeta(schema, {
		[keyword]: value,
		discriminator: schema.discriminator,
	});

	return { main, rest };
}

/**
 * True when `type` is the only constraint next to a `const` or `enum` and every
 * listed value already has that type, e.g. `{ type: 'string', const: 'a' }`.
 * The literal alone validates the same values, so the type is not generated.
 */
export function isTypedLiteral(
	schema: ParsedJSONSchemaObject,
	dialect: Dialect = dialectOf(schema)
): boolean {
	const keyword = pickCombinatorKeyword(schema);

	if (schema.type === undefined || (keyword !== 'const' && keyword !== 'enum')) {
		return false;
	}

	if (keyword === 'const' && !isKeywordApplicable(dialect, 'const')) {
		return false;
	}

	const rest = withoutKeys(schema, [
		keyword,
		'type',
		...ANNOTATION_KEYWORDS,
		...refinementKeywords,
	]);

	if (hasStructuralKeywords(rest)) {
		return false;
	}

	const types = [schema.type].flat();
	const values = keyword === 'const' ? [schema.const] : (schema.enum ?? []);

	return values.every((value) => types.some((type) => valueHasType(value, type)));
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
	const record = schemaRecord(schema);

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
	const entries = Object.entries(schema).filter(([key]) => !keys.includes(key));

	return withSourceMeta(schema, Object.fromEntries(entries));
}

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
