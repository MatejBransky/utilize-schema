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
//
// The audit diff-risk rules for a new dependency and a new suppression stay at
// `warn` in `.fallowrc.jsonc` because they describe a decision a reviewer
// verifies rather than a defect. A verdict whose warnings are only those rules
// passes; suppressing them in the config would itself be a weakened rule.
import { readFileSync } from 'node:fs';

const REVIEW_ONLY_RULES = new Set(['added-dependency', 'added-suppression']);

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

/**
 * Collects the rule of every introduced warn-tier finding in the saved result.
 * The sections differ (`severity` on diff-risk findings, `effective_severity`
 * elsewhere), so both are read.
 */
function introducedWarnings(value) {
	const rules = [];

	const visit = (node) => {
		if (Array.isArray(node)) {
			for (const item of node) {
				visit(item);
			}

			return;
		}

		if (node === null || typeof node !== 'object') {
			return;
		}

		const severity = node.effective_severity ?? node.severity;

		if (node.introduced === true && severity === 'warn' && typeof node.rule === 'string') {
			rules.push(node.rule);
		}

		for (const child of Object.values(node)) {
			visit(child);
		}
	};

	visit(value);

	return rules;
}

const outcomes = Object.entries(result.gate_outcomes ?? {});
const warnings = introducedWarnings(result);
const onlyReviewWarnings =
	warnings.length > 0 && warnings.every((rule) => REVIEW_ONLY_RULES.has(rule));
const failed = outcomes.filter(([gate, outcome]) => {
	if (outcome.status === 'fail') {
		return true;
	}

	if (!includeWarnings || outcome.status !== 'warn') {
		return false;
	}

	return !(gate === 'audit-verdict' && onlyReviewWarnings);
});

if (failed.length > 0) {
	for (const [gate, outcome] of failed) {
		const observed = outcome.observed === undefined ? '' : ` (observed ${outcome.observed})`;

		console.error(`Fallow gate ${outcome.status}: ${gate}${observed}`);
	}

	process.exit(1);
}

const passed = outcomes.map(([gate]) => gate).join(', ') || 'no gates';

console.log(`Fallow gates passed: ${passed}.`);
