/**
 * The recorded conformance baseline for the official JSON Schema Test Suite
 * (draft-07, type level). These numbers are a record of what the generator does
 * today, not a claim that every remaining gap is acceptable.
 *
 * `conformant` counts cases where every valid instance is accepted and every
 * invalid instance is rejected. `typeGaps` counts cases that differ only because
 * an instance is rejected by a validation keyword a TypeScript type cannot
 * express. Cases that crash or reject a valid instance are listed in
 * `knownGaps.ts` and are not part of either number.
 *
 * When conformance improves, raise the numbers on purpose in the same pull
 * request. The test fails on any change.
 */
export const baseline = {
	conformant: 186,
	typeGaps: 100,
};
