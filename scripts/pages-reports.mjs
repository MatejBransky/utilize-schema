import { execFileSync, spawnSync } from 'node:child_process';
import {
	cpSync,
	existsSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	rmSync,
	writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { describeHealth, formatNumber, measureLongFunctions } from './fallow-health-report.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ARTIFACTS = join(ROOT, '.fallow', 'reports');
const REPORTS = join(ROOT, 'playground', 'dist', 'reports');
const REPOSITORY = 'https://github.com/MatejBransky/utilize-schema';
const TEST_WORKSPACES = [
	{ id: 'json-schema', name: '@utilize/json-schema', package: '@utilize/json-schema' },
	{ id: 'zod', name: '@utilize/zod', package: '@utilize/zod' },
	{ id: 'effect', name: '@utilize/effect', package: '@utilize/effect' },
	{ id: 'typescript', name: '@utilize/typescript', package: '@utilize/typescript' },
	{ id: 'test-utils', name: '@utilize/test-utils', package: '@utilize/test-utils' },
	{ id: 'playground', name: 'playground', package: 'playground' },
];

const REPORT_CSS = `
:root {
  color-scheme: light dark;
  --bg: #f5f5f2;
  --surface: #fff;
  --surface-muted: #ecece7;
  --text: #1d1d1b;
  --muted: #66665f;
  --border: #d7d7d0;
  --accent: #3157d5;
  --accent-soft: #e7edff;
  --pass: #056b4c;
  --pass-soft: #dcf7ec;
  --fail: #c92a2a;
  --fail-soft: #ffe3e3;
  --skip: #8a6200;
  --skip-soft: #fff1c7;
  --radius: 14px;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #111210;
    --surface: #191a17;
    --surface-muted: #22231f;
    --text: #f0f0e9;
    --muted: #a5a69c;
    --border: #34362f;
    --accent: #8da7ff;
    --accent-soft: #202b4d;
    --pass: #63d6ae;
    --pass-soft: #163a2e;
    --fail: #ff8787;
    --fail-soft: #472222;
    --skip: #f2c85b;
    --skip-soft: #403713;
  }
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text); line-height: 1.55; }
a { color: var(--accent); text-underline-offset: 3px; }
a:hover { text-decoration-thickness: 2px; }
a:focus-visible, button:focus-visible { outline: 3px solid var(--accent); outline-offset: 3px; }
.shell { width: min(1120px, calc(100% - 40px)); margin: 0 auto; padding: 40px 0 64px; }
.topbar { display: flex; align-items: center; justify-content: space-between; gap: 20px; margin-bottom: 40px; }
.brand { font-weight: 750; letter-spacing: -0.03em; text-decoration: none; color: var(--text); }
.nav { display: flex; flex-wrap: wrap; gap: 8px; }
.nav a { padding: 7px 12px; border: 1px solid var(--border); border-radius: 999px; text-decoration: none; }
.nav a[aria-current="page"] { background: var(--accent-soft); border-color: var(--accent); color: var(--accent); }
.hero { margin-bottom: 28px; }
.eyebrow { color: var(--accent); font-size: 0.78rem; font-weight: 750; letter-spacing: 0.12em; text-transform: uppercase; }
h1 { margin: 6px 0 10px; font-size: clamp(2rem, 5vw, 3.4rem); line-height: 1.05; letter-spacing: -0.05em; }
h2 { margin: 0 0 8px; font-size: 1.3rem; letter-spacing: -0.02em; }
h3 { margin: 0 0 6px; font-size: 1rem; }
p { margin: 0; color: var(--muted); }
.lede { max-width: 720px; font-size: 1.08rem; }
.meta { display: flex; flex-wrap: wrap; gap: 8px 18px; margin-top: 16px; color: var(--muted); font-size: 0.88rem; }
.metrics { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; margin: 28px 0; }
.metric, .card, .workspace { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); }
.metric { padding: 18px 20px; }
.metric span { display: block; color: var(--muted); font-size: 0.82rem; }
.metric strong { display: block; margin-top: 4px; font-size: 1.8rem; letter-spacing: -0.04em; }
.metric small { color: var(--muted); font-size: 0.9rem; font-weight: 600; }
a.metric { text-decoration: none; color: inherit; }
a.metric:hover { border-color: var(--accent); }
.metric-detail { display: block; margin-top: 6px; color: var(--muted); font-size: 0.82rem; }
.metric-hint { display: block; margin-top: 6px; color: var(--accent); font-size: 0.82rem; font-weight: 700; }
.deduction { color: var(--fail); font-weight: 700; }
.cleared { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.left { text-align: left; }
.cards { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
.card { display: flex; flex-direction: column; gap: 14px; padding: 22px; text-decoration: none; color: var(--text); }
.card:hover { border-color: var(--accent); }
.card p { flex: 1; }
.card-link { font-weight: 700; }
.badge { display: inline-flex; align-items: center; width: fit-content; padding: 3px 9px; border-radius: 999px; font-size: 0.76rem; font-weight: 750; }
.badge.pass { color: var(--pass); background: var(--pass-soft); }
.badge.fail { color: var(--fail); background: var(--fail-soft); }
.badge.skip { color: var(--skip); background: var(--skip-soft); }
.section { margin-top: 40px; }
.section-head { display: flex; align-items: end; justify-content: space-between; gap: 16px; margin-bottom: 16px; }
.workspace-list { display: grid; gap: 12px; }
.workspace { display: grid; grid-template-columns: minmax(180px, 1fr) auto; gap: 16px; align-items: center; padding: 18px 20px; }
.workspace p { margin-top: 3px; font-size: 0.9rem; }
.actions { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
.table-wrap { overflow-x: auto; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); }
table { width: 100%; border-collapse: collapse; min-width: 680px; }
th, td { padding: 14px 18px; border-bottom: 1px solid var(--border); text-align: right; }
th:first-child, td:first-child { text-align: left; }
th { color: var(--muted); font-size: 0.78rem; letter-spacing: 0.06em; text-transform: uppercase; }
tr:last-child td { border-bottom: 0; }
.fixture { min-width: 280px; }
.bar { height: 5px; margin-top: 7px; background: var(--surface-muted); border-radius: 999px; overflow: hidden; }
.bar span { display: block; height: 100%; background: var(--accent); border-radius: inherit; }
.note { margin-top: 14px; font-size: 0.88rem; }
pre { overflow: auto; margin: 0; padding: 20px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); font-size: 0.82rem; line-height: 1.5; }
code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
@media (max-width: 820px) {
  .metrics, .cards { grid-template-columns: 1fr; }
  .workspace { grid-template-columns: 1fr; }
  .topbar, .section-head { align-items: flex-start; flex-direction: column; }
}
@media (max-width: 520px) {
  .shell { width: min(100% - 24px, 1120px); padding-top: 24px; }
  .nav a { padding: 6px 9px; }
}
`;

export function escapeHtml(value) {
	return String(value).replace(/[&<>"']/g, (character) => {
		const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
		return entities[character];
	});
}

export function formatMilliseconds(value) {
	return `${Number(value).toFixed(1)} ms`;
}

export function stripFaviconLinks(html) {
	return html.replace(/^[ \t]*<link rel="icon"[^\n]*>\r?\n/gm, '');
}

export function summarizeVitest(workspace, report) {
	const startTimes = report.testResults.map((result) => result.startTime);
	const endTimes = report.testResults.map((result) => result.endTime);

	return {
		id: workspace.id,
		name: workspace.name,
		success: report.success,
		suites: report.numTotalTestSuites,
		passedSuites: report.numPassedTestSuites,
		failedSuites: report.numFailedTestSuites,
		tests: report.numTotalTests,
		passed: report.numPassedTests,
		failed: report.numFailedTests,
		pending: report.numPendingTests,
		todo: report.numTodoTests,
		duration: endTimes.length ? Math.max(...endTimes) - Math.min(...startTimes) : 0,
	};
}

function statusBadge(success) {
	return `<span class="badge ${success ? 'pass' : 'fail'}">${success ? 'Passed' : 'Failed'}</span>`;
}

function page(title, description, rootHref, active, body) {
	return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light dark">
  <title>${escapeHtml(title)} · Utilize Schema Reports</title>
  <link rel="stylesheet" href="${rootHref}report.css">
</head>
<body>
  <main class="shell">
    <header class="topbar">
      <a class="brand" href="${rootHref}">◈ Utilize Schema</a>
      <nav class="nav" aria-label="Reports">
        <a href="${rootHref}fallow/" ${active === 'fallow' ? 'aria-current="page"' : ''}>Fallow</a>
        <a href="${rootHref}fallow/health/" ${active === 'health' ? 'aria-current="page"' : ''}>Health</a>
        <a href="${rootHref}tests/" ${active === 'tests' ? 'aria-current="page"' : ''}>Tests</a>
        <a href="${rootHref}benchmarks/" ${active === 'benchmarks' ? 'aria-current="page"' : ''}>Benchmarks</a>
      </nav>
    </header>
    <section class="hero">
      <div class="eyebrow">Repository reports</div>
      <h1>${escapeHtml(title)}</h1>
      <p class="lede">${escapeHtml(description)}</p>
      ${body.meta}
    </section>
    ${body.content}
  </main>
</body>
</html>
`;
}

function reportMeta(commit, generatedAt) {
	const shortCommit = commit.slice(0, 7);
	return `<div class="meta">
  <span>Generated ${escapeHtml(new Date(generatedAt).toISOString().replace('T', ' ').slice(0, 16))} UTC</span>
  <a href="${REPOSITORY}/commit/${encodeURIComponent(commit)}"><code>${escapeHtml(shortCommit)}</code></a>
</div>`;
}

function sumTestCounts(tests) {
	return {
		totalTests: tests.reduce((total, workspace) => total + workspace.tests, 0),
		passedTests: tests.reduce((total, workspace) => total + workspace.passed, 0),
		failedTests: tests.reduce((total, workspace) => total + workspace.failed, 0),
	};
}

function metricDetail(report) {
	if (!report) return '';

	if (report.deducted.length === 0) {
		return '<span class="metric-detail">No area deducts points.</span>';
	}

	const deductions = report.deducted
		.map((penalty) => `${penalty.label} −${formatNumber(penalty.points)}`)
		.join(' · ');

	return `<span class="metric-detail">${escapeHtml(deductions)}</span><span class="metric-hint">Why this score →</span>`;
}

function hubMetrics(health, counts, benchmark) {
	const report = describeHealth(health);
	const healthScore = report
		? `${formatNumber(report.score)} <small>${escapeHtml(report.grade)}</small>`
		: 'Unavailable';
	const healthMetric = report
		? `<a class="metric" href="./fallow/health/">
        <span>Fallow health</span>
        <strong>${healthScore}</strong>
        ${metricDetail(report)}
      </a>`
		: `<div class="metric">
        <span>Fallow health</span>
        <strong>${healthScore}</strong>
      </div>`;

	return `
    <div class="metrics">
      ${healthMetric}
      <div class="metric">
        <span>Tests passed</span>
        <strong>${counts.passedTests.toLocaleString()} <small>of ${counts.totalTests.toLocaleString()}</small></strong>
      </div>
      <div class="metric">
        <span>Benchmark fixtures</span>
        <strong>${benchmark?.results?.length ?? 0} <small>latest run</small></strong>
      </div>
    </div>`;
}

function fallowCard(health) {
	const available = Boolean(health?.health_score);
	return `
      <a class="card" href="./fallow/">
        <span class="badge ${available ? 'pass' : 'skip'}">Code analysis</span>
        <h2>Fallow map</h2>
        <p>Interactive map of files, imports, complexity and health. Includes the raw health report.</p>
        <span class="card-link">Explore the codebase →</span>
      </a>`;
}

function testsCard(failedTests) {
	const passed = failedTests === 0;
	return `
      <a class="card" href="./tests/">
        <span class="badge ${passed ? 'pass' : 'fail'}">${passed ? 'All green' : `${failedTests} failed`}</span>
        <h2>Test reports</h2>
        <p>One static Vitest report per workspace, plus the Node script test output.</p>
        <span class="card-link">Review test results →</span>
      </a>`;
}

function benchmarksCard(benchmark) {
	const summary = benchmark?.results
		?.slice(0, 2)
		.map((result) => `${escapeHtml(result.label)}: ${formatMilliseconds(result.median)} median`)
		.join('<br>');
	return `
      <a class="card" href="./benchmarks/">
        <span class="badge ${benchmark ? 'pass' : 'skip'}">${benchmark ? 'Measured' : 'Unavailable'}</span>
        <h2>Benchmarks</h2>
        <p>${summary || 'No benchmark result was produced.'}</p>
        <span class="card-link">Compare timings →</span>
      </a>`;
}

function renderHub({ commit, generatedAt, health, tests, benchmark, scripts }) {
	const counts = sumTestCounts(tests);
	const content = `
    ${hubMetrics(health, counts, benchmark)}
    <div class="cards">${fallowCard(health)}${testsCard(counts.failedTests)}${benchmarksCard(benchmark)}</div>
    <p class="note">Script tests: ${scripts.status === 0 ? statusBadge(true) : statusBadge(false)}. Reports are rebuilt from <code>main</code> by the Check workflow. Raw data: <a href="./fallow/health.json">Fallow health</a> · <a href="./benchmarks/results.json">benchmarks</a>.</p>
  `;

	writeFileSync(
		join(REPORTS, 'index.html'),
		page(
			'Reports',
			'A live, static snapshot of code health, test results and benchmark timings for the current main branch.',
			'./',
			'',
			{ meta: reportMeta(commit, generatedAt), content }
		)
	);
}

function renderTestsIndex({ commit, generatedAt, tests, scripts }) {
	const { totalTests, passedTests, failedTests } = sumTestCounts(tests);
	const workspaces = tests
		.map(
			(workspace) => `<article class="workspace">
      <div>
        <h3>${escapeHtml(workspace.name)}</h3>
        <p>${workspace.passed.toLocaleString()} / ${workspace.tests.toLocaleString()} tests passed · ${workspace.suites.toLocaleString()} suites · ${formatMilliseconds(workspace.duration)}</p>
      </div>
      <div class="actions">
        ${statusBadge(workspace.success)}
        <a href="./${workspace.id}/index.html">HTML report</a>
        <a href="./${workspace.id}/results.json">JSON</a>
      </div>
    </article>`
		)
		.join('\n');

	const content = `
    <div class="metrics">
      <div class="metric"><span>Total tests</span><strong>${totalTests.toLocaleString()}</strong></div>
      <div class="metric"><span>Passed</span><strong>${passedTests.toLocaleString()}</strong></div>
      <div class="metric"><span>Failed</span><strong>${failedTests.toLocaleString()}</strong></div>
    </div>
    <div class="workspace-list">${workspaces}</div>
    <section class="section">
      <div class="section-head"><div><h2>Node script tests</h2><p>Repository tooling tests outside Vitest.</p></div>${statusBadge(scripts.status === 0)}</div>
      <a href="./scripts/index.html">Open script test output →</a>
    </section>
  `;

	writeFileSync(
		join(REPORTS, 'tests', 'index.html'),
		page(
			'Test reports',
			'Static Vitest HTML reports for every workspace. Open a report to inspect individual files, cases and failures.',
			'../',
			'tests',
			{ meta: reportMeta(commit, generatedAt), content }
		)
	);
}

function renderBenchmarksIndex({ commit, generatedAt, benchmark }) {
	const results = benchmark?.results ?? [];
	const slowest = Math.max(...results.map((result) => result.median), 1);
	const rows = results
		.map(
			(result) => `<tr>
      <td class="fixture">${escapeHtml(result.label)}<div class="bar" aria-hidden="true"><span style="width: ${(result.median / slowest) * 100}%"></span></div></td>
      <td>${formatMilliseconds(result.median)}</td>
      <td>${formatMilliseconds(result.p95)}</td>
      <td>${formatMilliseconds(result.min)}</td>
      <td>${formatMilliseconds(result.max)}</td>
    </tr>`
		)
		.join('\n');
	const content = `
    ${
			rows
				? `<div class="table-wrap"><table>
      <thead><tr><th>Fixture</th><th>Median</th><th>p95</th><th>Min</th><th>Max</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`
				: '<p>No benchmark result was produced.</p>'
		}
    <p class="note">${benchmark ? `${benchmark.iterations} measured iterations after warm-up. ` : ''}Timings depend on the runner and machine load; compare trends rather than treating one run as an absolute score. <a href="./results.json">Raw JSON</a></p>
  `;

	writeFileSync(
		join(REPORTS, 'benchmarks', 'index.html'),
		page(
			'Benchmarks',
			'Large-schema parsing timings for Azure-like and FHIR-like fixtures, measured by the repository benchmark harness.',
			'../',
			'benchmarks',
			{ meta: reportMeta(commit, generatedAt), content }
		)
	);
}

function fallowSourceHref(commit, path, line) {
	return `${REPOSITORY}/blob/${commit}/${path}${line ? `#L${line}` : ''}`;
}

function scoreCards(report) {
	return `<div class="metrics">
    <div class="metric"><span>Health score</span><strong>${formatNumber(report.score)} <small>${escapeHtml(report.grade)}</small></strong></div>
    <div class="metric"><span>Points deducted</span><strong>${formatNumber(report.totalDeduction)} <small>of 100</small></strong></div>
    <div class="metric"><span>Formula</span><strong>v${report.formulaVersion} <small>fixed calibration</small></strong></div>
  </div>`;
}

function deductionTable(report) {
	if (report.deducted.length === 0) {
		return '<p>No area deducts points.</p>';
	}

	const rows = report.deducted
		.map(
			(penalty) => `<tr>
      <td>${escapeHtml(penalty.label)}</td>
      <td class="deduction">−${formatNumber(penalty.points)}${penalty.limit === null ? '' : ` / ${formatNumber(penalty.limit)}`}</td>
      <td class="left">${escapeHtml(penalty.measurement?.value ?? '')} — ${escapeHtml(penalty.measurement?.detail ?? '')}</td>
      <td class="left">${escapeHtml(penalty.action ?? '')}</td>
    </tr>`
		)
		.join('\n');

	return `<div class="table-wrap"><table>
      <thead><tr><th>Area</th><th>Deduction</th><th class="left">Measurement</th><th class="left">What moves it</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;
}

function clearedBadges(report) {
	if (report.cleared.length === 0) return '';

	const badges = report.cleared
		.map((penalty) => `<span class="badge pass">${escapeHtml(penalty.label)} 0</span>`)
		.join('');

	return `<div class="cleared">${badges}</div>`;
}

function longFunctionTable(longFunctions, commit, expectedCount) {
	if (longFunctions.length === 0) {
		return expectedCount > 0
			? `<p>The per-function list was not available in this build. Fallow still counts ${expectedCount} functions over 60 lines.</p>`
			: '<p>No function is longer than 60 lines.</p>';
	}

	const rows = longFunctions
		.map((fn) => {
			const href = fallowSourceHref(commit, fn.path, fn.line);

			return `<tr>
      <td class="left"><a href="${href}"><code>${escapeHtml(fn.name)}</code></a></td>
      <td class="left"><a href="${href}"><code>${escapeHtml(fn.path)}:${fn.line}</code></a></td>
      <td>${fn.lines}</td>
      <td>${fn.cyclomatic}</td>
      <td>${fn.cognitive}</td>
    </tr>`;
		})
		.join('\n');

	return `<div class="table-wrap"><table>
      <thead><tr><th class="left">Function</th><th class="left">Location</th><th>Lines</th><th>Cyclomatic</th><th>Cognitive</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;
}

function highFanInTable(highFanIn, commit) {
	if (highFanIn.length === 0) {
		return '<p>No scored file is imported by more than the fan-in threshold.</p>';
	}

	const rows = highFanIn
		.map(
			(file) => `<tr>
      <td class="left"><a href="${fallowSourceHref(commit, file.path, 0)}"><code>${escapeHtml(file.path)}</code></a></td>
      <td>${file.fan_in}</td>
      <td>${file.fan_out}</td>
      <td>${formatNumber(file.maintainability_index)}</td>
      <td>${file.lines}</td>
    </tr>`
		)
		.join('\n');

	return `<div class="table-wrap"><table>
      <thead><tr><th class="left">File</th><th>Fan-in</th><th>Fan-out</th><th>Maintainability</th><th>Lines</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;
}

function longFunctionSummary(report) {
	if (report.counts.longFunctionCount === 0) {
		return 'No function is longer than 60 lines, so the function-size penalty is zero.';
	}

	const share = `${formatNumber(report.counts.longFunctionPct)}% of all functions`;
	const list =
		report.longFunctions.length > 0
			? 'The functions below'
			: 'The per-function list is unavailable';

	return `${list} cover ${report.counts.longFunctionCount} functions (${share}) and drive the function-size penalty.`;
}

function healthPageContent(report, commit) {
	return `
    ${scoreCards(report)}
    <section class="section">
      <div class="section-head"><div><h2>What deducts points</h2><p>Fallow starts at 100 and subtracts a capped penalty for each area. Only the areas below deduct anything in this build.</p></div></div>
      ${deductionTable(report)}
      ${clearedBadges(report)}
    </section>
    <section class="section">
      <div class="section-head"><div><h2>Functions longer than 60 lines</h2><p>${escapeHtml(longFunctionSummary(report))}</p></div><span class="badge skip">${report.counts.longFunctionCount}</span></div>
      ${longFunctionTable(report.longFunctions, commit, report.counts.longFunctionCount)}
    </section>
    <section class="section">
      <div class="section-head"><div><h2>Files imported by more than ${report.fanInThreshold} files</h2><p>${escapeHtml(report.counts.highFanInCount.toString())} of ${escapeHtml(report.counts.files.toString())} scored files are above the fan-in threshold, which drives the coupling penalty.</p></div><span class="badge skip">${report.highFanIn.length}</span></div>
      ${highFanInTable(report.highFanIn, commit)}
    </section>
    <section class="section">
      <div class="section-head"><div><h2>How to read this</h2><p>Every number comes from the same Fallow JSON that the badge and the CI gate use. A penalty is capped, so fixing one area cannot move the score past its cap.</p></div></div>
      <p class="note"><a href="../index.html">Open the interactive Fallow map</a> · <a href="../health.json">Raw health JSON</a> · <a href="https://fallow.tools/docs/cli/health/#health-score-formula">Fallow score formula</a></p>
    </section>`;
}

function renderFallowHealth({ commit, generatedAt, health, longFunctions }) {
	const report = describeHealth(health, { longFunctions });
	const directory = join(REPORTS, 'fallow', 'health');
	mkdirSync(directory, { recursive: true });

	const content = report
		? healthPageContent(report, commit)
		: '<p>Fallow did not produce a health score for this build.</p>';

	writeFileSync(
		join(directory, 'index.html'),
		page(
			'Fallow health score',
			'Why the Fallow health score is what it is, with the measurement behind each deduction and the files that drive it.',
			'../../',
			'health',
			{ meta: reportMeta(commit, generatedAt), content }
		)
	);
}

function renderScriptsReport({ commit, generatedAt, scripts }) {
	const output = `${scripts.stdout ?? ''}${scripts.stderr ?? ''}`.trim() || 'No output.';
	const content = `<pre>${escapeHtml(output)}</pre>`;
	const scriptDirectory = join(REPORTS, 'tests', 'scripts');
	mkdirSync(scriptDirectory, { recursive: true });
	writeFileSync(
		join(scriptDirectory, 'index.html'),
		page(
			'Script tests',
			'Node test runner output for repository scripts and report tooling.',
			'../../',
			'tests',
			{ meta: reportMeta(commit, generatedAt), content }
		)
	);
}

function readJson(path) {
	return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : undefined;
}

function prepareVitestReport(workspace, directory) {
	const reportPath = join(directory, workspace, 'index.html');
	if (!existsSync(reportPath)) return;

	const html = readFileSync(reportPath, 'utf8');
	writeFileSync(reportPath, stripFaviconLinks(html));
}

function run(command, args, options = {}) {
	const result = spawnSync(command, args, {
		cwd: ROOT,
		encoding: 'utf8',
		stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
		env: { ...process.env, ...options.env },
	});

	if (result.error) {
		throw result.error;
	}

	return result;
}

function currentCommit() {
	return (
		process.env.GITHUB_SHA ??
		execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT }).toString().trim()
	);
}

function collectTestReports() {
	rmSync(ARTIFACTS, { recursive: true, force: true });
	const testDirectory = join(ARTIFACTS, 'tests');
	mkdirSync(testDirectory, { recursive: true });
	const failures = [];

	for (const workspace of TEST_WORKSPACES) {
		const result = run('pnpm', ['--filter', workspace.package, 'exec', 'vitest', 'run'], {
			env: { TEST_REPORT_DIR: testDirectory },
		});
		if (result.status !== 0) failures.push(`${workspace.name} tests`);
		prepareVitestReport(workspace.id, testDirectory);
	}

	const scriptTests = readdirSync(join(ROOT, 'scripts'))
		.filter((file) => file.endsWith('.test.mjs'))
		.map((file) => join(ROOT, 'scripts', file));
	const scripts = run('node', ['--test', ...scriptTests], { capture: true });
	writeFileSync(
		join(ARTIFACTS, 'scripts.json'),
		`${JSON.stringify({ status: scripts.status, stdout: scripts.stdout, stderr: scripts.stderr }, null, 2)}\n`
	);
	if (scripts.status !== 0) failures.push('script tests');

	return failures;
}

function readScriptContext() {
	const saved = readJson(join(ARTIFACTS, 'scripts.json'));
	if (saved) return saved;

	const outputPath = join(ARTIFACTS, 'script-tests.txt');
	return {
		status: existsSync(outputPath) ? 0 : 1,
		stdout: existsSync(outputPath) ? readFileSync(outputPath, 'utf8') : '',
		stderr: existsSync(outputPath) ? '' : 'No script test output was recorded.',
	};
}

function prepareOutputDirectory() {
	rmSync(REPORTS, { recursive: true, force: true });
	mkdirSync(join(REPORTS, 'fallow'), { recursive: true });
	mkdirSync(join(REPORTS, 'benchmarks'), { recursive: true });
	writeFileSync(join(REPORTS, 'report.css'), REPORT_CSS.trimStart());

	const testArtifacts = join(ARTIFACTS, 'tests');
	if (!existsSync(testArtifacts)) {
		throw new Error('Missing test report artifacts. Run "pnpm reports" first.');
	}
	cpSync(testArtifacts, join(REPORTS, 'tests'), { recursive: true });
}

function buildFallowReport(renderOnly, failures) {
	const fallowMap = run('pnpm', [
		'exec',
		'fallow',
		'viz',
		'--out',
		join(REPORTS, 'fallow', 'index.html'),
		'--no-open',
	]);
	if (fallowMap.status !== 0) failures.push('fallow viz');

	if (renderOnly) {
		const fullFallow = readJson(join(ROOT, '.fallow', 'full.json'));
		if (fullFallow?.health) {
			writeFileSync(
				join(REPORTS, 'fallow', 'health.json'),
				`${JSON.stringify(fullFallow.health, null, 2)}\n`
			);
		}
	} else {
		run('pnpm', [
			'exec',
			'fallow',
			'health',
			'--format',
			'json',
			'--quiet',
			'--output-file',
			join(REPORTS, 'fallow', 'health.json'),
		]);
	}

	try {
		const longFunctions = measureLongFunctions(ROOT);
		writeFileSync(
			join(REPORTS, 'fallow', 'long-functions.json'),
			`${JSON.stringify(longFunctions, null, 2)}\n`
		);
	} catch (error) {
		console.error(`Could not measure long functions: ${error.message}`);
		failures.push('fallow long functions');
	}
}

function runBenchmark(failures) {
	const result = run('pnpm', ['--filter', '@utilize/json-schema', 'bench'], {
		env: { BENCH_OUTPUT: join(REPORTS, 'benchmarks', 'results.json') },
	});
	if (result.status !== 0) failures.push('benchmarks');
}

async function buildReports() {
	const renderOnly = process.argv.includes('--render-only');
	const failures = renderOnly ? [] : collectTestReports();
	prepareOutputDirectory();

	const commit = currentCommit();
	const generatedAt = new Date().toISOString();
	const scripts = readScriptContext();
	if (scripts.status !== 0) failures.push('script tests');

	buildFallowReport(renderOnly, failures);
	runBenchmark(failures);

	const tests = TEST_WORKSPACES.map((workspace) => {
		const report = readJson(join(REPORTS, 'tests', workspace.id, 'results.json'));
		return report ? summarizeVitest(workspace, report) : undefined;
	}).filter(Boolean);
	const health = readJson(join(REPORTS, 'fallow', 'health.json'));
	const longFunctions = readJson(join(REPORTS, 'fallow', 'long-functions.json')) ?? [];
	const benchmark = readJson(join(REPORTS, 'benchmarks', 'results.json'));
	const context = { commit, generatedAt, health, tests, benchmark, scripts };

	renderHub(context);
	renderFallowHealth({ commit, generatedAt, health, longFunctions });
	renderTestsIndex(context);
	renderBenchmarksIndex(context);
	renderScriptsReport(context);

	if (failures.length > 0) {
		throw new Error(`Report generation failed: ${failures.join(', ')}`);
	}
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	await buildReports();
}
