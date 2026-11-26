// Renders one conformance badge per generator and JSON Schema dialect from the
// recorded suite baselines. Each baseline is asserted by that package's suite
// test, so a badge can only be stale when the baseline was updated without
// regenerating it. With `--check` it writes nothing and fails on that.
// Requires Node 24+ for built-in TypeScript type stripping of baseline.ts.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { pickColor, renderBadge } from './badge.mjs';

const PACKAGES = ['zod', 'effect', 'typescript'];
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BADGE_DIRECTORY = join(ROOT, '.github', 'badges');
const IS_CHECK = process.argv.includes('--check');

async function loadBaseline(packageName) {
	const module = await import(
		pathToFileURL(join(ROOT, 'packages', packageName, 'test', 'suite', 'baseline.ts')).href
	);

	return module.baseline;
}

export function badgePathFor(packageName, dialect) {
	return join(BADGE_DIRECTORY, `suite-${packageName}-${dialect}.svg`);
}

export function readCommittedBadge(path) {
	return existsSync(path) ? readFileSync(path, 'utf8') : null;
}

export function isBadgeStale(path, badge) {
	return readCommittedBadge(path) !== badge;
}

export function describeBadge(dialect, entry) {
	const percent = Math.floor((entry.passing / entry.cases) * 100);

	return {
		percent,
		badge: renderBadge({
			label: dialect,
			message: `${percent}% passed`,
			color: pickColor(percent),
			description: `${dialect}: ${entry.passing}/${entry.cases} cases (${percent}%)`,
		}),
	};
}

function recordBadge(packageName, dialect, entry, staleBadges) {
	const { percent, badge } = describeBadge(dialect, entry);
	const path = badgePathFor(packageName, dialect);

	console.log(`${packageName} ${dialect}: ${entry.passing}/${entry.cases} (${percent}%)`);

	if (!IS_CHECK) {
		writeFileSync(path, badge);
		return;
	}

	if (isBadgeStale(path, badge)) {
		staleBadges.push(`${packageName} ${dialect}`);
	}
}

async function run() {
	const staleBadges = [];
	mkdirSync(BADGE_DIRECTORY, { recursive: true });

	for (const packageName of PACKAGES) {
		const baseline = await loadBaseline(packageName);

		for (const [dialect, entry] of Object.entries(baseline)) {
			recordBadge(packageName, dialect, entry, staleBadges);
		}
	}

	if (staleBadges.length > 0) {
		console.error(
			`Conformance badge is stale for: ${staleBadges.join(', ')}. Run "pnpm badge:suite" and commit the result.`
		);
		process.exit(1);
	}
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
	await run();
}
