import { describe, expect, test } from 'vitest';

import { expectDefined } from '../src/utils';

describe('expectDefined', () => {
	test('returns a defined value', () => {
		expect(expectDefined(0)).toBe(0);
		expect(expectDefined('value')).toBe('value');
	});

	test('throws for null and undefined', () => {
		expect(() => expectDefined(undefined)).toThrow('Expected a defined value');
		expect(() => expectDefined(null)).toThrow('Expected a defined value');
		expect(() => expectDefined(undefined, 'custom message')).toThrow('custom message');
	});
});
