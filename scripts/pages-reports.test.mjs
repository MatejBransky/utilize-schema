import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
	escapeHtml,
	formatMilliseconds,
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
