import { expectDefined, isPlainObject, withSourceMeta } from '@utilize/json-schema';
import type { ParsedJSONSchema, ParsedJSONSchemaObject } from '@utilize/json-schema';

import { constraintKeywords } from './constraints';
import type { Context } from './context';
import { applyChecks, siblingKeywordsCheck } from './expressions';

/** Keywords that keep a member from taking the `type` declared next to it. */
const SHAPE_KEYWORDS = ['type', '$ref', 'const', 'enum', 'allOf', 'anyOf', 'oneOf'];

export interface TypedAlternatives {
	members: ParsedJSONSchema[];
	/** Every member took the `type`, so the union already enforces it. */
	allTyped: boolean;
}

/**
 * The `anyOf`/`oneOf` members with the `type` declared next to the combinator,
 * so the union decodes to that type instead of any JSON value. "A or B, and of
 * type T" is "A and T, or B and T", and `oneOf` counts the same branches. Only
 * members made of plain constraints take the type; booleans, references,
 * literals, nested combinators and members with their own `type` stay as they
 * are.
 */
export function typedAlternatives(
	schema: ParsedJSONSchemaObject,
	alternatives: ParsedJSONSchema[]
): TypedAlternatives {
	if (schema.type === undefined) {
		return { members: alternatives, allTyped: false };
	}

	const members = alternatives.map((member) =>
		canTakeType(member) ? withSourceMeta(member, { ...member, type: schema.type }) : member
	);

	return {
		members,
		allTyped: members.every((member, index) => member !== alternatives[index]),
	};
}

function canTakeType(member: ParsedJSONSchema): member is ParsedJSONSchemaObject {
	return isPlainObject(member) && SHAPE_KEYWORDS.every((keyword) => member[keyword] === undefined);
}

export function generateAlternativeExpression(
	schema: ParsedJSONSchemaObject,
	context: Context
): string | undefined {
	const keyword = alternativeKeyword(schema);

	if (keyword === undefined) {
		return undefined;
	}

	const alternatives = expectDefined(schema[keyword]);
	// When both are present, each is applied on its own: `anyOf` becomes the
	// union and `oneOf` stays in the base, which counts its own matches.
	const { members, allTyped } = typedAlternatives(schema, alternatives);
	const union = generateUnion(members, keyword === 'oneOf', context);
	const base = alternativesBase(schema, keyword, allTyped);

	if (base === undefined) {
		return union;
	}

	const constraints = context.generateSchema(base, context);

	// Unknown keywords (`x-*`) generate `Schema.Json`, so a filter over them
	// would accept everything and only make the output noisier.
	if (constraints === 'Schema.Json') {
		return union;
	}

	return applyChecks(union, [siblingKeywordsCheck(constraints, keyword)]);
}

function alternativeKeyword(schema: ParsedJSONSchemaObject): 'anyOf' | 'oneOf' | undefined {
	if (Array.isArray(schema.anyOf)) {
		return 'anyOf';
	}

	return Array.isArray(schema.oneOf) ? 'oneOf' : undefined;
}

/**
 * The keywords declared next to `anyOf`/`oneOf`. They constrain the value on
 * their own, so the union alone would ignore them. The combinator that became
 * the union stays out, along with the annotations and the filter keywords,
 * which `generateSchema` handles on the whole node. A base with only `type`
 * adds nothing once every member took that type (see `typedAlternatives`).
 */
function alternativesBase(
	schema: ParsedJSONSchemaObject,
	applied: 'anyOf' | 'oneOf',
	allTyped: boolean
): ParsedJSONSchemaObject | undefined {
	const base = constraintKeywords(schema, new Set([applied]));
	const keywords = Object.keys(base);
	const onlyAppliedType = allTyped && keywords.length === 1 && keywords[0] === 'type';

	return keywords.length > 0 && !onlyAppliedType ? base : undefined;
}

function generateUnion(
	alternatives: ParsedJSONSchema[],
	exclusive: boolean,
	context: Context
): string {
	const generated = alternatives.map((member) => context.generateSchema(member, context));
	// `oneOf` counts how many branches match, so identical branches must stay.
	const members = exclusive ? generated : [...new Set(generated)];

	if (members.length === 0) {
		return 'Schema.Never';
	}

	if (members.length === 1) {
		return expectDefined(members[0]);
	}

	const options = exclusive ? ", { mode: 'oneOf' }" : '';

	return `Schema.Union([${members.join(', ')}]${options})`;
}
