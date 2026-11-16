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

const patternProperties = 'patternProperties is not generated yet';

const oneOfKeyword = 'oneOf is emitted as z.union, so exactly-one semantics are not enforced';

const deepEquality = 'const/enum compare non-primitive values by identity instead of deep equality';

const format = 'format validation disagrees with the Zod helpers (strict or loose)';

const prototypeNames =
	'property names that live on Object.prototype (__proto__, constructor) are not handled';

const idRefs = '$id/$anchor based $ref resolution is not implemented';

const idCycle = 'a self-referencing $id or URN schema is reported as an unsupported cycle';

const typelessCycle = 'a typeless recursive root cannot be represented as a type-safe Zod schema';

export const knownFailures: Record<string, string> = {
	// patternProperties
	'additionalProperties.json :: additionalProperties being false does not allow other properties':
		patternProperties,
	'additionalProperties.json :: non-ASCII pattern with additionalProperties': patternProperties,
	'patternProperties.json :: multiple simultaneous patternProperties are validated':
		patternProperties,
	'patternProperties.json :: patternProperties validates properties matching a regex':
		patternProperties,
	'patternProperties.json :: patternProperties with boolean schemas': patternProperties,
	'patternProperties.json :: regexes are not anchored by default and are case sensitive':
		patternProperties,
	'properties.json :: properties, patternProperties, additionalProperties interaction':
		patternProperties,

	// oneOf
	'oneOf.json :: oneOf': oneOfKeyword,
	'oneOf.json :: oneOf complex types': oneOfKeyword,
	'oneOf.json :: oneOf with base schema': oneOfKeyword,
	'oneOf.json :: oneOf with boolean schemas, all true': oneOfKeyword,
	'oneOf.json :: oneOf with boolean schemas, more than one true': oneOfKeyword,
	'oneOf.json :: oneOf with empty schema': oneOfKeyword,
	'oneOf.json :: oneOf with missing optional property': oneOfKeyword,
	'oneOf.json :: oneOf with required': oneOfKeyword,

	// const/enum deep equality
	'const.json :: const with [false] does not match [0]': deepEquality,
	'const.json :: const with [true] does not match [1]': deepEquality,
	'const.json :: const with array': deepEquality,
	'const.json :: const with object': deepEquality,
	'const.json :: const with {"a": false} does not match {"a": 0}': deepEquality,
	'const.json :: const with {"a": true} does not match {"a": 1}': deepEquality,
	'enum.json :: enum with [0] does not match [false]': deepEquality,
	'enum.json :: enum with [1] does not match [true]': deepEquality,
	'enum.json :: enum with [false] does not match [0]': deepEquality,
	'enum.json :: enum with [true] does not match [1]': deepEquality,
	'enum.json :: heterogeneous enum validation': deepEquality,
	'ref-legacy.json :: naive replacement of $ref with its destination is not correct': deepEquality,

	// format
	'format-date-time.json :: validation of date-time strings': format,
	'format-email.json :: validation of e-mail addresses': format,
	'format-hostname.json :: validation of A-label (punycode) host names': format,
	'format-hostname.json :: validation of host names': format,
	'format-idn-email.json :: validation of an internationalized e-mail addresses': format,
	'format-idn-hostname.json :: validation of internationalized host names': format,
	'format-idn-hostname.json :: validation of separators in internationalized host names': format,
	'format-iri-reference.json :: validation of IRI References': format,
	'format-iri.json :: validation of IRIs': format,
	'format-json-pointer.json :: validation of JSON-pointers (JSON String Representation)': format,
	'format-regex.json :: validation of regular expressions': format,
	'format-relative-json-pointer.json :: validation of Relative JSON Pointers (RJP)': format,
	'format-time.json :: validation of time strings': format,
	'format-uri-reference.json :: validation of URI References': format,
	'format-uri-template.json :: validation of URI-Templates': format,
	'format-uri.json :: validation of URIs': format,

	// $id / $anchor resolution
	'anchor-legacy.json :: Location-independent identifier': idRefs,
	'anchor-legacy.json :: Location-independent identifier with base URI change in subschema': idRefs,
	'anchor-legacy.json :: Reference an anchor with a non-relative URI': idRefs,
	'anchor-legacy.json :: URN base URI with URN and anchor ref': idRefs,
	'id-legacy.json :: $ref prevents a sibling $id from changing the base uri': idRefs,
	'id-legacy.json :: URN ref with nested pointer ref': idRefs,
	'id-legacy.json :: ref with absolute-path-reference': idRefs,
	'id-legacy.json :: refs with relative uris and defs': idRefs,
	'id-legacy.json :: relative refs with absolute uris and defs': idRefs,
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
