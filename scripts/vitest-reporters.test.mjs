import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import { createReporters } from './vitest-reporters.mjs';

const originalGitHubActions = process.env.GITHUB_ACTIONS;
const originalReportDirectory = process.env.TEST_REPORT_DIR;

afterEach(() => {
	if (originalGitHubActions === undefined) {
		delete process.env.GITHUB_ACTIONS;
	} else {
		process.env.GITHUB_ACTIONS = originalGitHubActions;
	}

	if (originalReportDirectory === undefined) {
		delete process.env.TEST_REPORT_DIR;
	} else {
		process.env.TEST_REPORT_DIR = originalReportDirectory;
	}
});

void test('uses only the default reporter outside CI unless reports are requested', () => {
	delete process.env.GITHUB_ACTIONS;
	delete process.env.TEST_REPORT_DIR;

	assert.deepEqual(createReporters('workspace tests', 'workspace'), ['default']);
});

void test('adds the GitHub Actions reporter and job summary in CI', () => {
	process.env.GITHUB_ACTIONS = 'true';
	delete process.env.TEST_REPORT_DIR;

	assert.deepEqual(createReporters('workspace tests', 'workspace'), [
		'default',
		['github-actions', { jobSummary: { title: 'workspace tests' } }],
	]);
});

void test('writes a self-contained HTML report and JSON results per workspace', () => {
	delete process.env.GITHUB_ACTIONS;
	process.env.TEST_REPORT_DIR = '/reports/tests';

	const [htmlOptions] = createReporters('workspace tests', 'workspace').at(-2).slice(1);
	assert.deepEqual(htmlOptions, {
		outputDir: '/reports/tests/workspace',
		singleFile: true,
	});

	const [jsonOptions] = createReporters('workspace tests', 'workspace').at(-1).slice(1);
	assert.equal(jsonOptions.outputFile, '/reports/tests/workspace/results.json');
});
