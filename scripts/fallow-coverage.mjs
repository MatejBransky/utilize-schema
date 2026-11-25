// Runs the unit tests of every workspace with V8 coverage, merges the
// Istanbul `coverage-final.json` files into one, and runs `fallow` in combined
// mode on it, so dead code, duplication, complexity and rule-pack policy are
// judged on the same tree and CRAP uses measured coverage instead of fallow's
// static estimate. Extra arguments are passed on to `fallow`.
//
// Each package's coverage counts only its own `src`, measured by its own
// tests. Generators import `@utilize/json-schema` through its `dist` (no
// source maps), so json-schema code that only generator tests run counts as
// uncovered. Run `pnpm build:dev` first: the generator tests need that `dist`.
//
// The merged file is not written to `coverage/coverage-final.json` on
// purpose: fallow picks that path up on its own, and then the commit hook and
// every other local run would stop using the static estimate.
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WORKSPACES = [
	'packages/json-schema',
	'packages/zod',
	'packages/effect',
	'packages/typescript',
	'playground',
];
const MERGED_COVERAGE = join(ROOT, 'coverage', 'merged', 'coverage-final.json');

function measureCoverage(workspace) {
	const directory = join(ROOT, workspace);
	execFileSync(
		'pnpm',
		[
			'exec',
			'vitest',
			'run',
			'--coverage.enabled',
			'--coverage.provider=v8',
			'--coverage.reporter=json',
			'--coverage.include=src/**',
		],
		{ cwd: directory, stdio: ['ignore', 'ignore', 'inherit'] }
	);
	return JSON.parse(readFileSync(join(directory, 'coverage', 'coverage-final.json'), 'utf8'));
}

function addHits(target, source) {
	for (const [id, hits] of Object.entries(source)) {
		target[id] = Array.isArray(hits)
			? hits.map((hit, index) => hit + target[id][index])
			: hits + target[id];
	}
}

/** Istanbul file entries are keyed by absolute path; a file measured twice gets its hits added. */
function mergeCoverage(coverageMaps) {
	const merged = {};
	for (const coverageMap of coverageMaps) {
		for (const [file, entry] of Object.entries(coverageMap)) {
			if (merged[file] === undefined) {
				merged[file] = structuredClone(entry);
				continue;
			}
			addHits(merged[file].s, entry.s);
			addHits(merged[file].f, entry.f);
			addHits(merged[file].b, entry.b);
		}
	}
	return merged;
}

function run() {
	const coverageMaps = WORKSPACES.map((workspace) => {
		console.error(`Measuring coverage: ${workspace}`);
		return measureCoverage(workspace);
	});

	mkdirSync(dirname(MERGED_COVERAGE), { recursive: true });
	writeFileSync(MERGED_COVERAGE, JSON.stringify(mergeCoverage(coverageMaps)));

	const fallow = spawnSync(
		'pnpm',
		['exec', 'fallow', '--coverage', MERGED_COVERAGE, ...process.argv.slice(2)],
		{ cwd: ROOT, stdio: 'inherit' }
	);
	process.exit(fallow.status ?? 1);
}

run();
