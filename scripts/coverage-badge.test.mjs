import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { calculatePercent, readLineCoveragePercent } from './coverage-badge.mjs';

test('calculatePercent floors the line coverage', () => {
	assert.equal(calculatePercent('LF:10\nLH:9\n'), 90);
	assert.equal(calculatePercent('LF:3\nLH:2\nLF:3\nLH:3\n'), 83);
});

test('readLineCoveragePercent reads lcov.info from the package coverage directory', () => {
	const root = mkdtempSync(join(tmpdir(), 'utilize-coverage-badge-'));

	try {
		const coverageDirectory = join(root, 'packages', 'zod', 'coverage');
		mkdirSync(coverageDirectory, { recursive: true });
		writeFileSync(join(coverageDirectory, 'lcov.info'), 'LF:10\nLH:7\n');

		assert.equal(readLineCoveragePercent('zod', root), 70);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test('readLineCoveragePercent explains missing coverage', () => {
	const root = mkdtempSync(join(tmpdir(), 'utilize-coverage-badge-'));

	try {
		assert.throws(
			() => readLineCoveragePercent('zod', root),
			/Missing .* Run "pnpm ci:test:coverage" before reading the coverage badges\./
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
