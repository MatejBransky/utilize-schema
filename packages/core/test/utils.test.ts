import { describe, expect, test } from 'vitest';

import { type TestCaseBase } from './test-utils';

import { Parent } from '../src';
import {
	isPlainObject,
	isSchemaLike,
	justName,
	toSafeString,
} from '../src/utils';

interface IsPlainObjectTestCase extends TestCaseBase {
	input: unknown;
	expected: boolean;
}

describe('isPlainObject', () => {
	const testCases: IsPlainObjectTestCase[] = [
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
		{ title: 'const', input: { const: 'value' }, expected: false },
	];

	testCases.forEach(({ title, input, expected }) => {
		test(`returns ${expected} for ${title}`, () => {
			expect(isPlainObject(input)).toBe(expected);
		});
	});
});

interface JustNameTestCase {
	input: string;
	expected: string;
}

describe('justName', () => {
	const testCases: JustNameTestCase[] = [
		{ input: '', expected: '' },
		{ input: 'foo', expected: 'foo' },
		{ input: 'foo.json', expected: 'foo' },
		{ input: 'foo/bar/baz.json', expected: 'baz' },
		{ input: 'foo\\bar\\baz.schema.ts', expected: 'baz.schema' },
	];

	testCases.forEach(({ input, expected }) => {
		test(`"${input}" -> "${expected}"`, () => {
			expect(justName(input)).toBe(expected);
		});
	});
});

interface ToSafeStringTestCase {
	input: string;
	expected: string;
}

describe('toSafeString', () => {
	const testCases: ToSafeStringTestCase[] = [
		{ input: 'foo bar', expected: 'FooBar' },
		{ input: 'foo-bar', expected: 'FooBar' },
		{ input: 'Český název', expected: 'CeskyNazev' },
		{ input: '  123$abc_def ', expected: '$AbcDef' },
		{ input: 'déjà vu', expected: 'DejaVu' },
		{ input: 'foo_bar_baz', expected: 'FooBarBaz' },
		{ input: '_private', expected: '_Private' },
	];

	testCases.forEach(({ input, expected }) => {
		test(`"${input}" -> "${expected}"`, () => {
			expect(toSafeString(input)).toBe(expected);
		});
	});
});

interface IsSchemaLikeTestCase {
	title: string;
	input: unknown;
	expected: boolean;
}

describe('isSchemaLike', () => {
	const testCases: IsSchemaLikeTestCase[] = [
		{
			title: 'plain object with Parent=null',
			input: { [Parent]: null },
			expected: true,
		},
		{
			title: 'null',
			input: null,
			expected: false,
		},
		{
			title: 'number',
			input: 42,
			expected: false,
		},
		{
			title: 'string',
			input: 'string',
			expected: false,
		},
		// I don't know what should be the expected result for an empty object
		// {
		// title: 'empty object',
		// 	input: {},
		// 	expected: false,
		// },
		{
			title: 'child schema in parent',
			input: (() => {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const parent = { properties: {} as any };
				const child = { [Parent]: parent };
				parent.properties.foo = child;
				return child;
			})(),
			expected: true,
		},
	];

	testCases.forEach(({ title, input, expected }) => {
		test(`returns ${expected} for ${title}`, () => {
			expect(isSchemaLike(input)).toBe(expected);
		});
	});
});
