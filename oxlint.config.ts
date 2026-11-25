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
				'packages/effect/src/constraints.ts',
				'packages/zod/src/inlineCopies.ts',
				'playground/src/bundle.ts',
				'**/*.{test,spec}.{ts,tsx}',
				'**/test/**',
				'**/bench/**',
			],
			rules: { 'quality/no-unsafe-dictionary-type': 'off' },
		},
		{
			// Tests and benchmarks build deliberately malformed inputs.
			files: ['**/*.{test,spec}.{ts,tsx}', '**/test/**', '**/bench/**'],
			rules: { 'typescript/no-unsafe-type-assertion': 'off' },
		},
		{
			// The parser and linker are where untrusted JSON becomes the parsed
			// model; their narrowing is the parse step.
			files: ['packages/json-schema/src/parser.ts', 'packages/json-schema/src/linker.ts'],
			rules: { 'typescript/no-unsafe-type-assertion': 'off' },
		},
		{
			// These core helpers narrow JSON and CLI values after runtime checks;
			// the parser and linker own document validation.
			files: [
				'packages/json-schema/src/cliOptions.ts',
				'packages/json-schema/src/collectStandaloneSchemas.ts',
				'packages/json-schema/src/dialect.ts',
				'packages/json-schema/src/externalSchemas.ts',
				'packages/json-schema/src/identifiers.ts',
				'packages/json-schema/src/model.ts',
				'packages/json-schema/src/narrow.ts',
				'packages/json-schema/src/node/cli.ts',
				'packages/json-schema/src/node/compile.ts',
				'packages/json-schema/src/resolveName.ts',
				'packages/json-schema/src/utils.ts',
			],
			rules: { 'typescript/no-unsafe-type-assertion': 'off' },
		},
		{
			// The generators bridge dialect-specific `JSONSchema` keyword fields,
			// already validated by the linker, into the parsed model.
			files: [
				'packages/zod/src/findCyclicSchemas.ts',
				'packages/zod/src/generator.ts',
				'packages/zod/src/generators/createGenerator.ts',
				'packages/zod/src/generators/generateSchema.ts',
				'packages/zod/src/generators/schemaParts.ts',
				'packages/zod/src/inlineCopies.ts',
				'packages/zod/src/inferTypes.ts',
				'packages/zod/src/refinements.ts',
				'packages/zod/src/valueTypes.ts',
				'packages/effect/src/findCyclicSchemas.ts',
				'packages/effect/src/generator.ts',
				'packages/effect/src/mergeObjects.ts',
				'packages/effect/src/refSiblings.ts',
				'packages/effect/src/schemaParts.ts',
				'packages/effect/src/valueTypes.ts',
				'packages/typescript/src/collectStandaloneSchemas.ts',
				'packages/typescript/src/cycles.ts',
				'packages/typescript/src/generator.ts',
				'packages/typescript/src/renderType.ts',
			],
			rules: { 'typescript/no-unsafe-type-assertion': 'off' },
		},
		{
			// The test helper evaluates generated code, and the bundler rewrites
			// unparsed JSON before it reaches the parser.
			files: [
				'packages/test-utils/src/suite/compatibility.ts',
				'packages/test-utils/src/suite/evaluate.ts',
				'packages/test-utils/src/suite/loadSuite.ts',
				'playground/src/bundle.ts',
			],
			rules: { 'typescript/no-unsafe-type-assertion': 'off' },
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
	},
});
