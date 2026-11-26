import { expectDefined, isParsedJSONSchemaObject, withSourceMeta } from '@utilize/json-schema';
import type { ParsedJSONSchema, ParsedJSONSchemaObject } from '@utilize/json-schema';

import type { Context } from './context';
import { UnsupportedEffectSchemaFeatureError } from './errors';
import { applyChecks } from './expressions';
import { ANNOTATION_KEYWORDS } from './keywords';
import { mergeObjectSchemas } from './mergeObjects';
import { mergeTypedSchemas } from './mergePlan';
import { generateObject } from './object';
import { parentSchema } from './schemaParts';

export function generateAllOfExpression(
	schema: ParsedJSONSchemaObject,
	context: Context
): string | undefined {
	if (Array.isArray(schema.allOf) && schema.allOf.length > 0) {
		return generateIntersection([parentSchema(schema), ...schema.allOf], context);
	}

	return undefined;
}

/**
 * Merges `allOf` subschemas. Effect Schema has no generic intersection, so the
 * members have to reduce to either disjoint object schemas or one scalar type
 * with combinable constraints.
 */
function generateIntersection(schemas: ParsedJSONSchema[], context: Context): string {
	const flattened = flattenAllOf(schemas);

	if (flattened.includes(false)) {
		return 'Schema.Never';
	}

	const members = flattened.filter(
		(schema): schema is ParsedJSONSchemaObject =>
			isParsedJSONSchemaObject(schema) && !isEmptySchema(schema)
	);

	if (members.length === 0) {
		return 'Schema.Json';
	}

	if (members.length === 1) {
		return context.generateSchema(expectDefined(members[0]), context);
	}

	const result = mergeObjectSchemas(members);

	if (result.merged !== undefined) {
		return result.merged === false ? 'Schema.Never' : generateObject(result.merged, context);
	}

	const typed = mergeTypedSchemas(members);

	if (typed !== undefined) {
		return context.generateSchema(typed, context);
	}

	const conjunction = generateConjunction(members, context);

	if (conjunction !== undefined) {
		return conjunction;
	}

	throw new UnsupportedEffectSchemaFeatureError(
		'allOf',
		`the subschemas could not be merged or checked as filters (${result.reason})`
	);
}

/**
 * Combines `allOf` members that cannot be merged into one schema by checking
 * the value against each member instead. `anyOf` and `oneOf` are split so both
 * constrain the value; every other member is applied as a filter.
 */
function generateConjunction(
	members: ParsedJSONSchemaObject[],
	context: Context
): string | undefined {
	const parts: ParsedJSONSchemaObject[] = [];

	for (const member of members) {
		if (Array.isArray(member.anyOf) || Array.isArray(member.oneOf)) {
			const { anyOf, oneOf, ...rest } = member;
			const constraints = withSourceMeta(member, rest);

			// Keywords next to the union constrain the value as well, so they stay
			// a separate member instead of being dropped with the union.
			if (!isEmptySchema(constraints)) {
				parts.push(constraints);
			}

			// `anyOf` and `oneOf` both constrain the value, so they stay separate.
			if (Array.isArray(anyOf)) {
				parts.push(withSourceMeta(member, { anyOf }));
			}

			if (Array.isArray(oneOf)) {
				parts.push(withSourceMeta(member, { oneOf }));
			}

			continue;
		}

		parts.push(member);
	}

	if (parts.length < 2) {
		return undefined;
	}

	const [base, ...constraints] = parts;

	return applyChecks(
		context.generateSchema(expectDefined(base), context),
		constraints.map(
			(part) =>
				`Schema.makeFilter((value) => Schema.is(${context.generateSchema(part, context)})(value) ? undefined : 'Value does not match every schema in "allOf"')`
		)
	);
}

/** Removes the `allOf` that is being flattened and keeps every other keyword. */
function withoutAllOf(schema: ParsedJSONSchemaObject): ParsedJSONSchemaObject {
	return withSourceMeta(schema, { ...schema, allOf: undefined });
}

/**
 * Expands nested `allOf`, splitting the keywords declared next to it. Refinements
 * such as `not` and `if`/`then`/`else` stay on the split-off member, which is
 * generated as a normal member and turns them into filters.
 */
function flattenAllOf(schemas: ParsedJSONSchema[]): ParsedJSONSchema[] {
	const flattened: ParsedJSONSchema[] = [];

	for (const schema of schemas) {
		if (!isParsedJSONSchemaObject(schema)) {
			flattened.push(schema);
			continue;
		}

		const node = schema;

		if (!Array.isArray(node.allOf) || node.allOf.length === 0) {
			flattened.push(schema);
			continue;
		}

		const parent = withoutAllOf(node);

		if (!isEmptySchema(parent)) {
			flattened.push(parent);
		}

		flattened.push(...flattenAllOf(node.allOf));
	}

	return flattened;
}

/** A schema that only carries metadata, `true`, or no keywords at all. */
function isEmptySchema(schema: ParsedJSONSchemaObject): boolean {
	return Object.entries(schema).every(
		([keyword, value]) => value === undefined || ANNOTATION_KEYWORDS.has(keyword)
	);
}
