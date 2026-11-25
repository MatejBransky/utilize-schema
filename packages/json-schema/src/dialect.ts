import { ANNOTATION_KEYWORDS } from './keywords';
import { Meta } from './model';
import type { ParsedJSONSchemaObject, Path } from './model';
import { isPlainObject } from './utils';

export type DialectId = 'draft-04' | 'draft-06' | 'draft-07' | '2019-09' | '2020-12';

/** Where the dialect of a schema node comes from. */
export type DialectSource = 'declared' | 'inherited' | 'fallback' | 'forced';

export interface Dialect {
	readonly id: DialectId;
	/** Meta-schema URIs that select this dialect. */
	readonly uris: readonly string[];
	/** Keyword that holds standalone definitions. */
	readonly definitions: 'definitions' | '$defs';
	/** How a tuple is expressed. */
	readonly tuple: 'items' | 'prefixItems';
	/** draft-04 uses boolean flags, draft-06+ numeric bounds. */
	readonly exclusiveBounds: 'boolean' | 'numeric';
	/** Whether keywords next to `$ref` apply. */
	readonly refSiblings: 'ignore' | 'apply';
	/** `dependencies` in draft-07 and older, `dependent*` in 2019-09 and newer. */
	readonly dependencies: 'dependencies' | 'dependent';
	/** `minContains` / `maxContains`. */
	readonly containsCount: boolean;
	/** `unevaluatedProperties` / `unevaluatedItems`. */
	readonly unevaluated: boolean;
	/** Keywords the dialect defines. */
	readonly keywords: ReadonlySet<string>;
}

export interface DetectedDialect {
	dialect: Dialect;
	uri: string;
}

export interface ResolvedDialect {
	dialect: Dialect;
	source: DialectSource;
}

export type DialectIssueKind =
	| 'unknown-dialect'
	| 'unknown-keyword'
	| 'invalid-keyword'
	| 'ignored-ref-siblings';

export interface DialectIssue {
	kind: DialectIssueKind;
	message: string;
	dialect: DialectId;
	dialectSource: DialectSource;
	keyword?: string;
	filePath?: string;
	path: Path;
}

export class DialectError extends Error {
	readonly issue: DialectIssue;

	constructor(issue: DialectIssue) {
		super(`${issue.message}${formatLocation(issue)}`);
		this.name = 'DialectError';
		this.issue = issue;
	}
}

/**
 * What to do with keywords that do not belong to the node's dialect.
 *
 * `warn` (default) reports and then ignores the keyword: applying a keyword
 * from another dialect would generate code that is either stricter or looser
 * than the standard, but failing the whole build for it is too strict for most
 * schemas. `error` fails instead, `ignore` silently ignores it, which is what
 * the specification requires for unknown keywords.
 */
export type KeywordPolicy = 'error' | 'warn' | 'ignore';

export interface DialectOptions {
	/** Read `$schema` per resource, or force a single dialect. Default `auto`. */
	dialect?: DialectId | 'auto';
	/** Dialect used when a schema omits `$schema`. Default `draft-07`. */
	fallbackDialect?: DialectId;
	/** What to do with an unrecognized `$schema`. Default `fallback`. */
	unknownDialect?: 'fallback' | 'error';
	/** What to do with keywords outside the node's dialect. Default `warn`. */
	keywordPolicy?: KeywordPolicy;
	/**
	 * Receives diagnostics produced by `keywordPolicy: 'warn'`. The library does
	 * not print them; `parse` also returns them as `issues`.
	 */
	onDialectIssue?: (issue: DialectIssue) => void;
}

/** Copies only the dialect options, so callers can forward them as one value. */
export function pickDialectOptions(options: DialectOptions): DialectOptions {
	return {
		dialect: options.dialect,
		fallbackDialect: options.fallbackDialect,
		unknownDialect: options.unknownDialect,
		keywordPolicy: options.keywordPolicy,
		onDialectIssue: options.onDialectIssue,
	};
}

const BASE_KEYWORDS = [
	'$schema',
	'$ref',
	'title',
	'description',
	'default',
	'type',
	'enum',
	'multipleOf',
	'maximum',
	'exclusiveMaximum',
	'minimum',
	'exclusiveMinimum',
	'maxLength',
	'minLength',
	'pattern',
	'format',
	'items',
	'maxItems',
	'minItems',
	'uniqueItems',
	'maxProperties',
	'minProperties',
	'required',
	'properties',
	'patternProperties',
	'additionalProperties',
	'allOf',
	'anyOf',
	'oneOf',
	'not',
] as const;

const DRAFT_04_KEYWORDS = new Set<string>([
	...BASE_KEYWORDS,
	'id',
	'definitions',
	'dependencies',
	'additionalItems',
]);

const DRAFT_06_KEYWORDS = new Set<string>([
	...BASE_KEYWORDS,
	'$id',
	'definitions',
	'dependencies',
	'additionalItems',
	'const',
	'contains',
	'propertyNames',
	'examples',
]);

const DRAFT_07_KEYWORDS = new Set<string>([
	...DRAFT_06_KEYWORDS,
	'$comment',
	'if',
	'then',
	'else',
	'readOnly',
	'writeOnly',
	'contentEncoding',
	'contentMediaType',
]);

const DRAFT_2019_KEYWORDS = new Set<string>([
	...BASE_KEYWORDS,
	'$id',
	'$anchor',
	'$vocabulary',
	'$comment',
	'$defs',
	'const',
	'contains',
	'propertyNames',
	'examples',
	'if',
	'then',
	'else',
	'readOnly',
	'writeOnly',
	'deprecated',
	'contentEncoding',
	'contentMediaType',
	'contentSchema',
	'dependentRequired',
	'dependentSchemas',
	'unevaluatedProperties',
	'unevaluatedItems',
	'minContains',
	'maxContains',
	'additionalItems',
	'$recursiveRef',
	'$recursiveAnchor',
]);

const DRAFT_2020_KEYWORDS = new Set<string>([
	...BASE_KEYWORDS,
	'$id',
	'$anchor',
	'$vocabulary',
	'$comment',
	'$defs',
	'const',
	'contains',
	'propertyNames',
	'examples',
	'if',
	'then',
	'else',
	'readOnly',
	'writeOnly',
	'deprecated',
	'contentEncoding',
	'contentMediaType',
	'contentSchema',
	'dependentRequired',
	'dependentSchemas',
	'unevaluatedProperties',
	'unevaluatedItems',
	'minContains',
	'maxContains',
	'prefixItems',
	'$dynamicRef',
	'$dynamicAnchor',
]);

const keywordsThatNeed: {
	keyword: string;
	applies: (dialect: Dialect) => boolean;
}[] = [
	{ keyword: 'const', applies: (dialect) => dialect.keywords.has('const') },
	{ keyword: 'contains', applies: (dialect) => dialect.keywords.has('contains') },
	{ keyword: 'propertyNames', applies: (dialect) => dialect.keywords.has('propertyNames') },
	{ keyword: 'if', applies: (dialect) => dialect.keywords.has('if') },
	{ keyword: 'then', applies: (dialect) => dialect.keywords.has('then') },
	{ keyword: 'else', applies: (dialect) => dialect.keywords.has('else') },
	{ keyword: 'prefixItems', applies: (dialect) => dialect.tuple === 'prefixItems' },
	{ keyword: 'additionalItems', applies: (dialect) => dialect.tuple === 'items' },
	{ keyword: 'dependencies', applies: (dialect) => dialect.dependencies === 'dependencies' },
	{ keyword: 'dependentRequired', applies: (dialect) => dialect.dependencies === 'dependent' },
	{ keyword: 'dependentSchemas', applies: (dialect) => dialect.dependencies === 'dependent' },
	{ keyword: 'minContains', applies: (dialect) => dialect.containsCount },
	{ keyword: 'maxContains', applies: (dialect) => dialect.containsCount },
	{ keyword: 'unevaluatedProperties', applies: (dialect) => dialect.unevaluated },
	{ keyword: 'unevaluatedItems', applies: (dialect) => dialect.unevaluated },
	{ keyword: '$recursiveRef', applies: (dialect) => dialect.id === '2019-09' },
	{ keyword: '$recursiveAnchor', applies: (dialect) => dialect.id === '2019-09' },
	{ keyword: '$dynamicRef', applies: (dialect) => dialect.id === '2020-12' },
	{ keyword: '$dynamicAnchor', applies: (dialect) => dialect.id === '2020-12' },
];

/** Internal: the public API exposes dialects through `resolveDialect` and `dialectOf`. */
export const dialects: Readonly<Record<DialectId, Dialect>> = Object.freeze({
	'draft-04': {
		id: 'draft-04',
		uris: ['http://json-schema.org/draft-04/schema#', 'https://json-schema.org/draft-04/schema'],
		definitions: 'definitions',
		tuple: 'items',
		exclusiveBounds: 'boolean',
		refSiblings: 'ignore',
		dependencies: 'dependencies',
		containsCount: false,
		unevaluated: false,
		keywords: DRAFT_04_KEYWORDS,
	},
	'draft-06': {
		id: 'draft-06',
		uris: ['http://json-schema.org/draft-06/schema#', 'https://json-schema.org/draft-06/schema'],
		definitions: 'definitions',
		tuple: 'items',
		exclusiveBounds: 'numeric',
		refSiblings: 'ignore',
		dependencies: 'dependencies',
		containsCount: false,
		unevaluated: false,
		keywords: DRAFT_06_KEYWORDS,
	},
	'draft-07': {
		id: 'draft-07',
		uris: ['http://json-schema.org/draft-07/schema#', 'https://json-schema.org/draft-07/schema'],
		definitions: 'definitions',
		tuple: 'items',
		exclusiveBounds: 'numeric',
		refSiblings: 'ignore',
		dependencies: 'dependencies',
		containsCount: false,
		unevaluated: false,
		keywords: DRAFT_07_KEYWORDS,
	},
	'2019-09': {
		id: '2019-09',
		uris: [
			'https://json-schema.org/draft/2019-09/schema',
			'http://json-schema.org/draft/2019-09/schema',
		],
		definitions: '$defs',
		tuple: 'items',
		exclusiveBounds: 'numeric',
		refSiblings: 'apply',
		dependencies: 'dependent',
		containsCount: true,
		unevaluated: true,
		keywords: DRAFT_2019_KEYWORDS,
	},
	'2020-12': {
		id: '2020-12',
		uris: [
			'https://json-schema.org/draft/2020-12/schema',
			'http://json-schema.org/draft/2020-12/schema',
		],
		definitions: '$defs',
		tuple: 'prefixItems',
		exclusiveBounds: 'numeric',
		refSiblings: 'apply',
		dependencies: 'dependent',
		containsCount: true,
		unevaluated: true,
		keywords: DRAFT_2020_KEYWORDS,
	},
});

const PATTERNS: readonly (readonly [RegExp, DialectId])[] = [
	[/draft-04/, 'draft-04'],
	[/draft-06/, 'draft-06'],
	[/draft-07/, 'draft-07'],
	[/2019-09/, '2019-09'],
	[/2020-12/, '2020-12'],
];

/**
 * Reads `$schema` and maps it to a known dialect. Unknown or absent values
 * return `undefined` so the caller can apply its fallback policy.
 */
export function detectDialect(schema: unknown): DetectedDialect | undefined {
	if (!isPlainObject(schema) || typeof schema.$schema !== 'string') {
		return undefined;
	}

	const uri = schema.$schema;

	for (const [pattern, id] of PATTERNS) {
		if (pattern.test(uri)) {
			return { dialect: dialects[id], uri };
		}
	}

	return undefined;
}

/**
 * Resolves the dialect of a schema resource. `dialect` forces one, `$schema`
 * declares one, and anything else falls back to `fallbackDialect`.
 */
export function resolveDialect(schema: unknown, options: DialectOptions = {}): ResolvedDialect {
	if (options.dialect !== undefined && options.dialect !== 'auto') {
		return { dialect: dialects[options.dialect], source: 'forced' };
	}

	const detected = detectDialect(schema);

	if (detected) {
		return { dialect: detected.dialect, source: 'declared' };
	}

	const fallback = dialects[options.fallbackDialect ?? 'draft-07'];

	if (
		options.unknownDialect === 'error' &&
		isPlainObject(schema) &&
		typeof schema.$schema === 'string'
	) {
		throw new DialectError({
			kind: 'unknown-dialect',
			message: `Unknown dialect "${schema.$schema}".`,
			dialect: fallback.id,
			dialectSource: 'fallback',
			path: [],
		});
	}

	return { dialect: fallback, source: 'fallback' };
}

/** Returns the dialect stored on a linked node, or `fallback`. */
export function dialectOf(
	schema: ParsedJSONSchemaObject | unknown,
	fallback: Dialect = dialects['draft-07']
): Dialect {
	if (typeof schema === 'object' && schema !== null) {
		const meta = (schema as ParsedJSONSchemaObject)[Meta];

		if (meta?.dialect) {
			return dialects[meta.dialect] ?? fallback;
		}
	}

	return fallback;
}

export function isKeywordApplicable(dialect: Dialect, keyword: string): boolean {
	return dialect.keywords.has(keyword);
}

export type KeywordIssue = Pick<DialectIssue, 'kind' | 'keyword' | 'message'>;

/** Lists every keyword of a node that does not belong to the dialect. */
export function keywordIssues(schema: Record<string, unknown>, dialect: Dialect): KeywordIssue[] {
	const issues: KeywordIssue[] = [];

	for (const { keyword, applies } of keywordsThatNeed) {
		if (schema[keyword] !== undefined && !applies(dialect)) {
			issues.push({
				kind: 'unknown-keyword',
				keyword,
				message: `"${keyword}" is not part of ${dialect.id}.`,
			});
		}
	}

	collectTupleItemsIssue(schema, dialect, issues);
	collectExclusiveBoundIssues(schema, dialect, issues);
	collectRefSiblingIssue(schema, dialect, issues);

	return issues;
}

function collectTupleItemsIssue(
	schema: Record<string, unknown>,
	dialect: Dialect,
	issues: KeywordIssue[]
): void {
	if (Array.isArray(schema.items) && dialect.tuple === 'prefixItems') {
		issues.push({
			kind: 'invalid-keyword',
			keyword: 'items',
			message: `The tuple form of "items" was removed in ${dialect.id}; use "prefixItems".`,
		});
	}
}

function collectExclusiveBoundIssues(
	schema: Record<string, unknown>,
	dialect: Dialect,
	issues: KeywordIssue[]
): void {
	for (const keyword of ['exclusiveMinimum', 'exclusiveMaximum'] as const) {
		const value = schema[keyword];
		const expected = dialect.exclusiveBounds === 'numeric' ? 'number' : 'boolean';

		if (value !== undefined && typeof value !== expected) {
			issues.push({
				kind: 'invalid-keyword',
				keyword,
				message: `"${keyword}" must be a ${expected} in ${dialect.id}.`,
			});
		}
	}
}

function collectRefSiblingIssue(
	schema: Record<string, unknown>,
	dialect: Dialect,
	issues: KeywordIssue[]
): void {
	if (dialect.refSiblings === 'ignore' && typeof schema.$ref === 'string') {
		const siblings = Object.keys(schema).filter(
			(keyword) => keyword !== '$ref' && !ANNOTATION_KEYWORDS.has(keyword)
		);

		if (siblings.length > 0) {
			issues.push({
				kind: 'ignored-ref-siblings',
				keyword: siblings[0],
				message: `${dialect.id} ignores keywords next to "$ref": ${siblings
					.map((keyword) => `"${keyword}"`)
					.join(', ')}.`,
			});
		}
	}
}

/** Writes an issue to `console.warn`, for callers that want the default CLI-like output. */
export function warnDialectIssue(issue: DialectIssue): void {
	console.warn(formatIssue(issue));
}

export function formatIssue(issue: DialectIssue): string {
	return `${issue.message}${formatLocation(issue)}`;
}

function formatLocation(issue: Pick<DialectIssue, 'filePath' | 'path'>): string {
	const file = issue.filePath ?? '<schema>';
	const pointer = issue.path.length > 0 ? `/${issue.path.join('/')}` : '';

	return ` (${file}${pointer})`;
}
