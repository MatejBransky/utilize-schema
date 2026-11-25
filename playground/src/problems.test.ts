import { expect, test } from 'vitest';

import type { BundleResult } from './bundle';
import { collectProblems } from './problems';

function bundle(problems: BundleResult['problems']): BundleResult['problems'] {
	return problems;
}

test('keeps schema, bundle, and generation problems in order', () => {
	const schema = [{ severity: 'warning' as const, message: 'schema' }];
	const bundled = bundle([{ severity: 'error' as const, message: 'bundle' }]);
	const generation = [{ severity: 'error' as const, message: 'generation' }];

	expect(collectProblems(schema, bundled, generation)).toEqual([
		...schema,
		...bundled,
		...generation,
	]);
});

test('suppresses generation issues already reported by the bundle regardless of file', () => {
	const bundled = bundle([
		{ fileId: 'root', severity: 'error', message: 'Invalid type (line 2, col 3)' },
	]);
	const generation = [
		{ fileId: 'other', severity: 'error' as const, message: 'Invalid type (line 9, col 1)' },
		{ severity: 'warning' as const, message: 'Invalid type (line 2, col 3)' },
		{ severity: 'error' as const, message: 'Different issue (line 2, col 3)' },
	];

	expect(collectProblems([], bundled, generation)).toEqual([
		...bundled,
		generation[1],
		generation[2],
	]);
});

test('deduplicates by file, severity, message, and line but not column', () => {
	const first = {
		fileId: 'root',
		severity: 'error' as const,
		message: 'Issue',
		line: 2,
		column: 1,
	};
	const second = { ...first, column: 8 };
	const otherLine = { ...first, line: 3 };
	const otherFile = { ...first, fileId: 'child' };

	expect(collectProblems([first], [second, otherLine, otherFile], [])).toEqual([
		first,
		otherLine,
		otherFile,
	]);
});

test('treats a missing line as distinct from line one', () => {
	const noLine = { severity: 'error' as const, message: 'Issue' };
	const lineOne = { ...noLine, line: 1 };

	expect(collectProblems([noLine], [lineOne], [])).toEqual([noLine, lineOne]);
});
