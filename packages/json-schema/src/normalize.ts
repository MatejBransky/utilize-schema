import { isPlainObject } from './utils';

export type SchemaVersion = 'draft-04' | 'draft-06' | 'draft-07' | '2019-09' | '2020-12';

export class UnsupportedSchemaFeatureError extends Error {
	constructor(keyword: string) {
		super(
			`"${keyword}" is not supported. The parser understands draft-04, draft-06, draft-07, 2019-09 and 2020-12 schemas, but this keyword has no generator yet.`
		);
		this.name = 'UnsupportedSchemaFeatureError';
	}
}

/**
 * Reads `$schema` and maps it to a known draft. Unknown or absent values fall
 * back to the provided version, so custom meta-schemas keep working.
 */
export function detectSchemaVersion(
	schema: unknown,
	fallback: SchemaVersion = 'draft-07'
): SchemaVersion {
	if (!isPlainObject(schema) || typeof schema.$schema !== 'string') {
		return fallback;
	}

	const uri = schema.$schema;

	if (/draft-04/.test(uri)) return 'draft-04';
	if (/draft-06/.test(uri)) return 'draft-06';
	if (/draft-07/.test(uri)) return 'draft-07';
	if (/2019-09/.test(uri)) return '2019-09';
	if (/2020-12/.test(uri)) return '2020-12';

	return fallback;
}

/**
 * Rewrites keywords that have a different shape in newer drafts into the
 * draft-07 form the generator understands. Mutates the schema in place.
 */
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
	'contains',
	'propertyNames',
	'if',
	'then',
	'else',
	'not',
]);
const ARRAY_SCHEMA_KEYWORDS = new Set(['allOf', 'anyOf', 'oneOf', 'prefixItems']);

export function normalizeSchema(schema: unknown, version: SchemaVersion) {
	const seen = new Set<unknown>();

	visitSchema(schema);

	function visitSchema(node: unknown) {
		if (typeof node !== 'object' || node === null || seen.has(node)) {
			return;
		}

		seen.add(node);

		if (!isPlainObject(node)) {
			return;
		}

		normalizeNode(node, version);

		for (const [key, value] of Object.entries(node)) {
			if (key === '$schema') {
				continue;
			}

			if (key === 'items') {
				if (Array.isArray(value)) {
					for (const item of value) visitSchema(item);
				} else {
					visitSchema(value);
				}
			} else if (MAP_KEYWORDS.has(key) && isPlainObject(value)) {
				for (const subschema of Object.values(value)) visitSchema(subschema);
			} else if (SINGLE_SCHEMA_KEYWORDS.has(key)) {
				visitSchema(value);
			} else if (ARRAY_SCHEMA_KEYWORDS.has(key) && Array.isArray(value)) {
				for (const subschema of value) visitSchema(subschema);
			} else if (key === 'dependencies' && isPlainObject(value)) {
				for (const dependency of Object.values(value)) {
					if (!Array.isArray(dependency)) visitSchema(dependency);
				}
			}
		}
	}
}

function normalizeNode(node: Record<string, unknown>, version: SchemaVersion): void {
	if (version === 'draft-04') {
		normalizeDraft04ExclusiveBounds(node);
	}

	if (version !== '2019-09' && version !== '2020-12') {
		return;
	}

	for (const keyword of [
		'unevaluatedProperties',
		'unevaluatedItems',
		'$recursiveRef',
		'$dynamicRef',
		'minContains',
		'maxContains',
	]) {
		if (node[keyword] !== undefined) {
			throw new UnsupportedSchemaFeatureError(keyword);
		}
	}

	if (version === '2020-12' && Array.isArray(node.prefixItems)) {
		const rest = node.items;
		node.items = node.prefixItems;
		if (rest !== undefined) {
			node.additionalItems = rest;
		}
		delete node.prefixItems;
	}

	const dependencies: Record<string, unknown> = isPlainObject(node.dependencies)
		? { ...node.dependencies }
		: {};

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
	delete node.dependentRequired;
	delete node.dependentSchemas;
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
