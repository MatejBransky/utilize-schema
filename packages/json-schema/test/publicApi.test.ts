import { describe, expect, test } from 'vitest';

import { warnDialectIssue } from '../src';

/**
 * `warnDialectIssue` is exported for consumers that detect a dialect
 * themselves and want the same warning format as the parser. No module in this
 * package calls it, so this test is the only dependency path that reaches it.
 */
describe('public API', () => {
	test('exports the dialect warning helper', () => {
		expect(warnDialectIssue).toBeTypeOf('function');
	});
});
