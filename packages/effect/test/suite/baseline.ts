/**
 * The recorded conformance baseline for the official JSON Schema Test Suite,
 * per dialect, for the Effect Schema generator.
 *
 * `cases` counts the cases this target runs for that dialect, `passing` the
 * cases where every valid instance is accepted and every invalid one rejected.
 * `instances` and `passingInstances` are the same numbers one level down. Known
 * gaps stay in the denominator: a badge must not hide them.
 *
 * `draft-07` is also pinned case by case in `knownFailures.ts`; the other
 * dialects are measured at case and instance counts. When conformance changes,
 * update the number on purpose in the same pull request. The suite test fails
 * on any change, and `pnpm badge:suite` reads this object to render
 * `.github/badges/suite-effect-<dialect>.svg`.
 */
export const baseline = {
	'draft-04': { cases: 194, passing: 173, instances: 911, passingInstances: 815 },
	'draft-06': { cases: 263, passing: 254, instances: 1218, passingInstances: 1107 },
	'draft-07': { cases: 304, passing: 286, instances: 1655, passingInstances: 1400 },
	'2019-09': { cases: 417, passing: 348, instances: 2043, passingInstances: 1678 },
	'2020-12': { cases: 431, passing: 346, instances: 2082, passingInstances: 1694 },
} as const;
