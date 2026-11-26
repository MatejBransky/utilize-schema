import assert from 'node:assert/strict';
import { test } from 'node:test';

import { describeHealth } from './fallow-health-report.mjs';
import {
	escapeHtml,
	formatMilliseconds,
	renderHealthPage,
	stripFaviconLinks,
	summarizeVitest,
} from './pages-reports.mjs';

const workspace = { id: 'example', name: '@utilize/example', package: '@utilize/example' };

function vitestReport(overrides = {}) {
	return {
		success: true,
		numTotalTestSuites: 3,
		numPassedTestSuites: 3,
		numFailedTestSuites: 0,
		numTotalTests: 12,
		numPassedTests: 11,
		numFailedTests: 0,
		numPendingTests: 1,
		numTodoTests: 0,
		testResults: [
			{ startTime: 1_000, endTime: 1_250 },
			{ startTime: 1_100, endTime: 1_400 },
		],
		...overrides,
	};
}

test('summarizes Vitest counts and wall-clock duration', () => {
	assert.deepEqual(summarizeVitest(workspace, vitestReport()), {
		id: 'example',
		name: '@utilize/example',
		success: true,
		suites: 3,
		passedSuites: 3,
		failedSuites: 0,
		tests: 12,
		passed: 11,
		failed: 0,
		pending: 1,
		todo: 0,
		duration: 400,
	});
});

test('handles a Vitest report with no test files', () => {
	const summary = summarizeVitest(
		workspace,
		vitestReport({ testResults: [], numTotalTests: 0, numPassedTests: 0, numPendingTests: 0 })
	);

	assert.equal(summary.duration, 0);
	assert.equal(summary.tests, 0);
});

test('escapes HTML metacharacters in report data', () => {
	assert.equal(
		escapeHtml(`<script>"alert('x')" & more</script>`),
		'&lt;script&gt;&quot;alert(&#39;x&#39;)&quot; &amp; more&lt;/script&gt;'
	);
});

test('formats benchmark timings in milliseconds', () => {
	assert.equal(formatMilliseconds(12.345), '12.3 ms');
	assert.equal(formatMilliseconds(0), '0.0 ms');
});

test('removes favicon links that the single-file Vitest report does not inline', () => {
	const html = `<head>\n  <link rel="icon" href="./favicon.ico" sizes="48x48" />\n  <link rel="icon" href="./favicon.svg" sizes="any" type="image/svg+xml" />\n  <title>Vitest</title>\n</head>`;

	assert.equal(stripFaviconLinks(html), '<head>\n  <title>Vitest</title>\n</head>');
});

test('renders the Fallow health detail page with formulas and drivers', () => {
	const report = describeHealth(
		{
			health_score: {
				formula_version: 3,
				score: 89.4,
				grade: 'A',
				penalties: { unit_size: 8.3, coupling: 2.3 },
			},
			summary: { functions_analyzed: 1268 },
			vital_signs: {
				functions_over_60_loc_per_k: 16.6,
				p95_fan_in: 10,
				coupling_high_pct: 4.6,
				counts: { files_scored: 152 },
			},
			file_scores: [{ path: 'a.ts', fan_in: 22, fan_out: 2, maintainability_index: 92, lines: 38 }],
		},
		{
			longFunctions: [
				{ path: 'a.ts', name: 'long', line: 10, lines: 100, cyclomatic: 5, cognitive: 4 },
			],
		}
	);
	const html = renderHealthPage(report, 'abc1234');

	assert.match(html, /Health score/);
	assert.match(html, /16\.6 × 0\.5 = 8\.3/);
	assert.match(html, /Functions longer than 60 lines/);
	assert.match(html, /a\.ts:10/);
	assert.match(html, /File length does not deduct points/);
});

test('renders the long-function fallback when the list is unavailable', () => {
	const report = describeHealth({
		health_score: {
			formula_version: 3,
			score: 89.4,
			grade: 'A',
			penalties: { unit_size: 8.3 },
		},
		summary: { functions_analyzed: 1268 },
		vital_signs: {
			functions_over_60_loc_per_k: 16.6,
			counts: { files_scored: 152 },
		},
		file_scores: [],
	});
	const html = renderHealthPage(report, 'abc1234');

	assert.match(html, /per-function list was not available/);
});
