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
		{
			// The playground bundles these modules for the browser, where only the
			// bare Node specifiers resolve to the browser shims.
			files: ['packages/json-schema/src/linker.ts', 'playground/src/polyfills.ts'],
			rules: { 'unicorn/prefer-node-protocol': 'off' },
		},
		{
			// These modules warn about unsupported schemas on the console; that is
			// their documented default sink for callers that do not pass a hook.
			files: ['packages/json-schema/src/dialect.ts', 'packages/zod/src/generators/refGenerator.ts'],
			rules: { 'no-console': 'off' },
		},
		{
			// monaco-editor only exposes its API through a namespace.
			files: ['playground/src/monaco/options.ts', 'playground/src/monaco/setup.ts'],
			rules: { 'import/no-namespace': 'off' },
		},
		{
			// The suite evaluates generated code in memory, so every call goes
			// through `new Function`.
			files: ['packages/test-utils/src/suite/evaluate.ts'],
			rules: { 'typescript/no-unsafe-call': 'off' },
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
