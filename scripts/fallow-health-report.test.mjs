import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
	describeHealth,
	fileScores,
	formatNumber,
	healthSection,
	parseLongFunctions,
	renderHealthMarkdown,
} from './fallow-health-report.mjs';

const health = {
	health_score: {
		formula_version: 3,
		score: 89.4,
		grade: 'A',
		penalties: {
			dead_files: 0,
			dead_exports: 0,
			complexity: 0,
			p90_complexity: 0,
			maintainability: 0,
			hotspots: 0,
			unused_deps: 0,
			circular_deps: 0,
			unit_size: 8.3,
			coupling: 2.3,
			duplication: 0,
		},
	},
	summary: { functions_analyzed: 1268 },
	vital_signs: {
		functions_over_60_loc_per_k: 16.6,
		p95_fan_in: 10,
		coupling_high_pct: 4.6,
		counts: { total_files: 172, files_scored: 152 },
	},
	file_scores: [
		{ path: 'a.ts', fan_in: 22, fan_out: 2, maintainability_index: 92, lines: 38 },
		{ path: 'b.ts', fan_in: 10, fan_out: 1, maintainability_index: 90, lines: 20 },
		{ path: 'c.ts', fan_in: 11, fan_out: 5, maintainability_index: 80, lines: 10 },
	],
};

test('reads a health section from a health or combined result', () => {
	assert.equal(healthSection(health), health);
	assert.equal(healthSection({ health }), health);
	assert.equal(healthSection(undefined), undefined);
});

test('describes the deductions and the measurement behind each one', () => {
	const report = describeHealth(health);

	assert.equal(report.score, 89.4);
	assert.equal(report.grade, 'A');
	assert.equal(report.totalDeduction, 10.6);
	assert.deepEqual(
		report.deducted.map((penalty) => penalty.key),
		['unit_size', 'coupling']
	);
	assert.equal(report.counts.longFunctionCount, 21);
	assert.equal(report.counts.highFanInCount, 2);
	assert.match(report.deducted[0].measurement.detail, /21 of 1268 functions/);
	assert.match(report.deducted[1].measurement.detail, /2 files listed below/);
	assert.equal(report.deducted[0].formula, '16.6 × 0.5 = 8.3');
	assert.equal(report.deducted[1].formula, '4.6 × 0.5 = 2.3');
});

test('uses the measured long-function list when it is available', () => {
	const report = describeHealth(health, {
		longFunctions: [
			{ path: 'a.ts', name: 'long', line: 10, lines: 100, cyclomatic: 5, cognitive: 4 },
		],
	});

	assert.equal(report.counts.longFunctionCount, 1);
	assert.equal(report.longFunctions.length, 1);
});

test('renders the breakdown with source links for the job summary', () => {
	const report = describeHealth(health, {
		longFunctions: [
			{ path: 'a.ts', name: 'long', line: 10, lines: 100, cyclomatic: 5, cognitive: 4 },
		],
	});
	const markdown = renderHealthMarkdown(report, {
		repository: 'https://github.com/example/repo',
		commit: 'abc1234',
	});

	assert.match(markdown, /### Fallow health: 89\.4 \(A\)/);
	assert.match(markdown, /deducts \*\*10\.6\*\* points/);
	assert.match(markdown, /\| Function size \| −8\.3 \/ 10 \| 16\.6 × 0\.5 = 8\.3 \|/);
	assert.match(markdown, /1 of 1268 functions/);
	assert.match(
		markdown,
		/\[<code>a\.ts:10<\/code>\]\(https:\/\/github\.com\/example\/repo\/blob\/abc1234\/a\.ts#L10\)/
	);
	assert.match(markdown, /2 files imported by more than 10 files/);
	assert.match(markdown, /File length does not deduct points/);
});

test('renders a zero-deduction report without an empty deduction table', () => {
	const report = describeHealth({
		...health,
		health_score: {
			...health.health_score,
			score: 100,
			penalties: { unit_size: 0, coupling: 0 },
		},
	});
	const markdown = renderHealthMarkdown(report);

	assert.match(markdown, /No area deducts points/);
	assert.doesNotMatch(markdown, /What moves it/);
});

test('uses the larger of p95 fan-in and 10 for the coupling list', () => {
	const report = describeHealth({
		...health,
		vital_signs: { ...health.vital_signs, p95_fan_in: 15, coupling_high_pct: 1 },
		file_scores: [
			{ path: 'a.ts', fan_in: 16, fan_out: 2, maintainability_index: 92, lines: 38 },
			{ path: 'b.ts', fan_in: 12, fan_out: 1, maintainability_index: 90, lines: 20 },
		],
	});

	assert.equal(report.fanInThreshold, 15);
	assert.deepEqual(
		report.highFanIn.map((file) => file.path),
		['a.ts']
	);
});

test('uses the documented hot-spot denominator and duplication floor', () => {
	const report = describeHealth({
		health_score: {
			formula_version: 3,
			score: 80,
			grade: 'B',
			penalties: { hotspots: 10, duplication: 10 },
		},
		summary: { functions_analyzed: 100 },
		vital_signs: {
			hotspot_count: 2,
			duplication_pct: 15,
			counts: { total_files: 250, files_scored: 200 },
		},
		file_scores: [],
	});
	const hotspot = report.deducted.find((penalty) => penalty.key === 'hotspots');
	const duplication = report.deducted.find((penalty) => penalty.key === 'duplication');

	assert.equal(hotspot.formula, '2 ÷ 3 × 10 = 10');
	assert.equal(duplication.formula, '15 − 5 = 10');
});

test('reads file scores from an array or a map', () => {
	const scores = [{ path: 'a.ts', fan_in: 3 }];

	assert.deepEqual(fileScores({ file_scores: scores }), scores);
	assert.deepEqual(fileScores({ file_scores: { 0: scores[0] } }), scores);
	assert.deepEqual(fileScores({}), []);
});

test('parses only functions over 60 lines and sorts them longest first', () => {
	const longFunctions = parseLongFunctions({
		findings: [
			{ path: 'a.ts', name: 'short', line: 1, line_count: 60, cyclomatic: 2, cognitive: 1 },
			{ path: 'b.ts', name: 'long', line: 5, line_count: 120, cyclomatic: 4, cognitive: 3 },
			{ path: 'c.ts', name: 'longer', line: 9, line_count: 180, cyclomatic: 6, cognitive: 5 },
		],
	});

	assert.deepEqual(
		longFunctions.map((fn) => fn.name),
		['longer', 'long']
	);
	assert.equal(longFunctions[0].lines, 180);
});

test('warns when the score formula version changes', () => {
	const report = describeHealth({
		...health,
		health_score: { ...health.health_score, formula_version: 4 },
	});
	const markdown = renderHealthMarkdown(report);

	assert.match(markdown, /Fallow reports formula v4/);
});

test('formats numbers without a trailing .0', () => {
	assert.equal(formatNumber(89.4), '89.4');
	assert.equal(formatNumber(10), '10');
	assert.equal(formatNumber(undefined), 'n/a');
});
