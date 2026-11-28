/**
 * Pure routing and label logic for the triage bot. Kept free of I/O so it can
 * be tested without GitHub or a model.
 */

export const LABELS = {
	needsTriage: 'triage: needs triage',
	notActionable: 'triage: not actionable',
	needsReproduction: 'triage: needs reproduction',
	skipped: 'triage: skipped',
	unableToReproduce: 'triage: unable to reproduce',
	unableToFix: 'triage: unable to fix',
	failed: 'triage: failed',
	fixPending: 'triage: fix pending',
	fixRejected: 'triage: fix rejected',
	fixVerified: 'triage: fix verified',
};

export const RETRIAGEABLE = [
	LABELS.needsTriage,
	LABELS.needsReproduction,
	LABELS.unableToReproduce,
	LABELS.unableToFix,
	LABELS.failed,
	LABELS.fixRejected,
];

export const TERMINAL = [LABELS.fixVerified, LABELS.notActionable, LABELS.skipped];

export function labelNames(issue) {
	return (issue?.labels ?? []).map((label) => (typeof label === 'string' ? label : label.name));
}

export function currentTriageLabel(issue) {
	const all = Object.values(LABELS);
	return labelNames(issue).find((label) => all.includes(label)) ?? null;
}

export function isBotComment(comment, botLogins) {
	const login = comment?.user?.login;
	if (!login) return false;
	return login === 'github-actions[bot]' || botLogins.includes(login);
}

/**
 * Avoid spending a full triage run on "thanks" and "any update?" comments.
 * Maintainers can always trigger a rerun by writing something specific.
 */
export function looksActionable(body) {
	if (!body) return false;
	if (/```/.test(body)) return true;
	if (/https?:\/\//.test(body)) return true;
	return /\b(retry|re-?triage|still|same|repro|reproduce|error|stack|trace|crash|fail|version|update|fixed|works|broken|add(ed)?|here('s| is))\b/i.test(
		body
	);
}

function isMaintainer(comment) {
	return ['MEMBER', 'COLLABORATOR', 'OWNER'].includes(comment?.author_association);
}

/**
 * Decide what to do for a GitHub event.
 *
 * @param {{ eventName: string, action: string, issue: any, comment?: any, botLogins?: string[] }} event
 * @returns {{ type: 'triage', mode: 'triage' | 'retriage', issueNumber: number }
 *   | { type: 'cleanup', issueNumber: number }
 *   | { type: 'verify-fix', issueNumber: number }
 *   | { type: 'skip', reason: string }}
 */
export function route({ eventName, action, issue, comment, botLogins = [] }) {
	if (!issue) return { type: 'skip', reason: 'event has no issue' };
	if (issue.pull_request) return { type: 'skip', reason: 'event is a pull request' };

	const issueNumber = issue.number;

	if (eventName === 'issues') {
		if (action === 'opened' || action === 'reopened') {
			return { type: 'triage', mode: 'triage', issueNumber };
		}
		if (action === 'closed') return { type: 'cleanup', issueNumber };
		return { type: 'skip', reason: `issues.${action} is not handled` };
	}

	if (eventName === 'issue_comment') {
		if (action !== 'created') {
			return { type: 'skip', reason: `issue_comment.${action} is not handled` };
		}
		if (isBotComment(comment, botLogins)) {
			return { type: 'skip', reason: `comment from bot ${comment?.user?.login}` };
		}

		const current = currentTriageLabel(issue);
		if (current === LABELS.fixPending) {
			// `fix pending` belongs to a preview-release flow this bot does not
			// use; it is reserved and should not trigger a full re-run.
			return { type: 'skip', reason: 'fix pending is unused in auto-PR mode' };
		}
		if (current && RETRIAGEABLE.includes(current)) {
			if (isMaintainer(comment) || looksActionable(comment?.body)) {
				return { type: 'triage', mode: 'retriage', issueNumber };
			}
			return { type: 'skip', reason: 'comment does not look actionable' };
		}
		return {
			type: 'skip',
			reason: current ? `terminal label ${current}` : 'issue has no triage label',
		};
	}

	return { type: 'skip', reason: `event ${eventName} is not handled` };
}

/**
 * Map the agent result to the next state label.
 */
export function labelForResult(result, { prOpened = false } = {}) {
	if (result.skipped) {
		if (result.skippedReason === 'not-actionable') return LABELS.notActionable;
		if (result.skippedReason === 'missing-details') return LABELS.needsReproduction;
		return LABELS.skipped;
	}
	if (result.verdict === 'intended-behavior') return LABELS.notActionable;
	if (!result.reproducible) return LABELS.unableToReproduce;
	if (result.fixed) return prOpened ? LABELS.fixVerified : LABELS.unableToFix;
	return LABELS.unableToFix;
}
