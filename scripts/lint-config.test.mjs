import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = fileURLToPath(new URL('..', import.meta.url));
const rule = 'typescript/no-unsafe-type-assertion';

function resolvedConfig(file) {
	return JSON.parse(
		execFileSync('pnpm', ['exec', 'oxlint', '--print-config', file], {
			cwd: root,
			encoding: 'utf8',
		})
	);
}

void test('no-unsafe-type-assertion is enforced in every project area', () => {
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

	for (const file of representativeFiles) {
		const config = resolvedConfig(file);

		assert.equal(config.rules[rule], 'deny', `${rule} is not enforced for ${file}`);

		for (const override of config.overrides ?? []) {
			assert.notEqual(
				override.rules?.[rule],
				'off',
				`${rule} is disabled for ${override.files?.join(', ')}`
			);
			assert.notEqual(
				override.rules?.[rule],
				'allow',
				`${rule} is allowed for ${override.files?.join(', ')}`
			);
			assert.notEqual(
				override.rules?.[rule],
				'warn',
				`${rule} is downgraded for ${override.files?.join(', ')}`
			);
		}
	}
});
