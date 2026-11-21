import { describe, expect, test } from 'vitest';

import { DRAFT_7, isCompatible } from '../src/suite/compatibility';

describe('isCompatible', () => {
	test('a missing constraint applies to every dialect', () => {
		expect(isCompatible(undefined)).toBe(true);
		expect(isCompatible(undefined, DRAFT_7)).toBe(true);
	});

	test('a bare number is the minimum dialect', () => {
		expect(isCompatible('7')).toBe(true);
		expect(isCompatible('2019')).toBe(false);
		expect(isCompatible('6')).toBe(true);
	});

	test('a <= constraint is the maximum dialect', () => {
		expect(isCompatible('<=7')).toBe(true);
		expect(isCompatible('<=6')).toBe(false);
		expect(isCompatible('<=2020')).toBe(true);
	});

	test('an = constraint matches a single dialect', () => {
		expect(isCompatible('=7')).toBe(true);
		expect(isCompatible('=2019')).toBe(false);
	});

	test('comma separated constraints form a union of ranges', () => {
		expect(isCompatible('6,<=2019')).toBe(true);
		expect(isCompatible('3,<=4')).toBe(false);
		expect(isCompatible('=3,7,<=2020')).toBe(true);
		expect(isCompatible('<=3,7')).toBe(true);
		expect(isCompatible('4,<=6,9999')).toBe(false);
	});

	test('the dialect can be changed', () => {
		expect(isCompatible('2019', 2019)).toBe(true);
		expect(isCompatible('=3', 3)).toBe(true);
	});
});
