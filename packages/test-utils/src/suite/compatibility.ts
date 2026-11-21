/**
 * The JSON Schema Test Suite keeps every dialect in one file and marks each
 * test case with a `compatibility` string. This module implements the matching
 * algorithm from `validation/README.md#compatibility-matching`.
 *
 * Dialect tokens are the release number: `4`, `6`, `7` for drafts and `2019`,
 * `2020` for the date-based releases. `9999` marks unreleased behavior.
 */
export type Dialect = 3 | 4 | 6 | 7 | 2019 | 2020 | 9999;

/** The dialect this package targets: JSON Schema draft-07. */
export const DRAFT_7: Dialect = 7;

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
		const dialect = Number(digits) as Dialect;

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
