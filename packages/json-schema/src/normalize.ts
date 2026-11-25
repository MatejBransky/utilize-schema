import { DialectError, dialects, keywordIssues, resolveDialect } from './dialect';
import type {
	Dialect,
	DialectId,
	DialectIssue,
	DialectOptions,
	DialectSource,
	ResolvedDialect,
} from './dialect';
import { SCHEMA_ARRAY_KEYWORDS, SCHEMA_MAP_KEYWORDS, SINGLE_SCHEMA_KEYWORDS } from './keywords';
import type { Path } from './model';
import { isPlainObject } from './utils';

export class UnsupportedSchemaFeatureError extends Error {
	constructor(keyword: string) {
		super(
			`"${keyword}" is not supported. The parser understands draft-04, draft-06, draft-07, 2019-09 and 2020-12 schemas, but this keyword has no generator yet.`
		);
		this.name = 'UnsupportedSchemaFeatureError';
	}
}

/** The dialect of every object node in a prepared schema. */
export type DialectMap = WeakMap<object, ResolvedDialect>;

export interface PrepareSchemaOptions extends DialectOptions {
	/** Included in diagnostics; file name or relative path. */
	filePath?: string;
	/**
	 * Dialect of the document that references this one. A schema without
	 * `$schema` inherits it instead of using `fallbackDialect`.
	 */
	inheritedDialect?: DialectId;
}

/** Keywords whose value may be a boolean even in draft-04. */
const BOOLEAN_FORM_KEYWORDS = new Set(['additionalProperties', 'additionalItems']);

/**
 * Resolves the dialect of every schema resource, reports keywords that do not
 * belong to it, and rewrites the keywords whose newer shape the generators
 * expect. Returns the dialect assigned to each node so `link` can copy it into
 * `Meta`.
 */
export function prepareSchema(schema: unknown, options: PrepareSchemaOptions = {}): DialectMap {
	const map: DialectMap = new WeakMap();
	const seen = new Set<unknown>();
	const policy = options.keywordPolicy ?? 'warn';
	const root = resolveDocumentDialect(schema, options);

	visit(schema, root, [], true);

	return map;

	function visit(
		node: unknown,
		inherited: ResolvedDialect,
		path: Path,
		isDocumentRoot: boolean
	): void {
		if (typeof node === 'boolean') {
			visitBoolean(inherited, path);
			return;
		}

		if (typeof node !== 'object' || node === null || seen.has(node)) {
			return;
		}

		seen.add(node);

		if (Array.isArray(node)) {
			visitArray(node, inherited, path);
			return;
		}

		if (isPlainObject(node)) {
			visitObject(node, inherited, path, isDocumentRoot);
		}
	}

	function visitBoolean(inherited: ResolvedDialect, path: Path): void {
		if (inherited.dialect.id === 'draft-04') {
			report(
				{
					kind: 'invalid-keyword',
					message: `${inherited.dialect.id} does not allow boolean schemas.`,
					path,
				},
				inherited
			);
		}
	}

	function visitArray(node: unknown[], inherited: ResolvedDialect, path: Path): void {
		map.set(node, inherited);
		node.forEach((item, index) => visit(item, inherited, [...path, index], false));
	}

	function visitObject(
		node: Record<string, unknown>,
		inherited: ResolvedDialect,
		path: Path,
		isDocumentRoot: boolean
	): void {
		const resolved = resolveNodeDialect(node, inherited, isDocumentRoot);

		map.set(node, resolved);
		reportNodeIssues(node, resolved, path);
		normalizeNode(node, resolved.dialect, resolved.source);
		visitChildren(node, resolved, path);
	}

	function resolveNodeDialect(
		node: Record<string, unknown>,
		inherited: ResolvedDialect,
		isDocumentRoot: boolean
	): ResolvedDialect {
		if (isDocumentRoot || !isResourceRoot(node, inherited.dialect)) {
			return inherited;
		}

		// A bundled file keeps its `$schema` after being embedded under `$defs`,
		// so a declared `$schema` starts a dialect scope even without `$id`.
		const next = resolveDialect(node, {
			...options,
			fallbackDialect: inherited.dialect.id,
		});

		return next.source === 'fallback' ? { ...next, source: 'inherited' } : next;
	}

	function reportNodeIssues(
		node: Record<string, unknown>,
		resolved: ResolvedDialect,
		path: Path
	): void {
		for (const issue of keywordIssues(node, resolved.dialect)) {
			// Without a declared dialect `unevaluated*` is mapped best effort
			// (see `normalizeNode`), so it is not reported.
			const bestEffortUnevaluated =
				resolved.source === 'fallback' &&
				(issue.keyword === 'unevaluatedProperties' || issue.keyword === 'unevaluatedItems');

			if (!bestEffortUnevaluated) {
				report({ ...issue, path }, resolved);
			}
		}
	}

	function visitChildren(
		node: Record<string, unknown>,
		resolved: ResolvedDialect,
		path: Path
	): void {
		for (const [key, value] of Object.entries(node)) {
			if (key !== '$schema') {
				visitKeyword(key, value, resolved, path);
			}
		}
	}

	function visitKeyword(key: string, value: unknown, resolved: ResolvedDialect, path: Path): void {
		if (key === 'items') {
			visitItems(value, resolved, [...path, key]);
			return;
		}

		if (SCHEMA_MAP_KEYWORDS.has(key) && isPlainObject(value)) {
			visitMapKeyword(key, value, resolved, path);
			return;
		}

		if (SINGLE_SCHEMA_KEYWORDS.has(key)) {
			visitSingleKeyword(key, value, resolved, path);
			return;
		}

		if (SCHEMA_ARRAY_KEYWORDS.has(key) && Array.isArray(value)) {
			visitArrayKeyword(key, value, resolved, path);
			return;
		}

		if (key === 'dependencies' && isPlainObject(value)) {
			visitDependencies(value, resolved, path);
		}
	}

	function visitItems(value: unknown, resolved: ResolvedDialect, path: Path): void {
		if (Array.isArray(value)) {
			value.forEach((item, index) => visit(item, resolved, [...path, index], false));
		} else {
			visit(value, resolved, path, false);
		}
	}

	function visitMapKeyword(
		key: string,
		value: Record<string, unknown>,
		resolved: ResolvedDialect,
		path: Path
	): void {
		for (const [name, subschema] of Object.entries(value)) {
			visit(subschema, resolved, [...path, key, name], false);
		}
	}

	function visitSingleKeyword(
		key: string,
		value: unknown,
		resolved: ResolvedDialect,
		path: Path
	): void {
		// Every dialect accepts a boolean here, draft-04 included.
		if (typeof value !== 'boolean' || !BOOLEAN_FORM_KEYWORDS.has(key)) {
			visit(value, resolved, [...path, key], false);
		}
	}

	function visitArrayKeyword(
		key: string,
		value: unknown[],
		resolved: ResolvedDialect,
		path: Path
	): void {
		value.forEach((item, index) => visit(item, resolved, [...path, key, index], false));
	}

	function visitDependencies(
		value: Record<string, unknown>,
		resolved: ResolvedDialect,
		path: Path
	): void {
		for (const [name, dependency] of Object.entries(value)) {
			if (!Array.isArray(dependency)) {
				visit(dependency, resolved, [...path, 'dependencies', name], false);
			}
		}
	}

	function report(
		issue: Omit<DialectIssue, 'dialect' | 'dialectSource' | 'filePath'>,
		resolved: ResolvedDialect
	): void {
		const full: DialectIssue = {
			...issue,
			dialect: resolved.dialect.id,
			dialectSource: resolved.source,
			filePath: options.filePath,
		};

		// `$ref` siblings are valid; the specification only says they are
		// ignored, so they are reported when warnings are requested.
		if (issue.kind === 'ignored-ref-siblings') {
			if (policy === 'warn') {
				emit(full);
			}

			return;
		}

		if (policy === 'error') {
			throw new DialectError(full);
		}

		if (policy === 'warn') {
			emit(full);
		}
	}

	// The library never writes to the console; callers decide how to show
	// issues (the CLIs print them, `parse` also returns them).
	function emit(issue: DialectIssue): void {
		options.onDialectIssue?.(issue);
	}
}

/**
 * Normalizes a schema for a single dialect. Newer parsers use `prepareSchema`,
 * which resolves the dialect per resource and reports issues.
 */
export function normalizeSchema(schema: unknown, dialect: DialectId | Dialect = 'draft-07'): void {
	prepareSchema(schema, {
		dialect: typeof dialect === 'string' ? dialect : dialect.id,
		keywordPolicy: 'ignore',
	});
}

function resolveDocumentDialect(schema: unknown, options: PrepareSchemaOptions): ResolvedDialect {
	const resolved = resolveDialect(schema, options);

	if (resolved.source === 'fallback' && options.inheritedDialect) {
		return { dialect: dialects[options.inheritedDialect], source: 'inherited' };
	}

	return resolved;
}

function isResourceRoot(node: Record<string, unknown>, dialect: Dialect): boolean {
	const id = dialect.id === 'draft-04' ? node.id : node.$id;

	return (
		(typeof id === 'string' && id.length > 0 && !id.startsWith('#')) ||
		typeof node.$schema === 'string'
	);
}

function normalizeNode(
	node: Record<string, unknown>,
	dialect: Dialect,
	source: DialectSource
): void {
	if (dialect.id === 'draft-04') {
		normalizeDraft04ExclusiveBounds(node);
	}

	normalizeUnevaluatedKeywords(node, dialect, source);

	if (dialect.unevaluated) {
		rejectUnsupportedReferences(node);
		normalizeDependentKeywords(node);
	}
}

function normalizeUnevaluatedKeywords(
	node: Record<string, unknown>,
	dialect: Dialect,
	source: DialectSource
): void {
	// These keywords have a single meaning and schemas often omit `$schema`, so
	// map them best effort for 2019-09+, and also for a schema without a declared
	// dialect. In a declared older dialect they are foreign and must be ignored.
	//
	// `additionalProperties` / `additionalItems` cover the common case, where the
	// schema does not rely on properties evaluated by applicators.
	//
	// The original keywords are kept so `$ref`s such as
	// `#/unevaluatedProperties` still resolve after normalization; generators
	// ignore them once the mapped keyword is present.
	if (!dialect.unevaluated && source !== 'fallback') {
		return;
	}

	if (node.unevaluatedProperties !== undefined && node.additionalProperties === undefined) {
		node.additionalProperties = node.unevaluatedProperties;
	}

	if (node.unevaluatedItems === undefined) {
		return;
	}

	if (node.items === undefined) {
		node.items = node.unevaluatedItems;
	} else if (Array.isArray(node.items) && node.additionalItems === undefined) {
		node.additionalItems = node.unevaluatedItems;
	}
}

function rejectUnsupportedReferences(node: Record<string, unknown>): void {
	// These keywords are valid in the dialect, but no generator supports them
	// yet. `keywordPolicy` only covers keywords from other dialects, so this
	// always fails instead of producing code that is looser than the schema.
	for (const keyword of ['$recursiveRef', '$dynamicRef']) {
		if (node[keyword] !== undefined) {
			throw new UnsupportedSchemaFeatureError(keyword);
		}
	}
}

function normalizeDependentKeywords(node: Record<string, unknown>): void {
	// In 2019-09 and newer `dependencies` was replaced by `dependentRequired`
	// and `dependentSchemas`. A leftover `dependencies` keyword was reported
	// above and must not be applied to generated code.
	delete node.dependencies;

	const dependencies: Record<string, unknown> = {};

	for (const [key, value] of Object.entries(
		isPlainObject(node.dependentRequired) ? node.dependentRequired : {}
	)) {
		mergeDependency(dependencies, key, value);
	}
	for (const [key, value] of Object.entries(
		isPlainObject(node.dependentSchemas) ? node.dependentSchemas : {}
	)) {
		mergeDependency(dependencies, key, value);
	}
	if (Object.keys(dependencies).length > 0) {
		node.dependencies = dependencies;
	}
}

function normalizeDraft04ExclusiveBounds(node: Record<string, unknown>) {
	for (const [exclusiveKey, boundKey] of [
		['exclusiveMinimum', 'minimum'],
		['exclusiveMaximum', 'maximum'],
	] as const) {
		const exclusive = node[exclusiveKey];
		const bound = node[boundKey];

		if (exclusive === true && typeof bound === 'number') {
			node[exclusiveKey] = bound;
		} else if (exclusive === false || exclusive === true) {
			delete node[exclusiveKey];
		}
	}
}

function mergeDependency(dependencies: Record<string, unknown>, key: string, next: unknown): void {
	const current = dependencies[key];

	if (current === undefined) {
		dependencies[key] = next;
		return;
	}

	if (Array.isArray(current) && Array.isArray(next)) {
		const merged = new Set<unknown>();

		for (const item of current) {
			merged.add(item);
		}

		for (const item of next) {
			merged.add(item);
		}

		dependencies[key] = [...merged];
		return;
	}

	const currentSchema = Array.isArray(current) ? { required: current } : current;
	const nextSchema = Array.isArray(next) ? { required: next } : next;

	dependencies[key] = { allOf: [currentSchema, nextSchema] };
}
