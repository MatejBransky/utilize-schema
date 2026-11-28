/**
 * Agent step.
 *
 * Runs the OpenCode agent and writes decision.json, issue.json, report.md,
 * result.json, and the optional drafts under triage/gh-<n>/. It performs no
 * GitHub writes and does not receive the GitHub App token: the apply step
 * creates that token after this process exits.
 */

import { mkdir, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';

import opencodePackage from '@opencode/cli/package.json' with { type: 'json' };

import { buildPrompt, runAgent } from './agent.mjs';
import { currentBranch, fetchIssue } from './github.mjs';
import { buildAgentEnv } from './model.mjs';
import { currentTriageLabel, route } from './router.mjs';
import { parseBotLogins, readEvent, redact, required } from './util.mjs';

const cwd = process.cwd();
const require = createRequire(import.meta.url);
const OPENCODE_BIN =
	process.env.TRIAGE_OPENCODE_BIN ??
	require.resolve(`@opencode/cli/${opencodePackage.bin.opencode.replace(/^\.\//, '')}`);
let context = null;

async function main() {
	const repo = required('GITHUB_REPOSITORY');
	const eventPath = required('GITHUB_EVENT_PATH');
	const eventName = required('GITHUB_EVENT_NAME');
	const readToken = required('GITHUB_TOKEN');
	const model = required('TRIAGE_MODEL');
	const apiKey = required('TRIAGE_MODEL_API_KEY');
	const botLogins = parseBotLogins(process.env.TRIAGE_BOT_LOGIN);

	const { payload, issue } = await readEvent(eventPath);
	if (!issue) {
		console.log('No issue in the event payload; nothing to do.');
		return;
	}

	const issueNumber = issue.number;
	const triageDir = join('triage', `gh-${issueNumber}`);
	await rm(triageDir, { recursive: true, force: true });
	await mkdir(triageDir, { recursive: true });
	context = { triageDir, apiKey, readToken };

	const currentLabel = currentTriageLabel(issue);
	const startBranch = await currentBranch(cwd);
	const decision = route({
		eventName,
		action: payload.action,
		issue,
		comment: payload.comment,
		botLogins,
	});
	await writeFile(
		join(triageDir, 'decision.json'),
		`${JSON.stringify({ ...decision, issueNumber, currentLabel, startBranch }, null, 2)}\n`
	);
	console.log('Route:', decision);

	if (decision.type !== 'triage') {
		return;
	}

	const issueDetails = await fetchIssue(repo, issueNumber, readToken);
	await writeFile(join(triageDir, 'issue.json'), `${JSON.stringify(issueDetails, null, 2)}\n`);

	const prompt = buildPrompt({ issueNumber, issueDetails, mode: decision.mode, triageDir });
	const agentEnv = buildAgentEnv({
		model,
		apiKey,
		baseUrl: process.env.TRIAGE_MODEL_BASE_URL,
		userConfig: process.env.TRIAGE_OPENCODE_CONFIG,
		baseEnv: process.env,
	});
	agentEnv.GH_TOKEN = readToken;
	agentEnv.GITHUB_TOKEN = readToken;

	const run = await runAgent({
		prompt,
		model,
		env: agentEnv,
		cwd,
		bin: OPENCODE_BIN,
		logPath: join(triageDir, 'opencode.jsonl'),
	});
	if (run.exitCode !== 0) {
		throw new Error(`OpenCode exited with ${run.exitCode}.\n\n${run.stderr.slice(-8000)}`);
	}
}

try {
	await main();
} catch (error) {
	const secrets = [process.env.TRIAGE_MODEL_API_KEY, process.env.GITHUB_TOKEN].filter(Boolean);
	const message = redact(error?.stack ?? String(error), secrets);
	console.error(message);
	if (context) {
		try {
			await mkdir(context.triageDir, { recursive: true });
			await writeFile(join(context.triageDir, 'error.txt'), `${message}\n`);
		} catch (writeError) {
			console.error('Could not write error.txt:', writeError);
		}
	}
	process.exitCode = 1;
}
