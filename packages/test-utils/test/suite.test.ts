import { describe, expect, test } from 'vitest';

import { formatSource, normalizeCode, ts } from '../src/code';
import { renderKnownFailureInstances } from '../src/suite/baseline';
import { evaluateGeneratedCode } from '../src/suite/evaluate';
import { loadSuiteFiles, suiteCaseKey } from '../src/suite/loadSuite';
import type { SuiteFile } from '../src/suite/loadSuite';
import { measureDialect } from '../src/suite/measureDialect';
import { DRAFT_7 } from '../src/suite/compatibility';

describe('code', () => {
	test('ts formats the expected code like formatSource', async () => {
		expect(await ts`const a = {b:1}`).toBe(await formatSource('const a = {b:1}'));
		expect(await ts`const a = {b:1}`).toBe('const a = { b: 1 };\n');
	});

	test('normalizeCode normalizes line endings and trims', () => {
		expect(normalizeCode('\r\na\r\nb\rc\n')).toBe('a\nb\nc');
	});
});

describe('evaluateGeneratedCode', () => {
	test('returns the Root declaration of a module', () => {
		const code = 'export type Root = number;\nexport const Root = value + 1;';

		expect(evaluateGeneratedCode(code, { value: 1 })).toBe(2);
	});

	test('returns a bare expression', () => {
		expect(evaluateGeneratedCode('value * 2', { value: 3 })).toBe(6);
	});
});

describe('renderKnownFailureInstances', () => {
	test('renders one entry per key', () => {
		const instances = { 'first.json :: a': 'compile', 'second.json :: b': ['x', 'y'] } as const;

		expect(renderKnownFailureInstances({ ...instances, 'second.json :: b': ['x', 'y'] })).toBe(
			[
				`\t"first.json :: a": 'compile',`,
				`\t"second.json :: b": [`,
				`\t\t"x",`,
				`\t\t"y",`,
				`\t],`,
			].join('\n')
		);
	});
});

describe('measureDialect', () => {
	test('counts compatible cases and instances, including compile failures', async () => {
		const files: SuiteFile[] = [
			{
				name: 'sample.json',
				description: '',
				cases: [
					{
						description: 'passing',
						schema: true,
						tests: [
							{ description: 'valid', data: 'accepted', valid: true },
							{ description: 'invalid', data: 'rejected', valid: false },
						],
					},
					{
						description: 'validation gap',
						schema: true,
						compatibility: '=7',
						tests: [
							{ description: 'valid', data: 'accepted', valid: true },
							{ description: 'invalid', data: 'rejected', valid: false },
						],
					},
					{
						description: 'compile gap',
						schema: true,
						tests: [{ description: 'valid', data: 'accepted', valid: true }],
					},
					{
						description: 'other dialect',
						schema: true,
						compatibility: '=4',
						tests: [{ description: 'valid', data: 'accepted', valid: true }],
					},
				],
			},
		];
		const compiled: string[] = [];

		const { counts, failing } = await measureDialect(
			files,
			DRAFT_7,
			(testCase) => {
				compiled.push(testCase.description);

				if (testCase.description === 'compile gap') {
					throw new Error('cannot compile');
				}

				return testCase.description;
			},
			(schema, data) =>
				schema === 'passing'
					? data === 'accepted'
					: schema === 'validation gap' && data === 'rejected'
		);

		expect(compiled).toEqual(['passing', 'validation gap', 'compile gap']);
		expect(counts).toEqual({ cases: 3, passing: 1, instances: 5, passingInstances: 2 });
		expect(failing).toEqual([
			'sample.json :: validation gap (2 failed)',
			'sample.json :: compile gap (1 failed)',
		]);
	});
});

describe('loadSuiteFiles', () => {
	test('reads the suite files in name order', () => {
		const files = loadSuiteFiles();
		const names = files.map((file) => file.name);
		const first = files[0]!;

		expect(names.length).toBeGreaterThan(0);
		expect(names.every((name, index) => index === 0 || names[index - 1]! < name)).toBe(true);
		expect(suiteCaseKey(first, first.cases[0]!)).toBe(
			`${first.name} :: ${first.cases[0]!.description}`
		);
	});
});
