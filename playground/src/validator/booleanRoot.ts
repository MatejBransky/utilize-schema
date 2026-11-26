import type { ValidatorReport } from './protocol';

/** Boolean JSON Schemas need no generated declaration or runtime package. */
export function booleanRootReport(accepts: boolean, data: unknown): ValidatorReport {
	if (!accepts) {
		return {
			ok: false,
			issues: [{ path: '$', message: 'The schema rejects all values.' }],
		};
	}

	try {
		return {
			ok: true,
			value: JSON.stringify(data, null, 2),
			issues: [],
		};
	} catch {
		return { ok: true, issues: [] };
	}
}
