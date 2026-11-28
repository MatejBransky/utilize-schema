/**
 * Shared helpers for the agent step and the apply step.
 */

import { readFile } from 'node:fs/promises';

export function required(name) {
	const value = process.env[name];
	if (!value) throw new Error(`${name} is not set.`);
	return value;
}

export function parseBotLogins(value) {
	return String(value ?? '')
		.split(',')
		.map((login) => login.trim())
		.filter(Boolean);
}

export function redact(text, secrets) {
	let output = String(text ?? '');
	for (const secret of secrets) {
		if (secret) output = output.split(secret).join('[redacted]');
	}
	return output;
}

export async function readOptional(path) {
	try {
		const value = (await readFile(path, 'utf8')).trim();
		return value || null;
	} catch {
		return null;
	}
}

export function runUrl() {
	const server = process.env.GITHUB_SERVER_URL ?? 'https://github.com';
	const repo = process.env.GITHUB_REPOSITORY;
	const runId = process.env.GITHUB_RUN_ID;
	return server && repo && runId ? `${server}/${repo}/actions/runs/${runId}` : null;
}

const FORBIDDEN_CHANGES = [
	/^\.github\//,
	/(^|\/)package\.json$/,
	/^pnpm-lock\.yaml$/,
	/^pnpm-workspace\.yaml$/,
	/^scripts\/triage\//,
	/(^|\/)(knownFailures|knownFailureInstances|knownGaps)\.ts$/,
	/(^|\/)baseline\.(ts|json)$/,
	/(^|\/)\.env(\.|$)/,
	/(^|\/)\.npmrc$/,
	/(^|\/).*\.(pem|key)$/,
	/(^|\/)id_(rsa|ed25519)$/,
];

export function assertSafeChanges(files) {
	const forbidden = files.filter((file) => FORBIDDEN_CHANGES.some((pattern) => pattern.test(file)));
	if (forbidden.length > 0) {
		throw new Error(
			`The agent changed files the bot must not commit:\n${forbidden.map((file) => `- ${file}`).join('\n')}`
		);
	}
}

export function assertChangeset(result, files) {
	if (!result.fixed) return;
	if (!files.some((file) => file.startsWith('packages/'))) return;
	if (files.some((file) => file.startsWith('.changeset/') && file.endsWith('.md'))) return;
	throw new Error(
		'The fix changes packages/ but no .changeset/*.md was added. Add a changeset before finishing.'
	);
}

export async function assertNoSecrets(files, secrets) {
	const needles = secrets.filter((secret) => typeof secret === 'string' && secret.length >= 12);
	if (needles.length === 0) return;
	for (const file of files) {
		let content;
		try {
			content = await readFile(file, 'utf8');
		} catch {
			continue;
		}
		if (content.length > 2_000_000) continue;
		if (needles.some((needle) => content.includes(needle))) {
			throw new Error(
				`A changed file (${file}) contains a credential. Refusing to commit or comment it.`
			);
		}
	}
}
