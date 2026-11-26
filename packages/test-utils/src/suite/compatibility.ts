/**
 * The JSON Schema Test Suite keeps every dialect in one file and marks each
 * test case with a `compatibility` string. This module implements the matching
 * algorithm from `validation/README.md#compatibility-matching`.
 *
 * Dialect tokens are the release number: `4`, `6`, `7` for drafts and `2019`,
 * `2020` for the date-based releases. `9999` marks unreleased behavior.
 */
export type Dialect = 3 | 4 | 6 | 7 | 2019 | 2020 | 9999;

/** The dialect the generators target: JSON Schema draft-07. */
export const DRAFT_7: Dialect = 7;

/**
 * Every other dialect the conformance baselines measure, keyed by the name the
 * suite badges and baselines use. Draft-07 is measured case by case and keeps
 * its own token above.
 */
export const OTHER_DIALECTS = {
	'draft-04': 4,
	'draft-06': 6,
	'2019-09': 2019,
	'2020-12': 2020,
} as const satisfies Record<string, Dialect>;

const DIALECTS: ReadonlySet<number> = new Set([3, DRAFT_7, ...Object.values(OTHER_DIALECTS), 9999]);

function isDialect(value: number): value is Dialect {
	return DIALECTS.has(value);
}

export function isCompatible(compatibility: string | undefined, version: Dialect = DRAFT_7) {
	if (!compatibility) {
		return true;
	}

	let isValid = true;

	for (const constraint of compatibility.split(',')) {
		const match = /^(<=|=)?(\d+)$/.exec(constraint.trim());

		if (!match) {
			throw new Error(`Unsupported compatibility constraint: "${compatibility}"`);
		}

		const [, operator = '', digits] = match;
		const dialect = Number(digits);

		if (!isDialect(dialect)) {
			throw new Error(`Unsupported compatibility dialect: "${digits}"`);
		}

		if (operator === '') {
			isValid = version >= dialect;
		} else if (operator === '<=') {
			isValid = version <= dialect;
		} else {
			isValid = version === dialect;
		}

		// Constraints are ordered, so anything after the first one that is not
		// lower than the tested version cannot change the result.
		if (version <= dialect) {
			break;
		}
	}

	return isValid;
}
