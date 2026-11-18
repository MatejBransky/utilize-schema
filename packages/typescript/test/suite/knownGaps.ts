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

const parserId =
	'$id/$anchor based $ref resolution is not implemented in the shared parser (same gap as @utilize/zod)';

const inference =
	'object and array keywords give an untyped schema its inferred type, so valid instances of other JSON types are rejected';

export const knownGaps: Record<string, string> = {
	// Shared parser: $id/$anchor and URN resolution.
	'anchor-legacy.json :: Location-independent identifier': parserId,
	'anchor-legacy.json :: Location-independent identifier with base URI change in subschema':
		parserId,
	'anchor-legacy.json :: Reference an anchor with a non-relative URI': parserId,
	'anchor-legacy.json :: URN base URI with URN and anchor ref': parserId,
	'id-legacy.json :: $ref prevents a sibling $id from changing the base uri': parserId,
	'id-legacy.json :: refs with relative uris and defs': parserId,
	'id-legacy.json :: relative refs with absolute uris and defs': parserId,
	'id-legacy.json :: ref with absolute-path-reference': parserId,
	'id-legacy.json :: URN ref with nested pointer ref': parserId,

	// Shared parser: boolean schemas behind $ref.

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
};
