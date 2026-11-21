// Measures unit test line coverage per package and writes one shields-style
// SVG badge per package to .github/badges/. With `--check` it writes nothing
// and fails when a committed badge no longer matches the measured value.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGES = ['json-schema', 'zod', 'effect', 'typescript'];
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BADGE_DIRECTORY = join(ROOT, '.github', 'badges');
const IS_CHECK = process.argv.includes('--check');

const COLOR_THRESHOLDS = [
	{ minimum: 95, color: '#4c1' },
	{ minimum: 90, color: '#97ca00' },
	{ minimum: 75, color: '#a4a61d' },
	{ minimum: 60, color: '#dfb317' },
	{ minimum: 40, color: '#fe7d37' },
	{ minimum: 0, color: '#e05d44' },
];

const LABEL = 'coverage';
const LABEL_WIDTH = 62;
const CHARACTER_WIDTH = 7;
const VALUE_PADDING = 10;

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

function pickColor(percent) {
	return COLOR_THRESHOLDS.find(({ minimum }) => percent >= minimum).color;
}

function renderBadge(percent) {
	const value = `${percent}%`;
	const valueWidth = value.length * CHARACTER_WIDTH + VALUE_PADDING;
	const width = LABEL_WIDTH + valueWidth;
	const labelCenter = LABEL_WIDTH / 2;
	const valueCenter = LABEL_WIDTH + valueWidth / 2;
	const description = `${LABEL}: ${value}`;

	return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="20" role="img" aria-label="${description}">
	<title>${description}</title>
	<linearGradient id="s" x2="0" y2="100%">
		<stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
		<stop offset="1" stop-opacity=".1"/>
	</linearGradient>
	<clipPath id="r"><rect width="${width}" height="20" rx="3" fill="#fff"/></clipPath>
	<g clip-path="url(#r)">
		<rect width="${LABEL_WIDTH}" height="20" fill="#555"/>
		<rect x="${LABEL_WIDTH}" width="${valueWidth}" height="20" fill="${pickColor(percent)}"/>
		<rect width="${width}" height="20" fill="url(#s)"/>
	</g>
	<g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
		<text x="${labelCenter}" y="15" fill="#010101" fill-opacity=".3">${LABEL}</text>
		<text x="${labelCenter}" y="14">${LABEL}</text>
		<text x="${valueCenter}" y="15" fill="#010101" fill-opacity=".3">${value}</text>
		<text x="${valueCenter}" y="14">${value}</text>
	</g>
</svg>
`;
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
		const badge = renderBadge(percent);
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
