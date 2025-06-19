import { describe, expect } from 'vitest';

import { runTestCases, type TestCaseBase } from './test-utils';

import { link, normalize, rules, type JSONSchema } from '../src';

type RuleTestCase = TestCaseBase & {
	fileName?: string;
	input: JSONSchema;
	output: JSONSchema;
};

describe('normalizer() rules', () => {
	const testCases: RuleTestCase[] = [
		{
			title: 'normalize definitions to $defs',
			input: {
				$id: 'foo',
				definitions: {
					bar: { const: 'bar' },
				},
			},
			output: {
				$id: 'foo',
				$defs: {
					bar: { const: 'bar' },
				},
			},
		},
		{
			title: 'normalize null-only schemas',
			input: {
				$id: 'foo',
				type: 'null',
				enum: [null],
			},
			output: {
				$id: 'foo',
				type: 'null',
			},
		},
		{
			title: 'destructure unary types',
			input: {
				$id: 'foo',
				type: ['string'],
			},
			output: {
				$id: 'foo',
				type: 'string',
			},
		},
		{
			title: 'add empty required property if none is defined',
			input: {
				$id: 'foo',
				type: 'object',
				properties: {
					bar: { type: 'string' },
				},
			},
			output: {
				$id: 'foo',
				type: 'object',
				properties: {
					bar: { type: 'string' },
				},
				required: [],
			},
		},
		{
			title: 'adds $id to top-level schema if missing',
			fileName: 'custom.json',
			input: {
				type: 'object',
				properties: {
					foo: { type: 'string' },
				},
			},
			output: {
				$id: 'Custom',
				type: 'object',
				properties: {
					foo: { type: 'string' },
				},
				required: [],
			},
		},
		{
			title: 'Normalize schema.minItems',
			input: { $id: 'foo', type: 'array', items: { type: 'string' } },
			output: {
				$id: 'foo',
				type: 'array',
				items: { type: 'string' },
				minItems: 0,
			},
		},
	];

	runTestCases(testCases, (testCase) => {
		const linkedSchema = link(testCase.input);
		const normalized = normalize({
			rootSchema: linkedSchema,
			dereferenceTrace: new WeakMap(),
			fileName: testCase.fileName ?? 'test.json',
			rules,
		});

		expect(normalized).toEqual(testCase.output);
	});
});

interface ErrorTestCase extends TestCaseBase {
	input: JSONSchema;
	expectedError: string;
}

describe('normalizer() throws', () => {
	const testCases: ErrorTestCase[] = [
		{
			title: 'throws if both definitions and $defs are present and not equal',
			input: {
				$id: 'foo',
				definitions: { bar: { const: 'bar' } },
				$defs: { baz: { const: 'baz' } },
			},
			expectedError:
				'Schema must define either definitions or $defs, not both. Given id=foo in test.json',
		},
	];

	runTestCases(testCases, (testCase) => {
		expect(() =>
			normalize({
				rootSchema: link(testCase.input),
				dereferenceTrace: new WeakMap(),
				fileName: 'test.json',
				rules,
			})
		).toThrow(testCase.expectedError);
	});
});
