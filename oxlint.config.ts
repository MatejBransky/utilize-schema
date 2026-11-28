import { builtinModules } from 'node:module';

import cloudflare from '@cloudflare/oxlint-config';
import { defineConfig } from 'oxlint';
import type { DummyRule } from 'oxlint';

// Bare built-in names (`fs`, `fs/promises`, ...). The `node:` form is matched
// by a pattern below, which also covers the prefix-only modules such as
// `node:sqlite`.
const bareBuiltins = builtinModules.filter((name) => !name.startsWith('node:'));

// The three code generators are peers. Each one knows the core and nothing
// else, so a consumer can pick any target without pulling in another.
const generatorPeers = ['zod', 'effect', 'typescript'] as const;

const browserSafeGeneratorImports = (own: (typeof generatorPeers)[number]): DummyRule => [
	'error',
	{
		paths: bareBuiltins.map((name) => ({
			name,
			message:
				'Generator source runs in the browser; Node built-ins belong in compile.ts or cli.ts.',
		})),
		patterns: [
			{
				regex: '^node:',
				message:
					'Generator source runs in the browser; Node built-ins belong in compile.ts or cli.ts.',
			},
			...generatorPeers
				.filter((peer) => peer !== own)
				.map((peer) => ({
					regex: `^@utilize/${peer}(/|$)`,
					message: `Generators are peers, not dependencies: @utilize/${own} may import only @utilize/json-schema.`,
				})),
		],
	},
];

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
			// The format validators port the RFC grammars literally. Their character
			// classes deliberately contain control characters (ASCII range checks)
			// and IDNA joiners/combining marks, which is exactly what they must match.
			files: ['packages/json-schema/src/formats.ts'],
			rules: {
				'eslint/no-control-regex': 'off',
				'eslint/no-misleading-character-class': 'off',
			},
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
		// Generator source is bundled into the browser playground. The
		// `utilize-policy` rule pack bans static imports of Node built-ins and
		// every `require()` there, but fallow's `banned-import` does not read
		// dynamic `import()`, so this rule covers that case for the same files.
		//
		// The same rule carries the peer invariant for the three generators:
		// each may import only `@utilize/json-schema`. Fallow's `boundaries`
		// owns that for static imports in `src/` and fails CI on a violation;
		// this half gives an editor and `pnpm check:lint` the same answer
		// without a fallow run. Tests are deliberately outside it: the parity
		// suite compares the zod and effect outputs on purpose.
		//
		// Overrides apply in order, so the `compile.ts`/`cli.ts` entry below must
		// stay after these to turn the rule back off for the Node-only entries.
		...generatorPeers.map((packageName) => ({
			files: [`packages/${packageName}/src/**/*.ts`],
			rules: { 'no-restricted-imports': browserSafeGeneratorImports(packageName) },
		})),
		{
			// The CLI and the Node compile entry are never bundled for the browser.
			files: ['packages/*/src/compile.ts', 'packages/*/src/cli.ts'],
			rules: { 'no-restricted-imports': 'off' },
		},
		{
			// monaco-editor only exposes its API through a namespace.
			files: ['playground/src/monaco/options.ts', 'playground/src/monaco/setup.ts'],
			rules: { 'import/no-namespace': 'off' },
		},
		{
			// Tests build deliberately malformed schemas to exercise the parser, so
			// their fixtures narrow literals the production code never sees.
			files: ['**/*.{test,spec}.{ts,tsx}', '**/test/**'],
			rules: { 'quality/no-chained-type-assertions': 'off' },
		},
		{
			// The core traverses unparsed JSON, so `Record<string, unknown>` is the
			// honest boundary type there; the playground bundler rewrites the same
			// values before they reach the parser, and tests build fixtures.
			files: [
				'packages/json-schema/src/dialect.ts',
				'packages/json-schema/src/externalSchemas.ts',
				'packages/json-schema/src/identifiers.ts',
				'packages/json-schema/src/narrow.ts',
				'packages/json-schema/src/normalize.ts',
				'packages/json-schema/src/parser.ts',
				'packages/json-schema/src/utils.ts',
				'packages/test-utils/src/suite/evaluate.ts',
				'packages/effect/src/generator.ts',
				'packages/effect/src/mergeObjects.ts',
				'packages/effect/src/mergePlan.ts',
				'packages/effect/src/constraints.ts',
				'packages/zod/src/inlineCopies.ts',
				'playground/src/bundle.ts',
				'**/*.{test,spec}.{ts,tsx}',
				'**/test/**',
				'**/bench/**',
			],
			rules: { 'quality/no-unsafe-dictionary-type': 'off' },
		},
	],
	rules: {
		// Project-specific tuning carried over from the previous configuration.
		'@typescript-eslint/array-type': ['error', { default: 'array' }],
		'import/no-unassigned-import': [
			'error',
			{ allow: ['**/*.css', '**/polyfills', '**/monaco/setup', '@utilize/test-utils/setup'] },
		],
		'no-underscore-dangle': ['warn', { allow: ['__UI_SDK_STRICT__'] }],
		'typescript/no-unsafe-type-assertion': 'error',
		'unicorn/no-thenable': 'off',
	},
});
