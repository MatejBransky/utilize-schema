import { describe, expect, test } from 'vitest';

import { formatSource, normalizeCode, ts } from '../src/code';
import { renderKnownFailureInstances } from '../src/suite/baseline';
import { evaluateGeneratedCode } from '../src/suite/evaluate';
import { loadSuiteFiles, suiteCaseKey } from '../src/suite/loadSuite';

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
