// Fails when a saved `fallow --format json` result records a failed gate.
//
// A machine format does not enforce its gates, so the process exits 0 even when
// `gate_outcomes` holds a `fail`. `fallow` documents that field as the thing a
// consumer should read, so the CI job saves the JSON result once, renders the
// summary from the same file, and gates here instead of running the analysis a
// second time in a format that enforces its exit code.
import { readFileSync } from 'node:fs';

const path = process.argv[2];

if (!path) {
	console.error('Usage: node scripts/fallow-gate.mjs <fallow-json-results>');
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
const failed = outcomes.filter(([, outcome]) => outcome.status === 'fail');

if (failed.length > 0) {
	for (const [gate, outcome] of failed) {
		const observed = outcome.observed === undefined ? '' : ` (observed ${outcome.observed})`;

		console.error(`Fallow gate failed: ${gate}${observed}`);
	}

	process.exit(1);
}

const passed = outcomes.map(([gate]) => gate).join(', ') || 'no gates';

console.log(`Fallow gates passed: ${passed}.`);
