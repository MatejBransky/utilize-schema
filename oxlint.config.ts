import cloudflare from '@cloudflare/oxlint-config';
import { defineConfig } from 'oxlint';

export default defineConfig({
	extends: [cloudflare],
	env: cloudflare.env,
	ignorePatterns: [
		...cloudflare.ignorePatterns,
		'**/dist/**',
		'.agents/**',
		'packages/zod/test/snapshots/**',
	],
	overrides: [
		{
			files: ['**/*.{test,spec}.{ts,tsx}', '**/bench/**', '**/scripts/**'],
			rules: { 'no-console': 'off' },
		},
		{
			// The playground syncs derived UI state from effects; deriving it during
			// render instead is a separate refactor.
			files: ['playground/src/**/*.{ts,tsx}'],
			rules: { 'react/set-state-in-effect': 'off' },
		},
	],
	rules: {
		// Project-specific tuning carried over from the previous configuration.
		'@typescript-eslint/array-type': ['error', { default: 'array' }],
		'no-underscore-dangle': ['warn', { allow: ['__UI_SDK_STRICT__'] }],
		'unicorn/consistent-function-scoping': 'off',
		'unicorn/no-array-reverse': 'off',
		'unicorn/no-thenable': 'off',
		'import/no-unassigned-import': 'off',

		// `instanceof` is idiomatic for DOM nodes and for the constructor-identity
		// check in `isPlainObject`; the rule rejects both.
		'@nkzw/no-instanceof': 'off',

		// The rules below were newly enabled by the preset and still have findings.
		// Burn them down one rule at a time, then delete the corresponding line.
		'quality/no-array-filter-map': 'off',
		'quality/no-chained-type-assertions': 'off',
		'quality/no-conditional-empty-object-spread': 'off',
		'quality/no-known-value-widening': 'off',
		'quality/no-object-parameters': 'off',
		'quality/no-unknown-returns': 'off',
		'quality/no-unsafe-dictionary-type': 'off',
		'typescript/await-thenable': 'off',
		'typescript/no-non-null-assertion': 'off',
		'typescript/no-unsafe-assignment': 'off',
		'typescript/no-unsafe-type-assertion': 'off',
	},
});
