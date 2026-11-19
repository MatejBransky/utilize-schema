/**
 * Test cases from the official JSON Schema Test Suite that the Zod generator
 * does not handle yet. Every entry turns its case into an expected failure, so
 * CI stays green while the gap stays visible.
 *
 * The failing instances of every case below are recorded in
 * `knownFailureInstances.ts`. A fix or a regression changes that set, which
 * makes the suite test fail. Re-run `pnpm --filter @utilize/zod
 * update:suite-baseline`, review the diff, and remove entries whose list is
 * empty.
 */

const prototypeNames =
	'property names that live on Object.prototype (__proto__, constructor) are not handled';

const idRefs = '$id/$anchor based $ref resolution is not implemented';

const idCycle = 'a self-referencing $id or URN schema is reported as an unsupported cycle';

const typelessCycle = 'a typeless recursive root cannot be represented as a type-safe Zod schema';

export const knownFailures: Record<string, string> = {
	// $id / $anchor resolution
	'id-legacy.json :: URN ref with nested pointer ref': idRefs,
	'id.json :: simple URN base URI with $ref via the URN': idCycle,
	'id.json :: simple base URI using an arbitrary URI scheme with $ref to that URI': idCycle,
	'id.json :: simple tag URI base URI with $ref via the tag URI': idCycle,

	// property names with special meaning
	'properties.json :: properties whose names are Javascript object property names': prototypeNames,
	'required.json :: required properties whose names are Javascript object property names':
		prototypeNames,

	// recursion
	'ref.json :: root pointer ref': typelessCycle,
};
