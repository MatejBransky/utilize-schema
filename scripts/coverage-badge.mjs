// Measures unit test line coverage per package and writes one shields-style
// SVG badge per package to .github/badges/. With `--check` it writes nothing
// and fails when a committed badge no longer matches the measured value.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { pickColor, renderBadge } from './badge.mjs';

const PACKAGES = ['json-schema', 'zod', 'effect', 'typescript'];
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BADGE_DIRECTORY = join(ROOT, '.github', 'badges');
const IS_CHECK = process.argv.includes('--check');

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
			'--coverage.include=src/**',
		],
		{ cwd: packageDirectory, stdio: ['ignore', 'ignore', 'inherit'] }
	);
	const lcov = readFileSync(join(packageDirectory, 'coverage', 'lcov.info'), 'utf8');
	return calculatePercent(lcov);
}

function calculatePercent(lcov) {
	const found = sumLcovField(lcov, 'LF');
	const hit = sumLcovField(lcov, 'LH');
	return Math.floor((hit / found) * 100);
}

function sumLcovField(lcov, field) {
	const pattern = new RegExp(`^${field}:(\\d+)$`, 'gm');
	return [...lcov.matchAll(pattern)].reduce((sum, match) => sum + Number(match[1]), 0);
}

function badgePathFor(packageName) {
	return join(BADGE_DIRECTORY, `coverage-${packageName}.svg`);
}

function readCommittedBadge(path) {
	return existsSync(path) ? readFileSync(path, 'utf8') : null;
}

function run() {
	const staleBadges = [];
	mkdirSync(BADGE_DIRECTORY, { recursive: true });

	for (const packageName of PACKAGES) {
		const percent = measureLineCoveragePercent(packageName);
		const badge = renderBadge({
			label: LABEL,
			message: `${percent}%`,
			color: pickColor(percent),
		});
		const path = badgePathFor(packageName);
		console.log(`${packageName}: ${percent}%`);

		if (!IS_CHECK) {
			writeFileSync(path, badge);
		} else if (readCommittedBadge(path) !== badge) {
			staleBadges.push(packageName);
		}
	}

	if (staleBadges.length > 0) {
		console.error(
			`Coverage badge is stale for: ${staleBadges.join(', ')}. Run "pnpm badge:coverage" and commit the result.`
		);
		process.exit(1);
	}
}

run();
