// Renders one conformance badge per generator and JSON Schema dialect from the
// recorded suite baselines. Each baseline is asserted by that package's suite
// test, so a badge can only be stale when the baseline was updated without
// regenerating it. With `--check` it writes nothing and fails on that.
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

function badgePathFor(packageName, dialect) {
	return join(BADGE_DIRECTORY, `suite-${packageName}-${dialect}.svg`);
}

function readCommittedBadge(path) {
	return existsSync(path) ? readFileSync(path, 'utf8') : null;
}

async function run() {
	const staleBadges = [];
	mkdirSync(BADGE_DIRECTORY, { recursive: true });

	for (const packageName of PACKAGES) {
		const baseline = await loadBaseline(packageName);

		for (const [dialect, entry] of Object.entries(baseline)) {
			const percent = Math.floor((entry.passing / entry.cases) * 100);
			const message = `${percent}% passed`;
			const badge = renderBadge({
				label: dialect,
				message,
				color: pickColor(percent),
				description: `${dialect}: ${entry.passing}/${entry.cases} cases (${percent}%)`,
			});
			const path = badgePathFor(packageName, dialect);

			console.log(`${packageName} ${dialect}: ${entry.passing}/${entry.cases} (${percent}%)`);

			if (!IS_CHECK) {
				writeFileSync(path, badge);
			} else if (readCommittedBadge(path) !== badge) {
				staleBadges.push(`${packageName} ${dialect}`);
			}
		}
	}

	if (staleBadges.length > 0) {
		console.error(
			`Conformance badge is stale for: ${staleBadges.join(', ')}. Run "pnpm badge:suite" and commit the result.`
		);
		process.exit(1);
	}
}

await run();
