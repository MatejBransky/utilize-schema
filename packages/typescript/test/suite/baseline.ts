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
		passing: 122,
		typeGaps: 53,
		gaps: 12,
		instances: 672,
		passingInstances: 542,
	},
	'draft-06': {
		cases: 253,
		passing: 169,
		typeGaps: 72,
		gaps: 12,
		instances: 878,
		passingInstances: 712,
	},
	'draft-07': {
		cases: 285,
		passing: 192,
		typeGaps: 81,
		gaps: 12,
		instances: 972,
		passingInstances: 795,
	},
	'2019-09': {
		cases: 396,
		passing: 244,
		typeGaps: 116,
		gaps: 36,
		instances: 1292,
		passingInstances: 1013,
	},
	'2020-12': {
		cases: 409,
		passing: 242,
		typeGaps: 128,
		gaps: 39,
		instances: 1319,
		passingInstances: 1024,
	},
} as const;
