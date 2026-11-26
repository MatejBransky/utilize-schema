/**
 * The recorded conformance baseline for the official JSON Schema Test Suite,
 * per dialect, for the Zod generator.
 *
 * `cases` counts the cases this target runs for that dialect, `passing` the
 * cases where every valid instance is accepted and every invalid one rejected.
 * `instances` and `passingInstances` are the same numbers one level down. Known
 * gaps stay in the denominator: a badge must not hide them.
 *
 * Every dialect is pinned case by case in `knownFailuresByDialect.ts`;
 * `draft-07` also has a curated reason per case in `knownFailures.ts`. When
 * conformance changes, update the number on purpose in the same pull request. The suite test fails
 * on any change, and `pnpm badge:suite` reads this object to render
 * `.github/badges/suite-zod-<dialect>.svg`.
 */
export const baseline = {
	'draft-04': { cases: 194, passing: 173, instances: 911, passingInstances: 820 },
	'draft-06': { cases: 263, passing: 251, instances: 1218, passingInstances: 1106 },
	'draft-07': { cases: 304, passing: 283, instances: 1655, passingInstances: 1399 },
	'2019-09': { cases: 417, passing: 353, instances: 2043, passingInstances: 1695 },
	'2020-12': { cases: 431, passing: 351, instances: 2082, passingInstances: 1719 },
} as const;
