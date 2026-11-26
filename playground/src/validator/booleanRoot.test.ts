import { expect, test } from 'vitest';

import { booleanRootReport } from './booleanRoot';

test('a true root accepts every JSON value without a runtime module', () => {
	expect(booleanRootReport(true, { nested: [1, null] })).toEqual({
		ok: true,
		value: JSON.stringify({ nested: [1, null] }, null, 2),
		issues: [],
	});
});

test('a true root still accepts deeply nested JSON when formatting overflows', () => {
	let data: unknown = 'leaf';

	for (let depth = 0; depth < 50_000; depth += 1) {
		data = [data];
	}

	expect(booleanRootReport(true, data)).toEqual({ ok: true, issues: [] });
});

test('a false root rejects every JSON value with a validation issue', () => {
	expect(booleanRootReport(false, 'anything')).toEqual({
		ok: false,
		issues: [{ path: '$', message: 'The schema rejects all values.' }],
	});
});
