import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { readCoverage, splitFallowArguments } from './fallow-coverage.mjs';

test('splitFallowArguments strips only the reuse flag', () => {
	assert.deepEqual(
		splitFallowArguments(['--reuse-coverage', '--format', 'json', '--reuse-coverage']),
		['--format', 'json']
	);
});

test('readCoverage reads the coverage-final.json of a workspace', () => {
	const root = mkdtempSync(join(tmpdir(), 'utilize-fallow-coverage-'));

	try {
		const coverageDirectory = join(root, 'playground', 'coverage');
		mkdirSync(coverageDirectory, { recursive: true });
		writeFileSync(join(coverageDirectory, 'coverage-final.json'), '{"src/a.ts":{}}');

		assert.deepEqual(readCoverage('playground', root), { 'src/a.ts': {} });
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test('readCoverage explains missing reused coverage', () => {
	const root = mkdtempSync(join(tmpdir(), 'utilize-fallow-coverage-'));

	try {
		assert.throws(
			() => readCoverage('playground', root),
			/Missing .* Run "pnpm ci:test:coverage" before reusing coverage\./
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
