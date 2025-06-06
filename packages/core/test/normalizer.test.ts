import { describe, expect, it } from 'vitest';

import { runTestCases, type TestCaseBase } from './test-utils';

import { link, normalize, rules, type JSONSchema } from '../src';

type NormalizerTestCase = TestCaseBase & {
	input: JSONSchema;
	output: JSONSchema;
};

describe('normalizer() rules', () => {
	it('throws on boolean schemas (true/false)', () => {
		expect(() =>
			normalize({
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				rootSchema: true as any,
				dereferencedPaths: new WeakMap(),
				fileName: 'test.json',
				rules,
				options: {},
			})
		).toThrow(
			'Boolean schemas (true/false) are not supported in this pipeline.'
		);

		expect(() =>
			normalize({
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				rootSchema: false as any,
				dereferencedPaths: new WeakMap(),
				fileName: 'test.json',
				rules,
				options: {},
			})
		).toThrow(
			'Boolean schemas (true/false) are not supported in this pipeline.'
		);
	});

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
