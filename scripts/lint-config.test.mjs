import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = fileURLToPath(new URL('..', import.meta.url));
const rule = 'typescript/no-unsafe-type-assertion';
const lintScript = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).scripts[
	'check:lint'
];
const areas = ['packages', 'playground', 'scripts'];
const ignoredDirectories = new Set(['coverage', 'dist', 'node_modules']);
const representativeFiles = [
	'packages/json-schema/src/parser.ts',
	'packages/json-schema/test/parser.test.ts',
	'packages/json-schema/bench/largeSchemas.ts',
	'packages/zod/src/valueTypes.ts',
	'packages/effect/src/valueTypes.ts',
	'packages/typescript/src/renderType.ts',
	'packages/test-utils/src/suite/evaluate.ts',
	'playground/src/App.test.tsx',
	'scripts/coverage-badge.mjs',
];

function resolvedConfig(file) {
	return JSON.parse(
		execFileSync('pnpm', ['exec', 'oxlint', '--print-config', file], {
			cwd: root,
			encoding: 'utf8',
		})
	);
}

function sourceFiles(directory) {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		if (entry.isDirectory()) {
			return ignoredDirectories.has(entry.name) ? [] : sourceFiles(join(directory, entry.name));
		}

		return /\.(?:mjs|ts|tsx)$/.test(entry.name) ? [join(directory, entry.name)] : [];
	});
}

function assertLintCoversEveryArea() {
	for (const area of areas) {
		assert.match(lintScript, new RegExp(`\\b${area}\\b`), `check:lint does not cover ${area}`);
	}
}

function assertRuleIsDeny(config, file) {
	assert.equal(config.rules[rule], 'deny', `${rule} is not enforced for ${file}`);

	for (const override of config.overrides ?? []) {
		const severity = override.rules?.[rule];

		assert.notEqual(severity, 'off', `${rule} is disabled for ${override.files?.join(', ')}`);
		assert.notEqual(severity, 'allow', `${rule} is allowed for ${override.files?.join(', ')}`);
		assert.notEqual(severity, 'warn', `${rule} is downgraded for ${override.files?.join(', ')}`);
	}
}

function assertNoInlineDisables() {
	for (const directory of areas) {
		for (const file of sourceFiles(join(root, directory))) {
			const source = readFileSync(file, 'utf8');

			assert.doesNotMatch(
				source,
				/(?:eslint|oxlint)-disable[^\n]*no-unsafe-type-assertion/,
				`${file} disables ${rule} inline`
			);
		}
	}
}

void test('no-unsafe-type-assertion is enforced in every linted project area', () => {
	assertLintCoversEveryArea();

	for (const file of representativeFiles) {
		assertRuleIsDeny(resolvedConfig(file), file);
	}

	assertNoInlineDisables();
});
