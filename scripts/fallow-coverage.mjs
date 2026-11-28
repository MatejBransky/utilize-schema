// Merges the Istanbul `coverage-final.json` files of every workspace into one
// and runs `fallow` in combined mode on it, so dead code, duplication,
// complexity and rule-pack policy are judged on the same tree and CRAP uses
// measured coverage instead of fallow's static estimate. Extra arguments are
// passed on to `fallow`.
//
// By default it runs the unit tests of every workspace with V8 coverage first.
// With `--reuse-coverage` it skips those runs and merges the coverage that
// `pnpm ci:test:coverage` already wrote, so CI never executes the test suite
// twice. Each package's coverage counts only its own `src`, measured by its own
// tests. Generators import `@utilize/json-schema` through its `dist` (no
// source maps), so json-schema code that only generator tests run counts as
// uncovered. Run `pnpm build:dev` first: the generator tests need that `dist`.
//
// The merged file is not written to `coverage/coverage-final.json` on
// purpose: fallow picks that path up on its own, and then the commit hook and
// every other local run would stop using the static estimate.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = resolve(import.meta.dirname, '..');
const WORKSPACES = [
	'packages/json-schema',
	'packages/zod',
	'packages/effect',
	'packages/typescript',
	'playground',
];
const MERGED_COVERAGE = join(ROOT, 'coverage', 'merged', 'coverage-final.json');

export function splitFallowArguments(argv) {
	return argv.filter((argument) => argument !== '--reuse-coverage');
}

export function readCoverage(workspace, root = ROOT) {
	const coveragePath = join(root, workspace, 'coverage', 'coverage-final.json');

	if (!existsSync(coveragePath)) {
		throw new Error(
			`Missing ${coveragePath}. Run "pnpm ci:test:coverage" before reusing coverage.`
		);
	}

	return JSON.parse(readFileSync(coveragePath, 'utf8'));
}

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
	const reuseCoverage = process.argv.includes('--reuse-coverage');
	const coverageMaps = WORKSPACES.map((workspace) => {
		if (reuseCoverage) {
			console.error(`Reusing coverage: ${workspace}`);
			return readCoverage(workspace);
		}

		console.error(`Measuring coverage: ${workspace}`);
		return measureCoverage(workspace);
	});

	mkdirSync(dirname(MERGED_COVERAGE), { recursive: true });
	writeFileSync(MERGED_COVERAGE, JSON.stringify(mergeCoverage(coverageMaps)));

	const fallow = spawnSync(
		'pnpm',
		[
			'exec',
			'fallow',
			'--coverage',
			MERGED_COVERAGE,
			...splitFallowArguments(process.argv.slice(2)),
		],
		{ cwd: ROOT, stdio: 'inherit' }
	);
	process.exit(fallow.status ?? 1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	run();
}
