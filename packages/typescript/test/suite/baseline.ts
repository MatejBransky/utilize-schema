/**
 * The recorded conformance baseline for the official JSON Schema Test Suite
 * (type level), per dialect.
 *
 * `passing` counts cases where every valid instance is accepted and every
 * invalid instance is rejected. `typeGaps` counts cases that differ only because
 * an instance is rejected by a validation keyword a TypeScript type cannot
 * express. `gaps` counts cases that crash, emit invalid TypeScript or reject a
 * valid instance; the per-dialect lists are in `knownGapCases.ts`, with curated
 * draft-07 reasons in `knownGaps.ts`.
 *
 * `cases` is the number of cases this target runs: the dialect's cases minus
 * the `format-assertion` ones, which a type cannot check. `instances` and
 * `passingInstances` are the same numbers one level down. Known gaps stay in
 * the denominator so a badge cannot hide them.
 *
 * When conformance changes, update the number on purpose in the same pull
 * request. The test fails on any change, and `pnpm badge:suite` reads this
 * object to render `.github/badges/suite-typescript-<dialect>.svg`.
 */
export const baseline = {
	'draft-04': {
		cases: 187,
		passing: 116,
		typeGaps: 52,
		gaps: 19,
		instances: 672,
		passingInstances: 528,
	},
	'draft-06': {
		cases: 253,
		passing: 173,
		typeGaps: 68,
		gaps: 12,
		instances: 878,
		passingInstances: 717,
	},
	'draft-07': {
		cases: 285,
		passing: 196,
		typeGaps: 77,
		gaps: 12,
		instances: 972,
		passingInstances: 800,
	},
	'2019-09': {
		cases: 396,
		passing: 248,
		typeGaps: 103,
		gaps: 45,
		instances: 1292,
		passingInstances: 994,
	},
	'2020-12': {
		cases: 409,
		passing: 242,
		typeGaps: 108,
		gaps: 59,
		instances: 1319,
		passingInstances: 1002,
	},
} as const;
