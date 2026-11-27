/** Shared full-conformance counts for the Zod and Effect runtime generators. */
export const runtimeBaseline = {
	'draft-04': { cases: 194, passing: 194, instances: 911, passingInstances: 911 },
	'draft-06': { cases: 263, passing: 263, instances: 1218, passingInstances: 1218 },
	'draft-07': { cases: 304, passing: 304, instances: 1655, passingInstances: 1655 },
	'2019-09': { cases: 417, passing: 417, instances: 2043, passingInstances: 2043 },
	'2020-12': { cases: 431, passing: 431, instances: 2082, passingInstances: 2082 },
} as const;
