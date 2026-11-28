import assert from 'node:assert/strict';
import test from 'node:test';

import { LABELS, currentTriageLabel, labelForResult, route } from './router.mjs';

const issue = (labels = ['bug']) => ({ number: 42, labels: labels.map((name) => ({ name })) });
const comment = (body, login = 'reporter', association = 'NONE') => ({
	body,
	user: { login },
	author_association: association,
});

test('opened and reopened run a full triage', () => {
	assert.deepEqual(route({ eventName: 'issues', action: 'opened', issue: issue() }), {
		type: 'triage',
		mode: 'triage',
		issueNumber: 42,
	});
	assert.deepEqual(route({ eventName: 'issues', action: 'reopened', issue: issue() }), {
		type: 'triage',
		mode: 'triage',
		issueNumber: 42,
	});
});

test('closed cleans up the branch', () => {
	assert.deepEqual(route({ eventName: 'issues', action: 'closed', issue: issue() }), {
		type: 'cleanup',
		issueNumber: 42,
	});
});

test('ignores pull requests and unknown actions', () => {
	assert.equal(
		route({ eventName: 'issues', action: 'opened', issue: { ...issue(), pull_request: {} } }).type,
		'skip'
	);
	assert.equal(route({ eventName: 'issues', action: 'labeled', issue: issue() }).type, 'skip');
});

test('ignores bot comments', () => {
	const result = route({
		eventName: 'issue_comment',
		action: 'created',
		issue: issue([LABELS.needsReproduction]),
		comment: comment('retry', 'bot[bot]'),
		botLogins: ['bot[bot]'],
	});
	assert.equal(result.type, 'skip');
});

test('re-triages actionable comments on a retriageable label', () => {
	const result = route({
		eventName: 'issue_comment',
		action: 'created',
		issue: issue([LABELS.unableToFix]),
		comment: comment('Here is a smaller schema:\n```json\n{}\n```'),
	});
	assert.deepEqual(result, { type: 'triage', mode: 'retriage', issueNumber: 42 });
});

test('does not re-triage a plain thank-you', () => {
	const result = route({
		eventName: 'issue_comment',
		action: 'created',
		issue: issue([LABELS.unableToFix]),
		comment: comment('thanks!'),
	});
	assert.equal(result.type, 'skip');
});

test('maintainers can always re-triage', () => {
	const result = route({
		eventName: 'issue_comment',
		action: 'created',
		issue: issue([LABELS.unableToFix]),
		comment: comment('please take another look', 'maintainer', 'MEMBER'),
	});
	assert.deepEqual(result, { type: 'triage', mode: 'retriage', issueNumber: 42 });
});

test('terminal labels are ignored', () => {
	const result = route({
		eventName: 'issue_comment',
		action: 'created',
		issue: issue([LABELS.fixVerified]),
		comment: comment('still broken'),
	});
	assert.equal(result.type, 'skip');
});

test('currentTriageLabel finds the state label', () => {
	assert.equal(currentTriageLabel(issue(['bug', LABELS.needsTriage])), LABELS.needsTriage);
	assert.equal(currentTriageLabel(issue(['bug'])), null);
});

test('labelForResult maps outcomes', () => {
	assert.equal(
		labelForResult({ skipped: true, skippedReason: 'not-actionable' }),
		LABELS.notActionable
	);
	assert.equal(
		labelForResult({ skipped: true, skippedReason: 'missing-details' }),
		LABELS.needsReproduction
	);
	assert.equal(labelForResult({ skipped: true, skippedReason: 'host-specific' }), LABELS.skipped);
	assert.equal(labelForResult({ skipped: false, reproducible: false }), LABELS.unableToReproduce);
	assert.equal(
		labelForResult({
			skipped: false,
			reproducible: true,
			verdict: 'intended-behavior',
			fixed: false,
		}),
		LABELS.notActionable
	);
	assert.equal(
		labelForResult(
			{ skipped: false, reproducible: true, verdict: 'bug', fixed: true },
			{ prOpened: true }
		),
		LABELS.fixVerified
	);
	assert.equal(
		labelForResult(
			{ skipped: false, reproducible: true, verdict: 'bug', fixed: true },
			{ prOpened: false }
		),
		LABELS.unableToFix
	);
	assert.equal(
		labelForResult({ skipped: false, reproducible: true, verdict: 'bug', fixed: false }),
		LABELS.unableToFix
	);
});
