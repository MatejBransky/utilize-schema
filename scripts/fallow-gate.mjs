// Fails when a saved `fallow --format json` result records a failed gate.
//
// A machine format does not enforce its gates, so the process exits 0 even when
// `gate_outcomes` holds a `fail`. `fallow` documents that field as the thing a
// consumer should read, so the CI job saves the JSON result once, renders the
// summary from the same file, and gates here instead of running the analysis a
// second time in a format that enforces its exit code.
//
// `--warn` also fails on a gate whose status is `warn`. The GitHub Action treats
// an audit verdict of `warn` as a pass by design ("warn-tier findings only"),
// while this repository fails on those findings too, so the pull-request job
// reads its recorded result with the same flag.
import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const includeWarnings = args.includes('--warn');
const path = args.find((arg) => !arg.startsWith('--'));

if (!path) {
	console.error('Usage: node scripts/fallow-gate.mjs [--warn] <fallow-json-results>');
	process.exit(2);
}

let result;

try {
	result = JSON.parse(readFileSync(path, 'utf8'));
} catch (error) {
	console.error(`Could not read the fallow result at ${path}: ${error.message}`);
	process.exit(2);
}

const outcomes = Object.entries(result.gate_outcomes ?? {});
const failed = outcomes.filter(
	([, outcome]) => outcome.status === 'fail' || (includeWarnings && outcome.status === 'warn')
);

if (failed.length > 0) {
	for (const [gate, outcome] of failed) {
		const observed = outcome.observed === undefined ? '' : ` (observed ${outcome.observed})`;

		console.error(`Fallow gate ${outcome.status}: ${gate}${observed}`);
	}

	process.exit(1);
}

const passed = outcomes.map(([gate]) => gate).join(', ') || 'no gates';

console.log(`Fallow gates passed: ${passed}.`);
