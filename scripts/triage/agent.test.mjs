import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeResult } from './agent.mjs';

test('normalizes package labels with and without the pkg: prefix', () => {
	const result = normalizeResult({
		reproducible: true,
		skipped: false,
		verdict: 'bug',
		fixed: false,
		packages: ['zod', 'pkg: effect', 'pkg:json-schema'],
	});
	assert.deepEqual(result.packages, ['pkg: zod', 'pkg: effect', 'pkg: json-schema']);
});

test('rejects a skipped result without a valid reason', () => {
	assert.throws(
		() => normalizeResult({ skipped: true, skippedReason: null, verdict: 'unclear' }),
		/skippedReason/
	);
	assert.throws(
		() => normalizeResult({ skipped: true, skippedReason: 'nope', verdict: 'unclear' }),
		/skippedReason/
	);
});

test('defaults unknown optional fields safely', () => {
	const result = normalizeResult({ reproducible: true, verdict: 'bug' });
	assert.equal(result.fixed, false);
	assert.equal(result.priority, null);
	assert.deepEqual(result.packages, []);
	assert.deepEqual(result.checks, []);
	assert.equal(result.verdict, 'bug');
});
