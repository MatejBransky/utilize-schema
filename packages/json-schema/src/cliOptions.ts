import { dialects } from './dialect';
import type { DialectId, DialectOptions, KeywordPolicy } from './dialect';

/**
 * `node:util` `parseArgs` definitions of the dialect flags that every
 * generator CLI accepts.
 */
export const dialectCliOptions = {
	dialect: { type: 'string' },
	'fallback-dialect': { type: 'string' },
	'unknown-dialect': { type: 'string' },
	'keyword-policy': { type: 'string' },
} as const;

/** Help lines for `dialectCliOptions`, aligned with the other CLI options. */
export const dialectCliHelp = `  --dialect <id>        force a dialect (draft-04, draft-06, draft-07, 2019-09, 2020-12)
  --fallback-dialect    dialect for schemas without $schema (default: draft-07)
  --unknown-dialect     fallback (default) or error for an unrecognized $schema
  --keyword-policy      warn (default), error or ignore foreign keywords`;

export type DialectCliValues = Partial<Record<keyof typeof dialectCliOptions, string>>;

export type DialectCliResult = { ok: true; options: DialectOptions } | { ok: false; error: string };

const KEYWORD_POLICIES: ReadonlySet<string> = new Set<KeywordPolicy>(['error', 'warn', 'ignore']);
const UNKNOWN_DIALECT_MODES: ReadonlySet<string> = new Set(['fallback', 'error']);

/** Validates the dialect flags parsed with `dialectCliOptions`. */
export function readDialectCliOptions(values: DialectCliValues): DialectCliResult {
	const {
		dialect,
		'fallback-dialect': fallbackDialect,
		'unknown-dialect': unknownDialect,
		'keyword-policy': keywordPolicy,
	} = values;

	if (dialect !== undefined && dialect !== 'auto' && !isDialectId(dialect)) {
		return { ok: false, error: `Unknown dialect "${dialect}"` };
	}

	if (fallbackDialect !== undefined && !isDialectId(fallbackDialect)) {
		return { ok: false, error: `Unknown fallback dialect "${fallbackDialect}"` };
	}

	if (unknownDialect !== undefined && !UNKNOWN_DIALECT_MODES.has(unknownDialect)) {
		return { ok: false, error: '--unknown-dialect must be "error" or "fallback"' };
	}

	if (keywordPolicy !== undefined && !KEYWORD_POLICIES.has(keywordPolicy)) {
		return { ok: false, error: '--keyword-policy must be "error", "warn" or "ignore"' };
	}

	return {
		ok: true,
		options: {
			dialect,
			fallbackDialect,
			unknownDialect: unknownDialect as DialectOptions['unknownDialect'],
			keywordPolicy: keywordPolicy as KeywordPolicy | undefined,
		},
	};
}

function isDialectId(value: string): value is DialectId {
	return Object.hasOwn(dialects, value);
}
