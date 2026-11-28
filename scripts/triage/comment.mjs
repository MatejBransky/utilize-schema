/**
 * Deterministic GitHub comment and PR body fallbacks. The agent may write
 * comment.md / pr.md; these templates keep the bot useful when it does not.
 */

import { when } from './util.mjs';

const COMMENT_LIMIT = 60_000;
const REPORT_LIMIT = 50_000;

function truncate(text, max) {
	if (!text) {
		return '';
	}
	if (text.length <= max) {
		return text;
	}
	return `${text.slice(0, max)}\n\n… truncated (${text.length - max} characters omitted)`;
}

function reasonLabel(reason) {
	return (
		{
			'not-actionable': 'not actionable',
			'missing-details': 'missing details',
			'unsupported-version': 'unsupported version',
			'host-specific': 'host-specific',
			'unsupported-runtime': 'unsupported runtime',
			'maintainer-override': 'maintainer override',
		}[reason] ?? reason
	);
}

function summarize(result, draft) {
	if (draft) {
		return truncate(draft, 8000);
	}
	const outcomes = [
		[result.fixed, 'The agent found and verified a fix. See the report below.'],
		[
			result.verdict === 'intended-behavior',
			'The reported behavior is intentional, so this is not a bug fix.',
		],
		[result.skipped, 'This issue could not be triaged automatically for the reason above.'],
		[!result.reproducible, 'The agent could not reproduce the report on `main`.'],
	];
	const match = outcomes.find(([condition]) => condition);
	return match?.[1] ?? 'The agent reproduced the issue but did not find a safe fix.';
}

function reproducedStatus(result) {
	if (result.skipped) {
		return `Skipped — ${reasonLabel(result.skippedReason)}`;
	}
	return result.reproducible ? 'Yes' : 'No';
}

function fixTarget({ pr, branch, repo }) {
	if (pr) {
		return `[pull request](${pr.html_url})`;
	}
	if (branch) {
		return `[branch](https://github.com/${repo}/compare/${branch}?expand=1)`;
	}
	return 'none';
}

function buildStatusLines(result, { pr, branch, repo, note }) {
	return [
		`- **Reproduced:** ${reproducedStatus(result)}`,
		`- **Verdict:** ${result.skipped ? '—' : result.verdict}`,
		`- **Fix:** ${fixTarget({ pr, branch, repo })}`,
		...when(result.test, `- **Unit test:** \`${result.test}\``),
		...when(result.priority, `- **Priority:** ${result.priority}`),
		...when(result.packages?.length, `- **Packages:** ${result.packages.join(', ')}`),
		...when(note, ''),
		...when(note, `> ${note}`),
	];
}

export function buildComment({
	result,
	report,
	branch,
	pr,
	repo,
	model,
	note = null,
	draft = null,
}) {
	const lines = [
		'<!-- triagebot:report -->',
		'### Automated triage',
		'',
		...buildStatusLines(result, { pr, branch, repo, note }),
		'',
		summarize(result, draft),
		...when(pr, ''),
		...when(pr, `I opened a pull request with the fix: ${pr?.html_url}`),
		'',
		'<details>',
		'<summary><em>Full triage report</em></summary>',
		'',
		truncate(report || '_No report.md was written._', REPORT_LIMIT),
		'',
		'</details>',
		'',
		`_This report was made by an LLM (\`${model}\`). The analysis may be wrong; the fix needs human review._`,
	];
	return truncate(lines.join('\n'), COMMENT_LIMIT);
}

function inferScope(result, changedFiles) {
	const packageLabel = result.packages?.find((label) => label.startsWith('pkg: '));
	if (packageLabel) {
		return packageLabel.slice('pkg: '.length);
	}
	const file = changedFiles.find((path) => path.startsWith('packages/'));
	if (file) {
		return file.split('/')[1];
	}
	return 'repo';
}

export function buildPrTitle({ result, issue, changedFiles }) {
	const conventional =
		result.commitMessage && /^(fix|test|docs)\([^)]+\): .+/.test(result.commitMessage);
	if (conventional) {
		return truncate(result.commitMessage, 72);
	}
	return truncate(`fix(${inferScope(result, changedFiles)}): ${issue.title}`, 72);
}

function defaultPrBody(result, issue, changedFiles) {
	const checks = result.checks?.length
		? result.checks.map((check) => `- \`${check}\``).join('\n')
		: '- See the triage report for the commands that were run.';
	return [
		'## Summary',
		'',
		`Fixes #${issue.number} — ${issue.title}.`,
		'',
		'## Changes',
		'',
		...changedFiles.map((file) => `- \`${file}\``),
		'',
		'## Verification',
		'',
		checks,
		'',
		'## Changeset',
		'',
		result.changeset
			? `\`.changeset/${result.changeset.split('/').pop()}\``
			: 'None (the fix did not touch a package).',
		'',
		`Closes #${issue.number}`,
		'',
		'_This PR was opened by the triage bot and needs human review._',
	].join('\n');
}

function ensureCloses(body, issueNumber) {
	if (new RegExp(`\\bCloses #${issueNumber}\\b`).test(body)) {
		return body;
	}
	return `${body}\n\nCloses #${issueNumber}`;
}

function appendDiffStat(body, diffStat) {
	if (!diffStat) {
		return body;
	}
	return `${body}\n\n<details><summary>Diff stat</summary>\n\n\`\`\`\n${diffStat}\n\`\`\`\n\n</details>`;
}

export function buildPrBody({ result, issue, changedFiles, diffStat, draft = null }) {
	const body = draft ?? defaultPrBody(result, issue, changedFiles);
	return truncate(appendDiffStat(ensureCloses(body, issue.number), diffStat), COMMENT_LIMIT);
}
