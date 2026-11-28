// fallow-ignore-file security-sink -- every request goes to the fixed https://api.github.com origin; the dynamic parts are repository names, numeric issue/PR numbers, and URL-encoded label names
/**
 * GitHub API and git helpers for the triage bot.
 *
 * All reads use the workflow's read token. Writes use the GitHub App token,
 * which is only ever passed to these helpers, never to the agent process.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const API = 'https://api.github.com';

function headers(token) {
	return {
		Authorization: `Bearer ${token}`,
		Accept: 'application/vnd.github+json',
		'Content-Type': 'application/json',
		'X-GitHub-Api-Version': '2022-11-28',
	};
}

async function request(path, { token, method = 'GET', body } = {}) {
	const response = await fetch(`${API}${path}`, {
		method,
		headers: headers(token),
		body: body === undefined ? undefined : JSON.stringify(body),
	});
	if (!response.ok) {
		const text = await response.text();
		throw new Error(`GitHub ${method} ${path} failed with ${response.status}: ${text}`);
	}
	if (response.status === 204) {
		return null;
	}
	return response.json();
}

function loginOf(user) {
	return user?.login ?? 'unknown';
}

function mapComment(comment) {
	return {
		author: loginOf(comment.user),
		authorAssociation: comment.author_association,
		body: comment.body ?? '',
		createdAt: comment.created_at,
	};
}

function mapIssueDetails(issue, comments) {
	return {
		number: issue.number,
		title: issue.title,
		body: issue.body ?? '',
		state: issue.state,
		url: issue.html_url,
		author: loginOf(issue.user),
		labels: (issue.labels ?? []).map((label) => label.name),
		createdAt: issue.created_at,
		comments: (comments ?? []).map(mapComment),
	};
}

export async function fetchIssue(repo, issueNumber, token) {
	const [issue, comments] = await Promise.all([
		request(`/repos/${repo}/issues/${issueNumber}`, { token }),
		request(`/repos/${repo}/issues/${issueNumber}/comments?per_page=100`, { token }),
	]);
	return mapIssueDetails(issue, comments);
}

export async function postComment(repo, issueNumber, body, token) {
	return request(`/repos/${repo}/issues/${issueNumber}/comments`, {
		token,
		method: 'POST',
		body: { body },
	});
}

export async function addLabels(repo, issueNumber, labels, token) {
	if (!labels || labels.length === 0) {
		return;
	}
	return request(`/repos/${repo}/issues/${issueNumber}/labels`, {
		token,
		method: 'POST',
		body: { labels },
	});
}

async function removeLabel(repo, issueNumber, label, token) {
	try {
		await request(`/repos/${repo}/issues/${issueNumber}/labels/${encodeURIComponent(label)}`, {
			token,
			method: 'DELETE',
		});
	} catch (error) {
		if (!/\b404\b/.test(error.message)) {
			throw error;
		}
	}
}

export async function swapLabel(repo, issueNumber, oldLabel, newLabel, token) {
	if (oldLabel && oldLabel !== newLabel) {
		await removeLabel(repo, issueNumber, oldLabel, token);
	}
	if (newLabel) {
		await addLabels(repo, issueNumber, [newLabel], token);
	}
}

export async function findPullRequest(repo, branch, token) {
	const owner = repo.split('/')[0];
	const pulls = await request(
		`/repos/${repo}/pulls?head=${encodeURIComponent(`${owner}:${branch}`)}&state=open`,
		{ token }
	);
	if (!Array.isArray(pulls) || pulls.length === 0) {
		return null;
	}
	return pulls[0];
}

export async function createPullRequest(repo, { title, body, head, base = 'main' }, token) {
	return request(`/repos/${repo}/pulls`, {
		token,
		method: 'POST',
		body: { title, body, head, base },
	});
}

export async function deleteBranch(repo, branch, token) {
	try {
		await request(`/repos/${repo}/git/refs/heads/${branch}`, {
			token,
			method: 'DELETE',
		});
	} catch (error) {
		// 404/422 both mean the branch is already gone.
		if (!/\b(404|422)\b/.test(error.message)) {
			throw error;
		}
	}
}

// ---------- git ----------

async function git(args, { cwd, env } = {}) {
	const { stdout } = await execFileAsync('git', args, {
		cwd,
		env: { ...process.env, ...env, GIT_TERMINAL_PROMPT: '0' },
		maxBuffer: 20 * 1024 * 1024,
	});
	return stdout;
}

export async function checkoutBranch(cwd, branch) {
	await git(['checkout', '-B', branch], { cwd });
}

export async function resetSoft(cwd, base = 'main') {
	await git(['reset', '--soft', base], { cwd });
}

function parseStatus(stdout) {
	return stdout
		.split('\n')
		.map((line) => line.trimEnd())
		.filter(Boolean)
		.map((line) => {
			const path = line.slice(3).trim();
			const arrow = path.indexOf(' -> ');
			return arrow === -1 ? path : path.slice(arrow + 4);
		});
}

async function statusFiles(cwd) {
	return parseStatus(await git(['status', '--porcelain', '-uall'], { cwd }));
}

export async function currentBranch(cwd) {
	return (await git(['branch', '--show-current'], { cwd })).trim();
}

export async function changedFiles(cwd, base = 'main') {
	const tracked = (await git(['diff', '--name-only', base], { cwd }))
		.split('\n')
		.map((line) => line.trim())
		.filter(Boolean);
	const untracked = await statusFiles(cwd);
	return [...new Set([...tracked, ...untracked])].sort((a, b) => a.localeCompare(b));
}

export async function commitAll(cwd, message) {
	await git(['add', '-A'], { cwd });
	if ((await statusFiles(cwd)).length === 0) {
		return false;
	}
	await git(
		[
			'-c',
			'user.name=triage-bot',
			'-c',
			'user.email=triage-bot@users.noreply.github.com',
			'commit',
			'-m',
			message,
		],
		{ cwd }
	);
	return true;
}

export async function pushBranch({ cwd, repo, branch, token }) {
	await git(['push', '-f', `https://x-access-token:${token}@github.com/${repo}.git`, branch], {
		cwd,
	});
}

export async function diffStat(cwd, base = 'main') {
	return (await git(['diff', base, '--stat'], { cwd })).trim();
}
