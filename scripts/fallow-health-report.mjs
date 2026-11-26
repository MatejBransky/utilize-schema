// Explains a Fallow health score instead of only printing it.
//
// Fallow starts at 100 and subtracts one penalty per area (`unit_size`,
// `coupling`, ...). The human output shows the points, but the saved JSON also
// carries the measurement behind each one and the files that drive it. This
// module turns that data into the penalty breakdown, the long functions and the
// most-imported files, so the Pages report and the GitHub job summary can say
// why the score is what it is.
//
// The long-function list is not in the normal health JSON when fewer than 3% of
// the functions are over 60 lines (the `large_functions` field is omitted). We
// ask fallow for the same analysis with the complexity threshold at zero and
// keep only the functions over the score's fixed 60-line calibration. The flag
// is only for enumeration; the score still uses fallow's fixed calibration.
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

export const SCORE_FORMULA_VERSION = 3;

const PENALTY_LIMITS = {
	dead_files: 15,
	dead_exports: 15,
	complexity: 20,
	p90_complexity: 10,
	maintainability: 15,
	hotspots: 10,
	unused_deps: 25,
	circular_deps: 25,
	unit_size: 10,
	coupling: 5,
	duplication: 10,
	prop_drilling: 5,
};

function weightedFormula(rate, weight, points) {
	return `${formatNumber(rate)} × ${weight} = ${formatNumber(points)}`;
}

// Each formula mirrors the table at
// https://fallow.tools/docs/cli/health/#health-score-formula. `PENALTY_LIMITS`
// is the maximum deduction for that area.
const PENALTY_DEFINITIONS = {
	unit_size: {
		label: 'Function size',
		formula: ({ perKLongFunctions }, points) => weightedFormula(perKLongFunctions, '0.5', points),
		measure: ({ perKLongFunctions, longFunctionCount, functions, longFunctionPct }) => ({
			value: `${formatNumber(perKLongFunctions)} large functions per 1,000`,
			detail: `${longFunctionCount} of ${functions} functions (${formatNumber(longFunctionPct)}%) are longer than 60 lines.`,
		}),
		action:
			'Split each long function into helpers that do one thing, and leave a short coordinator that only calls them.',
	},
	coupling: {
		label: 'Coupling',
		formula: ({ couplingPct }, points) => weightedFormula(couplingPct, '0.5', points),
		measure: ({ couplingPct, highFanIn, fanInThreshold }) => ({
			value: `${formatNumber(couplingPct)}% of scored files above fan-in ${fanInThreshold}`,
			detail: `${highFanIn.length} file${highFanIn.length === 1 ? '' : 's'} listed below.`,
		}),
		action:
			'Put shared logic behind one module or a facade, so importers depend on a small interface instead of many files.',
	},
	dead_files: {
		label: 'Unused files',
		formula: ({ deadFilePct }, points) => weightedFormula(deadFilePct, '0.2', points),
		measure: ({ deadFilePct }) => ({
			value: `${formatNumber(deadFilePct)}% of files are unused`,
			detail: 'A file that nothing imports is weight the score still counts.',
		}),
		action: 'Delete the file, or make an entry point reach it.',
	},
	dead_exports: {
		label: 'Unused exports',
		formula: ({ deadExportPct }, points) => weightedFormula(deadExportPct, '0.2', points),
		measure: ({ deadExportPct }) => ({
			value: `${formatNumber(deadExportPct)}% of value exports are unused`,
			detail: 'An export that no file imports is dead surface.',
		}),
		action: 'Remove the export, or use it from the module that needs it.',
	},
	complexity: {
		label: 'Critical complexity',
		formula: ({ criticalComplexityPct }, points) =>
			weightedFormula(criticalComplexityPct, '4', points),
		measure: ({ criticalComplexityPct }) => ({
			value: `${formatNumber(criticalComplexityPct)}% of functions at cyclomatic 50+`,
			detail: 'Only critical functions move this penalty; the normal thresholds do not.',
		}),
		action: 'Split the critical function and add tests before changing it.',
	},
	p90_complexity: {
		label: 'P90 complexity',
		formula: ({ p90Cyclomatic }, points) =>
			`${formatNumber(p90Cyclomatic)} − 10 = ${formatNumber(points)}`,
		measure: ({ p90Cyclomatic }) => ({
			value: `P90 cyclomatic ${formatNumber(p90Cyclomatic)}`,
			detail:
				'This penalty replaces the critical-complexity penalty only when that count is absent.',
		}),
		action: 'Reduce the number of branches across the codebase.',
	},
	maintainability: {
		label: 'Low maintainability',
		formula: ({ maintainabilityLowPct }, points) =>
			weightedFormula(maintainabilityLowPct, '1.5', points),
		measure: ({ maintainabilityLowPct }) => ({
			value: `${formatNumber(maintainabilityLowPct)}% of files have an MI below 70`,
			detail:
				'Complexity density, unused exports and fan-out lower a file’s maintainability index.',
		}),
		action:
			'Lower complexity density, remove unused exports and reduce fan-out in the files below 70.',
	},
	hotspots: {
		label: 'Hotspots',
		formula: ({ hotspotCount, hotspotDenominator }, points) =>
			`${hotspotCount} ÷ ${hotspotDenominator} × 10 = ${formatNumber(points)}`,
		measure: ({ hotspotCount }) => ({
			value: `${hotspotCount} hotspot file${hotspotCount === 1 ? '' : 's'}`,
			detail: 'A hotspot is both complex and frequently changed.',
		}),
		action: 'Refactor the hottest complex files first, because a fix there helps most.',
	},
	unused_deps: {
		label: 'Unused dependencies',
		formula: ({ unusedDepsPerK }, points) => weightedFormula(unusedDepsPerK, '0.5', points),
		measure: ({ unusedDepCount, unusedDepsPerK }) => ({
			value: `${unusedDepCount} unused dependenc${unusedDepCount === 1 ? 'y' : 'ies'} (${formatNumber(unusedDepsPerK)} per 1,000 files)`,
			detail: 'The penalty scales with the size of the repository.',
		}),
		action: 'Remove the dependency, or use it from the package that declares it.',
	},
	circular_deps: {
		label: 'Circular dependencies',
		formula: ({ circularDepsPerK }, points) => weightedFormula(circularDepsPerK, '0.5', points),
		measure: ({ circularDepCount, circularDepsPerK }) => ({
			value: `${circularDepCount} cycle${circularDepCount === 1 ? '' : 's'} (${formatNumber(circularDepsPerK)} per 1,000 files)`,
			detail: 'The penalty scales with the size of the repository.',
		}),
		action: 'Break the cycle by moving the shared type or helper to a lower layer.',
	},
	duplication: {
		label: 'Duplication',
		formula: ({ duplicationPct }, points) =>
			`${formatNumber(duplicationPct)} − 5 = ${formatNumber(points)}`,
		measure: ({ duplicationPct }) => ({
			value: `${formatNumber(duplicationPct)}% duplicated lines`,
			detail: 'Only duplication above the 5% floor deducts points.',
		}),
		action: 'Extract the shared block into one module.',
	},
	prop_drilling: {
		label: 'Prop drilling',
		formula: ({ propDrillingCount }, points) =>
			`${propDrillingCount} × 1 = ${formatNumber(points)}`,
		measure: ({ propDrillingCount }) => ({
			value: `${propDrillingCount} prop-drilling chain${propDrillingCount === 1 ? '' : 's'}`,
			detail: 'The chain passes the same props through several components.',
		}),
		action: 'Pass the data through a context or a composed component instead.',
	},
};

export function healthSection(result) {
	if (!result) return undefined;
	return result.health_score ? result : result.health;
}

export function fileScores(health) {
	const scores = health?.file_scores;
	if (!scores) return [];
	return Array.isArray(scores) ? scores : Object.values(scores);
}

export function formatNumber(value, digits = 1) {
	const number = Number(value);
	if (!Number.isFinite(number)) return 'n/a';
	return number.toFixed(digits).replace(/\.0$/, '');
}

function round1(value) {
	return Math.round(value * 10) / 10;
}

function vitalMetrics(vital) {
	const {
		functions_over_60_loc_per_k: perKLongFunctions = 0,
		p95_fan_in: p95FanIn = 0,
		coupling_high_pct: couplingRate,
		dead_file_pct: deadFilePct = 0,
		dead_export_pct: deadExportPct = 0,
		critical_complexity_pct: criticalComplexityPct = 0,
		p90_cyclomatic: p90Cyclomatic = 0,
		maintainability_low_pct: maintainabilityLowPct = 0,
		hotspot_count: hotspotCount = 0,
		unused_dep_count: unusedDepCount = 0,
		unused_deps_per_k_files: unusedDepsPerK = 0,
		circular_dep_count: circularDepCount = 0,
		circular_deps_per_k_files: circularDepsPerK = 0,
		duplication_pct: duplicationPct = 0,
	} = vital;

	return {
		perKLongFunctions,
		p95FanIn,
		couplingRate,
		deadFilePct,
		deadExportPct,
		criticalComplexityPct,
		p90Cyclomatic,
		maintainabilityLowPct,
		hotspotCount,
		unusedDepCount,
		unusedDepsPerK,
		circularDepCount,
		circularDepsPerK,
		duplicationPct,
	};
}

function healthInputs(health) {
	const vital = health.vital_signs ?? {};
	const counts = vital.counts ?? {};
	const scores = fileScores(health);
	const functions = health.summary?.functions_analyzed ?? 0;
	const files = counts.files_scored ?? scores.length;
	const totalFiles = counts.total_files ?? files;
	const propDrillingCount = health.prop_drilling_chains?.length ?? 0;

	return { vital, counts, scores, functions, files, totalFiles, propDrillingCount };
}

function buildContext(health, longFunctions) {
	const { vital, counts, scores, functions, files, totalFiles, propDrillingCount } =
		healthInputs(health);
	const metrics = vitalMetrics(vital);
	const longFunctionCount =
		longFunctions.length || Math.round((metrics.perKLongFunctions * functions) / 1000);
	const longFunctionPct = functions > 0 ? (longFunctionCount / functions) * 100 : 0;
	const fanInThreshold = Math.max(Number(metrics.p95FanIn), 10);
	const highFanIn = scores
		.filter((file) => Number(file.fan_in) > fanInThreshold)
		.sort((a, b) => b.fan_in - a.fan_in || a.path.localeCompare(b.path));
	const couplingPct = Number.isFinite(metrics.couplingRate)
		? metrics.couplingRate
		: files > 0
			? (highFanIn.length / files) * 100
			: 0;
	const hotspotDenominator = Math.max(1, Math.ceil(totalFiles / 100));

	return {
		...metrics,
		health,
		vital,
		counts,
		functions,
		files,
		longFunctionCount,
		longFunctionPct,
		fanInThreshold,
		highFanIn,
		couplingPct,
		hotspotDenominator,
		propDrillingCount,
	};
}

function describePenalty([key, points], context) {
	const definition = PENALTY_DEFINITIONS[key];
	const value = Number(points ?? 0);

	return {
		key,
		label: definition?.label ?? key.replaceAll('_', ' '),
		points: value,
		limit: PENALTY_LIMITS[key] ?? null,
		formula: definition?.formula?.(context, value) ?? '',
		measurement: definition?.measure?.(context),
		action: definition?.action,
	};
}

export function describeHealth(result, { longFunctions = [] } = {}) {
	const health = healthSection(result);
	const score = health?.health_score;

	if (!score) return undefined;

	const context = buildContext(health, longFunctions);
	const penalties = Object.entries(score.penalties ?? {}).map((entry) =>
		describePenalty(entry, context)
	);
	const deducted = penalties
		.filter((penalty) => penalty.points > 0)
		.sort((a, b) => b.points - a.points);
	const formulaWarning =
		score.formula_version === SCORE_FORMULA_VERSION
			? undefined
			: `Fallow reports formula v${score.formula_version}; this report uses the v${SCORE_FORMULA_VERSION} caps.`;

	return {
		score: score.score,
		grade: score.grade,
		formulaVersion: score.formula_version,
		formulaWarning,
		totalDeduction: round1(deducted.reduce((total, penalty) => total + penalty.points, 0)),
		penalties,
		deducted,
		cleared: penalties.filter((penalty) => penalty.points === 0),
		longFunctions,
		highFanIn: context.highFanIn,
		fanInThreshold: context.fanInThreshold,
		counts: {
			functions: context.functions,
			files: context.files,
			longFunctionCount: context.longFunctionCount,
			longFunctionPct: round1(context.longFunctionPct),
			highFanInCount: context.highFanIn.length,
			couplingPct: round1(context.couplingPct),
		},
	};
}

export function parseLongFunctions(report) {
	return (report.findings ?? [])
		.filter((finding) => finding.line_count > 60)
		.map((finding) => ({
			path: finding.path,
			name: finding.name,
			line: finding.line,
			lines: finding.line_count,
			cyclomatic: finding.cyclomatic,
			cognitive: finding.cognitive,
		}))
		.sort((a, b) => b.lines - a.lines || a.path.localeCompare(b.path) || a.line - b.line);
}

/**
 * Enumerates the functions over the 60-line calibration that drives the
 * `unit_size` penalty. Fallow omits `large_functions` below 3% of all functions,
 * so a low threshold asks for every function and we keep the long ones.
 */
export function measureLongFunctions(root = process.cwd()) {
	const result = spawnSync(
		'pnpm',
		[
			'exec',
			'fallow',
			'health',
			'--format',
			'json',
			'--quiet',
			'--report-only',
			'--max-cyclomatic',
			'0',
			'--sort',
			'lines',
		],
		{ cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }
	);

	if (result.error) throw result.error;
	if (result.status !== 0) {
		throw new Error(
			`Fallow could not enumerate long functions: ${result.stderr.trim() || `exit ${result.status}`}`
		);
	}

	const payload = result.stdout.slice(result.stdout.indexOf('{'));
	return parseLongFunctions(JSON.parse(payload));
}

function escapeHtml(value) {
	return String(value).replace(/[&<>"']/g, (character) => {
		const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
		return entities[character];
	});
}

function markdownCell(value) {
	return String(value).replaceAll('|', '\\|').replaceAll('\n', ' ');
}

function codeCell(value) {
	return `<code>${escapeHtml(value)}</code>`;
}

function sourceUrl(repository, commit, path, line) {
	if (!repository || !commit) return undefined;
	return `${repository}/blob/${commit}/${path}${line ? `#L${line}` : ''}`;
}

function locationCell(path, line, repository, commit) {
	const label = `${path}${line ? `:${line}` : ''}`;
	const href = sourceUrl(repository, commit, path, line);

	return href ? `[${codeCell(label)}](${href})` : codeCell(label);
}

function markdownTable(headers, rows) {
	const header = `| ${headers.join(' | ')} |`;
	const divider = `| ${headers.map(() => '---').join(' | ')} |`;
	return [header, divider, ...rows.map((row) => `| ${row.map(markdownCell).join(' | ')} |`)].join(
		'\n'
	);
}

function penaltyPoints(penalty) {
	return penalty.limit === null
		? `−${formatNumber(penalty.points)}`
		: `−${formatNumber(penalty.points)} / ${formatNumber(penalty.limit)}`;
}

function deductionLines(report) {
	if (report.totalDeduction === 0) {
		return ['No area deducts points. Fallow starts at 100 and every penalty is zero.'];
	}

	const rows = report.deducted.map((penalty) => [
		penalty.label,
		penaltyPoints(penalty),
		penalty.formula,
		[penalty.measurement?.value, penalty.measurement?.detail].filter(Boolean).join(' — '),
		penalty.action ?? '',
	]);

	return [
		`Fallow starts at 100 and deducts **${formatNumber(report.totalDeduction)}** points.`,
		'',
		markdownTable(['Area', 'Deduction', 'Formula', 'Measurement', 'What moves it'], rows),
	];
}

function longFunctionLines(report, { repository, commit }) {
	if (report.longFunctions.length === 0) return [];

	const rows = report.longFunctions.map((fn) => [
		String(fn.lines),
		codeCell(fn.name),
		locationCell(fn.path, fn.line, repository, commit),
	]);

	return [
		'',
		`<details><summary>${report.longFunctions.length} functions longer than 60 lines</summary>`,
		'',
		markdownTable(['Lines', 'Function', 'Location'], rows),
		'',
		'</details>',
	];
}

function highFanInLines(report, { repository, commit }) {
	if (report.highFanIn.length === 0) return [];

	const rows = report.highFanIn.map((file) => [
		String(file.fan_in),
		String(file.fan_out),
		formatNumber(file.maintainability_index),
		locationCell(file.path, 0, repository, commit),
	]);

	return [
		'',
		`<details><summary>${report.highFanIn.length} files imported by more than ${report.fanInThreshold} files</summary>`,
		'',
		markdownTable(['Fan-in', 'Fan-out', 'Maintainability', 'File'], rows),
		'',
		'</details>',
	];
}

export function renderHealthMarkdown(report, { repository, commit } = {}) {
	if (!report) return '';

	const lines = [`### Fallow health: ${formatNumber(report.score)} (${report.grade})`, ''];

	if (report.formulaWarning) {
		lines.push(`> [!WARNING]`, `> ${report.formulaWarning}`, '');
	}

	lines.push(
		...deductionLines(report),
		...longFunctionLines(report, { repository, commit }),
		...highFanInLines(report, { repository, commit }),
		'',
		'File length does not deduct points: `health.maxFileLines` (900 here) reports a long-file finding, but the health score’s size penalty counts only functions longer than 60 lines.'
	);

	return `${lines.join('\n')}\n`;
}

function readJson(path) {
	return JSON.parse(readFileSync(path, 'utf8'));
}

function parseArguments(argv) {
	try {
		const { values } = parseArgs({
			args: argv,
			allowPositionals: false,
			options: {
				from: { type: 'string' },
				'long-functions': { type: 'string' },
				'write-long-functions': { type: 'string' },
				repository: { type: 'string' },
				commit: { type: 'string' },
				help: { type: 'boolean', short: 'h' },
			},
		});

		return {
			from: values.from,
			longFunctions: values['long-functions'],
			writeLongFunctions: values['write-long-functions'],
			repository: values.repository,
			commit: values.commit,
			help: values.help,
		};
	} catch (error) {
		throw new Error(error.message);
	}
}

function usage() {
	return [
		'Usage: node scripts/fallow-health-report.mjs --from <fallow-json> [options]',
		'       node scripts/fallow-health-report.mjs --write-long-functions <path>',
		'',
		'Options:',
		'  --long-functions <path>        Read the long-function list from a JSON file',
		'  --write-long-functions <path>  Measure and write the long-function list, then exit',
		'  --repository <url>             Repository URL for source links',
		'  --commit <sha>                 Commit for source links',
	].join('\n');
}

function readInputs(options) {
	let result;

	try {
		result = readJson(options.from);
	} catch (error) {
		throw new Error(`Could not read ${options.from}: ${error.message}`);
	}

	if (options.longFunctions) {
		try {
			return { result, longFunctions: readJson(options.longFunctions) };
		} catch (error) {
			// The summary still explains the score from the penalty data. The
			// page falls back to the derived count and says the list is missing.
			console.error(`Could not read ${options.longFunctions}: ${error.message}`);
			return { result, longFunctions: [] };
		}
	}

	try {
		return { result, longFunctions: measureLongFunctions() };
	} catch (error) {
		console.error(`Could not measure long functions: ${error.message}`);
		return { result, longFunctions: [] };
	}
}

function main() {
	let options;

	try {
		options = parseArguments(process.argv.slice(2));
	} catch (error) {
		console.error(`${error.message}\n\n${usage()}`);
		process.exit(2);
	}

	if (options.help) {
		console.log(usage());
		return;
	}

	if (options.writeLongFunctions) {
		let longFunctions = [];

		try {
			longFunctions = measureLongFunctions();
		} catch (error) {
			console.error(`Could not measure long functions: ${error.message}`);
		}

		writeFileSync(options.writeLongFunctions, `${JSON.stringify(longFunctions, null, 2)}\n`);
		console.log(
			`Wrote ${longFunctions.length} functions over 60 lines to ${options.writeLongFunctions}.`
		);
		return;
	}

	if (!options.from) {
		console.error(usage());
		process.exit(2);
	}

	let inputs;

	try {
		inputs = readInputs(options);
	} catch (error) {
		console.error(error.message);
		process.exit(2);
	}

	const report = describeHealth(inputs.result, {
		longFunctions: inputs.longFunctions,
	});

	if (!report) {
		console.error(`No health score in ${options.from}.`);
		process.exit(2);
	}

	process.stdout.write(
		renderHealthMarkdown(report, {
			repository: options.repository,
			commit: options.commit,
		})
	);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	main();
}
