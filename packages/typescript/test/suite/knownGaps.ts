/**
 * Test cases from the official JSON Schema Test Suite that the TypeScript
 * generator does not pass, with the reason. Every entry must still fail: when a
 * gap is fixed the case starts passing and the baseline test reports the stale
 * entry, which should then be removed.
 *
 * Cases that fail only because an invalid instance is accepted are not listed
 * here. TypeScript cannot express value constraints such as `minimum`,
 * `pattern`, `format`, `uniqueItems`, `dependencies` or `if`/`then`/`else`, so
 * those cases are counted as type gaps instead.
 */

const inference =
	'object and array keywords give an untyped schema its inferred type, so valid instances of other JSON types are rejected';

export const knownGaps = {
	// Untyped schemas: object and array keywords infer an object or an array.
	'additionalProperties.json :: additionalProperties being false does not allow other properties':
		inference,
	'id.json :: simple URN base URI with $ref via the URN': inference,
	'id.json :: simple tag URI base URI with $ref via the tag URI': inference,
	'id.json :: simple base URI using an arbitrary URI scheme with $ref to that URI': inference,
	'items.json :: a schema given for items': inference,
	'items.json :: an array of schemas for items': inference,
	'patternProperties.json :: patternProperties validates properties matching a regex': inference,
	'properties.json :: object properties validation': inference,
	'properties.json :: properties whose names are Javascript object property names': inference,
	'ref.json :: root pointer ref': inference,
	'required.json :: required validation': inference,
	'required.json :: required properties whose names are Javascript object property names':
		inference,
} satisfies Record<string, string>;
