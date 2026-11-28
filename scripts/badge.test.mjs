import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { pickColor, renderBadge } from './badge.mjs';
import { badgePathFor, describeBadge, findOrphanBadges, isBadgeStale } from './suite-badge.mjs';

void test('pickColor uses inclusive thresholds', () => {
	assert.equal(pickColor(100), '#4c1');
	assert.equal(pickColor(95), '#4c1');
	assert.equal(pickColor(94), '#97ca00');
	assert.equal(pickColor(90), '#97ca00');
	assert.equal(pickColor(89), '#a4a61d');
	assert.equal(pickColor(75), '#a4a61d');
	assert.equal(pickColor(74), '#dfb317');
	assert.equal(pickColor(60), '#dfb317');
	assert.equal(pickColor(59), '#fe7d37');
	assert.equal(pickColor(40), '#fe7d37');
	assert.equal(pickColor(39), '#e05d44');
	assert.equal(pickColor(0), '#e05d44');
});

void test('renderBadge uses its default description and measured geometry', () => {
	const badge = renderBadge({ label: 'draft-07', message: '93% passed', color: '#4c1' });

	assert.match(badge, /width="142"/);
	assert.match(badge, /aria-label="draft-07: 93% passed"/);
	assert.match(badge, /<title>draft-07: 93% passed<\/title>/);
	assert.match(badge, /<rect x="62" width="80" height="20" fill="#4c1"\/>/);
});

void test('renderBadge accepts a custom accessible description', () => {
	const badge = renderBadge({
		label: 'draft-07',
		message: '93% passed',
		color: '#4c1',
		description: 'Zod draft-07: 283 of 304 cases',
	});

	assert.match(badge, /aria-label="Zod draft-07: 283 of 304 cases"/);
	assert.match(badge, /<title>Zod draft-07: 283 of 304 cases<\/title>/);
});

void test('describeBadge floors the percentage and includes the measured counts', () => {
	const { percent, badge } = describeBadge('draft-07', { passing: 283, cases: 304 });

	assert.equal(percent, 93);
	assert.match(badge, /aria-label="draft-07: 283\/304 cases \(93%\)"/);
	assert.match(badge, />93% passed</);
});

void test('badgePathFor names badges by package and dialect', () => {
	assert.match(badgePathFor('zod', 'draft-04'), /suite-zod-draft-04\.svg$/);
});

void test('isBadgeStale detects missing, matching and changed badges', () => {
	const directory = mkdtempSync(join(tmpdir(), 'utilize-badge-'));
	const path = join(directory, 'badge.svg');

	try {
		assert.equal(isBadgeStale(path, '<svg />'), true);

		writeFileSync(path, '<svg />');
		assert.equal(isBadgeStale(path, '<svg />'), false);

		writeFileSync(path, '<svg>stale</svg>');
		assert.equal(isBadgeStale(path, '<svg />'), true);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

void test('findOrphanBadges reports committed conformance badges without a baseline', () => {
	const directory = mkdtempSync(join(tmpdir(), 'utilize-badge-'));
	const expected = join(directory, 'suite-zod-draft-07.svg');

	try {
		writeFileSync(expected, '<svg />');
		writeFileSync(join(directory, 'suite-zod-draft-03.svg'), '<svg />');
		writeFileSync(join(directory, 'coverage-zod.svg'), '<svg />');

		assert.deepEqual(findOrphanBadges(directory, new Set([expected])), [
			join(directory, 'suite-zod-draft-03.svg'),
		]);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});
