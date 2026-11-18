import {
	type Dialect,
	type DialectId,
	DialectError,
	type DialectIssue,
	type DialectOptions,
	type DialectSource,
	formatIssue,
	keywordIssue,
	resolveDialect,
	type ResolvedDialect,
} from './dialect';
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
}

const MAP_KEYWORDS = new Set([
	'properties',
	'patternProperties',
	'$defs',
	'definitions',
	'dependentSchemas',
]);
const SINGLE_SCHEMA_KEYWORDS = new Set([
	'additionalProperties',
	'additionalItems',
	'unevaluatedProperties',
	'unevaluatedItems',
	'contentSchema',
	'contains',
	'propertyNames',
	'if',
	'then',
	'else',
	'not',
]);
const ARRAY_SCHEMA_KEYWORDS = new Set(['allOf', 'anyOf', 'oneOf', 'prefixItems']);
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
	const root = resolveDialect(schema, options);

	visit(schema, root, [], true);

	return map;

	function visit(
		node: unknown,
		inherited: ResolvedDialect,
		path: Path,
		isDocumentRoot: boolean
	): void {
		if (typeof node === 'boolean') {
			if (inherited.dialect.id === 'draft-04') {
				report(
					{
						kind: 'invalid-keyword',
						message: `${inherited.dialect.label} does not allow boolean schemas.`,
						path,
					},
					inherited
				);
			}

			return;
		}

		if (typeof node !== 'object' || node === null) {
			return;
		}

		if (seen.has(node)) {
			return;
		}
		seen.add(node);

		if (Array.isArray(node)) {
			map.set(node, inherited);
			node.forEach((item, index) => visit(item, inherited, [...path, index], false));
			return;
		}

		if (!isPlainObject(node)) {
			return;
		}

		let resolved = inherited;

		if (!isDocumentRoot && isResourceRoot(node, inherited.dialect)) {
			// A bundled file keeps its `$schema` after being embedded under `$defs`,
			// so a declared `$schema` starts a dialect scope even without `$id`.
			const next = resolveDialect(node, {
				...options,
				fallbackDialect: inherited.dialect.id,
			});
			resolved = next.source === 'fallback' ? { ...next, source: 'inherited' } : next;
		}

		map.set(node, resolved);

		const issue = keywordIssue(node, resolved.dialect);
		const bestEffortUnevaluated =
			resolved.source === 'fallback' &&
			(issue?.keyword === 'unevaluatedProperties' || issue?.keyword === 'unevaluatedItems');

		if (issue && !bestEffortUnevaluated) {
			report({ ...issue, path }, resolved);
		}

		normalizeNode(node, resolved.dialect, resolved.source);

		for (const [key, value] of Object.entries(node)) {
			if (key === '$schema') {
				continue;
			}

			if (key === 'items') {
				if (Array.isArray(value)) {
					value.forEach((item, index) => visit(item, resolved, [...path, key, index], false));
				} else {
					visit(value, resolved, [...path, key], false);
				}
			} else if (MAP_KEYWORDS.has(key) && isPlainObject(value)) {
				for (const [name, subschema] of Object.entries(value)) {
					visit(subschema, resolved, [...path, key, name], false);
				}
			} else if (SINGLE_SCHEMA_KEYWORDS.has(key)) {
				// Every dialect accepts a boolean here, draft-04 included.
				if (typeof value === 'boolean' && BOOLEAN_FORM_KEYWORDS.has(key)) {
					continue;
				}

				visit(value, resolved, [...path, key], false);
			} else if (ARRAY_SCHEMA_KEYWORDS.has(key) && Array.isArray(value)) {
				value.forEach((item, index) => visit(item, resolved, [...path, key, index], false));
			} else if (key === 'dependencies' && isPlainObject(value)) {
				for (const [name, dependency] of Object.entries(value)) {
					if (!Array.isArray(dependency)) {
						visit(dependency, resolved, [...path, key, name], false);
					}
				}
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

	function emit(issue: DialectIssue): void {
		if (options.onDialectIssue) {
			options.onDialectIssue(issue);
		} else {
			console.warn(formatIssue(issue));
		}
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
	if (dialect.unevaluated || source === 'fallback') {
		if (node.unevaluatedProperties !== undefined) {
			if (node.additionalProperties === undefined) {
				node.additionalProperties = node.unevaluatedProperties;
			}
		}

		if (node.unevaluatedItems !== undefined) {
			if (node.items === undefined) {
				node.items = node.unevaluatedItems;
			} else if (Array.isArray(node.items) && node.additionalItems === undefined) {
				node.additionalItems = node.unevaluatedItems;
			}
		}
	}

	if (!dialect.unevaluated) {
		return;
	}

	// These keywords are valid in the dialect, but no generator supports them
	// yet. `keywordPolicy` only covers keywords from other dialects, so this
	// always fails instead of producing code that is looser than the schema.
	for (const keyword of ['$recursiveRef', '$dynamicRef', 'minContains', 'maxContains']) {
		if (node[keyword] !== undefined) {
			throw new UnsupportedSchemaFeatureError(keyword);
		}
	}

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
		dependencies[key] = [...new Set([...current, ...next])];
		return;
	}

	const currentSchema = Array.isArray(current) ? { required: current } : current;
	const nextSchema = Array.isArray(next) ? { required: next } : next;

	dependencies[key] = { allOf: [currentSchema, nextSchema] };
}
