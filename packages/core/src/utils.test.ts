import { describe, test, expect } from 'vitest';

import { isPlainObject } from './utils';

describe('isPlainObject', () => {
	const testCases = [
		{ title: 'empty object literal', input: {}, expected: true },
		{
			title: 'object created with new Object()',
			input: new Object(),
			expected: true,
		},
		{
			title: 'object with null prototype',
			input: Object.create(null),
			expected: true,
		},
		{ title: 'array', input: [1, 2, 3], expected: false },
		{ title: 'null', input: null, expected: false },
		{ title: 'undefined', input: undefined, expected: false },
		{ title: 'number', input: 42, expected: false },
		{ title: 'string', input: 'string', expected: false },
		{ title: 'arrow function', input: () => {}, expected: false },
		{ title: 'function expression', input: function () {}, expected: false },
		{
			title: 'instance of a class',
			input: new (class MyClass {})(),
			expected: false,
		},
		{ title: 'regular expression', input: /regex/, expected: false },
		{ title: 'Date object', input: new Date(), expected: false },
		{ title: 'some object', input: { a: 1, b: 2 }, expected: true },
	];

	testCases.forEach(({ title, input, expected }) => {
		test(`returns ${expected} for ${title}`, () => {
			expect(isPlainObject(input)).toBe(expected);
		});
	});
});
