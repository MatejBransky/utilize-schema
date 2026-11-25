import { isPlainObject, withSourceMeta } from '@utilize/json-schema';
import type { ParsedJSONSchema, ParsedJSONSchemaObject } from '@utilize/json-schema';

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
