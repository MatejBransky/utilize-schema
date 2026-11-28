/**
 * Deterministic GitHub comment and PR body fallbacks. The agent may write
 * comment.md / pr.md; these templates keep the bot useful when it does not.
 */

const COMMENT_LIMIT = 60_000;
const REPORT_LIMIT = 50_000;

function truncate(text, max) {
	if (!text) return '';
	if (text.length <= max) return text;
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
	const lines = [];
	lines.push('<!-- triagebot:report -->');
	lines.push('### Automated triage');
	lines.push('');
	lines.push(
		`- **Reproduced:** ${
			result.skipped
				? `Skipped — ${reasonLabel(result.skippedReason)}`
				: result.reproducible
					? 'Yes'
					: 'No'
		}`
	);
	lines.push(`- **Verdict:** ${result.skipped ? '—' : result.verdict}`);
	lines.push(
		`- **Fix:** ${
			pr
				? `[pull request](${pr.html_url})`
				: branch
					? `[branch](https://github.com/${repo}/compare/${branch}?expand=1)`
					: 'none'
		}`
	);
	if (result.test) lines.push(`- **Unit test:** \`${result.test}\``);
	if (result.priority) lines.push(`- **Priority:** ${result.priority}`);
	if (result.packages?.length) lines.push(`- **Packages:** ${result.packages.join(', ')}`);
	if (note) {
		lines.push('');
		lines.push(`> ${note}`);
	}
	lines.push('');
	if (draft) {
		lines.push(truncate(draft, 8_000));
	} else if (result.fixed) {
		lines.push('The agent found and verified a fix. See the report below.');
	} else if (result.verdict === 'intended-behavior') {
		lines.push('The reported behavior is intentional, so this is not a bug fix.');
	} else if (result.skipped) {
		lines.push('This issue could not be triaged automatically for the reason above.');
	} else if (!result.reproducible) {
		lines.push('The agent could not reproduce the report on `main`.');
	} else {
		lines.push('The agent reproduced the issue but did not find a safe fix.');
	}
	if (pr) {
		lines.push('');
		lines.push(`I opened a pull request with the fix: ${pr.html_url}`);
	}
	lines.push('');
	lines.push('<details>');
	lines.push('<summary><em>Full triage report</em></summary>');
	lines.push('');
	lines.push(truncate(report || '_No report.md was written._', REPORT_LIMIT));
	lines.push('');
	lines.push('</details>');
	lines.push('');
	lines.push(
		`_This report was made by an LLM (\`${model}\`). The analysis may be wrong; the fix needs human review._`
	);
	return truncate(lines.join('\n'), COMMENT_LIMIT);
}

function inferScope(result, changedFiles) {
	const packageLabel = result.packages?.find((label) => label.startsWith('pkg: '));
	if (packageLabel) return packageLabel.slice('pkg: '.length);
	const file = changedFiles.find((path) => path.startsWith('packages/'));
	if (file) return file.split('/')[1];
	return 'repo';
}

export function buildPrTitle({ result, issue, changedFiles }) {
	const conventional =
		result.commitMessage && /^(fix|test|docs)\([^)]+\): .+/.test(result.commitMessage);
	if (conventional) return truncate(result.commitMessage, 72);
	return truncate(`fix(${inferScope(result, changedFiles)}): ${issue.title}`, 72);
}

export function buildPrBody({ result, issue, changedFiles, diffStat, draft = null }) {
	let body;
	if (draft) {
		body = draft;
	} else {
		const checks = result.checks?.length
			? result.checks.map((check) => `- \`${check}\``).join('\n')
			: '- See the triage report for the commands that were run.';
		body = [
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
	if (!new RegExp(`\\bCloses #${issue.number}\\b`).test(body)) {
		body += `\n\nCloses #${issue.number}`;
	}
	if (diffStat) {
		body += `\n\n<details><summary>Diff stat</summary>\n\n\`\`\`\n${diffStat}\n\`\`\`\n\n</details>`;
	}
	return truncate(body, COMMENT_LIMIT);
}
