import { describe, expect } from 'vitest';

import { runTestCases, type TestCaseBase } from './test-utils';

import { link, normalize, rules, type JSONSchema } from '../src';

type NormalizerTestCase = TestCaseBase & {
	input: JSONSchema;
	output: JSONSchema;
};

describe('normalizer() rules', () => {
	const testCases: NormalizerTestCase[] = [
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
	];

	runTestCases(testCases, (testCase) => {
		const linkedSchema = link(testCase.input);
		const normalized = normalize({
			rootSchema: linkedSchema,
			dereferencedPaths: new WeakMap(),
			fileName: 'test.json',
			rules,
			options: {},
		});

		expect(normalized).toEqual(testCase.output);
	});
});
