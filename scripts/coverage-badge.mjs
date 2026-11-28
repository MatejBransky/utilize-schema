// Reads the unit test line coverage per package from the `lcov.info` that the
// coverage-enabled test run wrote, and renders one shields-style SVG badge per
// package to .github/badges/. With `--measure` it runs those package tests
// first, for local badge updates. With `--check` it writes nothing and fails
// when a committed badge no longer matches the measured value.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { pickColor, renderBadge } from './badge.mjs';

const PACKAGES = ['json-schema', 'zod', 'effect', 'typescript'];
const ROOT = resolve(import.meta.dirname, '..');
const BADGE_DIRECTORY = join(ROOT, '.github', 'badges');
const IS_CHECK = process.argv.includes('--check');
const IS_MEASURE = process.argv.includes('--measure');

const LABEL = 'coverage';

function measureLineCoveragePercent(packageName) {
	const packageDirectory = join(ROOT, 'packages', packageName);
	execFileSync(
		'pnpm',
		[
			'exec',
			'vitest',
			'run',
			'--coverage.enabled',
			'--coverage.provider=v8',
			'--coverage.reporter=lcov',
			'--coverage.reporter=json',
			'--coverage.include=src/**',
		],
		{ cwd: packageDirectory, stdio: ['ignore', 'ignore', 'inherit'] }
	);

	return readLineCoveragePercent(packageName);
}

export function readLineCoveragePercent(packageName, root = ROOT) {
	const lcovPath = join(root, 'packages', packageName, 'coverage', 'lcov.info');

	if (!existsSync(lcovPath)) {
		throw new Error(
			`Missing ${lcovPath}. Run "pnpm ci:test:coverage" before reading the coverage badges.`
		);
	}

	return calculatePercent(readFileSync(lcovPath, 'utf8'));
}

export function calculatePercent(lcov) {
	const found = sumLcovField(lcov, 'LF');
	const hit = sumLcovField(lcov, 'LH');
	return Math.floor((hit / found) * 100);
}

function sumLcovField(lcov, field) {
	const pattern = new RegExp(`^${field}:(\\d+)$`, 'gm');
	return [...lcov.matchAll(pattern)].reduce((sum, match) => sum + Number(match[1]), 0);
}

function renderCoverageBadge(percent) {
	const value = `${percent}%`;

	return renderBadge({ label: LABEL, message: value, color: pickColor(percent) });
}

function badgePathFor(packageName) {
	return join(BADGE_DIRECTORY, `coverage-${packageName}.svg`);
}

function readCommittedBadge(path) {
	return existsSync(path) ? readFileSync(path, 'utf8') : null;
}

function badgeUpdate(packageName, percent) {
	return {
		packageName,
		percent,
		badge: renderCoverageBadge(percent),
		path: badgePathFor(packageName),
	};
}

function recordBadge({ packageName, percent, badge, path }, staleBadges) {
	console.log(`${packageName}: ${percent}%`);

	if (!IS_CHECK) {
		writeFileSync(path, badge);
	} else if (readCommittedBadge(path) !== badge) {
		staleBadges.push(packageName);
	}
}

function reportStaleBadges(staleBadges) {
	if (staleBadges.length === 0) {
		return;
	}

	console.error(
		`Coverage badge is stale for: ${staleBadges.join(', ')}. Run "pnpm badge:coverage" and commit the result.`
	);
	process.exit(1);
}

function run() {
	const staleBadges = [];
	mkdirSync(BADGE_DIRECTORY, { recursive: true });

	for (const packageName of PACKAGES) {
		const percent = IS_MEASURE
			? measureLineCoveragePercent(packageName)
			: readLineCoveragePercent(packageName);
		recordBadge(badgeUpdate(packageName, percent), staleBadges);
	}

	reportStaleBadges(staleBadges);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	run();
}
