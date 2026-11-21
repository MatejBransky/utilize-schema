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

const format = 'format validation disagrees with the Zod helpers (strict or loose)';

const idRefs = '$id/$anchor based $ref resolution is not implemented';

const idCycle = 'a self-referencing $id or URN schema is reported as an unsupported cycle';

const typelessCycle = 'a typeless recursive root cannot be represented as a type-safe Zod schema';

export const knownFailures: Record<string, string> = {
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
	'id-legacy.json :: URN ref with nested pointer ref': idRefs,
	'id.json :: simple URN base URI with $ref via the URN': idCycle,
	'id.json :: simple base URI using an arbitrary URI scheme with $ref to that URI': idCycle,
	'id.json :: simple tag URI base URI with $ref via the tag URI': idCycle,

	// recursion
	'ref.json :: root pointer ref': typelessCycle,
};
