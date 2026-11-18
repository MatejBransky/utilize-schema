import {
	type Dialect,
	dialectOf,
	isKeywordApplicable,
	isPlainObject,
	Meta,
	type ParsedJSONSchema,
	type ParsedJSONSchemaObject,
	withSourceMeta,
} from '@utilize/json-schema';

import { collectStandaloneSchemas, type SchemaEdge } from './collectStandaloneSchemas';
import { UnresolvedReferenceError, UnsupportedEffectSchemaFeatureError } from './errors';
import { findCyclicSchemas } from './findCyclicSchemas';
import { referenceConstraints } from './refSiblings';
import {
	allocateName,
	mapDeclarationNames,
	resolveName,
	type CustomNameResolver,
	type DeclarationNames,
	type NameMapper,
} from './resolveName';
import { renderValueTypeDeclaration, type ValueTypeContext } from './valueTypes';

export interface GenerateOptions {
	/** Emit `import { Schema } from 'effect';` at the top of the generated code. */
	importEffect?: boolean;
	/** Overrides the name allocated for a standalone schema. */
	customNameResolver?: CustomNameResolver;
	/** Rewrites the variable that holds each generated schema. Receives the resolved name. */
	schemaName?: NameMapper;
	/** Rewrites the type exported for each generated schema. Receives the resolved name. */
	typeName?: NameMapper;
}

type Context = {
	/** Name of an already declared standalone schema. */
	nameOf(schema: ParsedJSONSchemaObject, ref: string): string;
	/** Dialect of the document root, used for synthetic nodes without `Meta`. */
	dialect: Dialect;
};

/** Keywords that have no Effect Schema equivalent and are rejected instead of ignored. */
const UNSUPPORTED_KEYWORDS = ['patternProperties', 'minContains', 'maxContains'] as const;

/**
 * Keywords applied as filters on top of a generated schema. `dependentRequired`
 * and `dependentSchemas` are merged into `dependencies` by the normalizer.
 */
const FILTER_KEYWORDS = new Set(['not', 'if', 'then', 'else']);

/** Keywords that only carry metadata, so they can be attached to any schema. */
const ANNOTATION_KEYWORDS = new Set([
	'title',
	'description',
	'default',
	'examples',
	'$id',
	'$schema',
	'$comment',
	'$anchor',
	'$vocabulary',
	'$defs',
	'definitions',
	'format',
	'readOnly',
	'writeOnly',
	'discriminator',
	'deprecated',
	'contentEncoding',
	'contentMediaType',
	'contentSchema',
]);

/** Names the generated code uses besides the declarations. */
const RESERVED_NAMES = ['Schema'];

/** Name of a root schema that is not an object, so it has nothing to resolve a name from. */
const FALLBACK_ROOT_NAME = 'Root';

const JSON_VALUE_TYPES = ['string', 'number', 'object', 'array'] as const;
type JSONValueType = (typeof JSON_VALUE_TYPES)[number];

/**
 * Generates Effect Schema (v4) code from a linked JSON Schema.
 *
 * The output mirrors the Zod generator: one exported const and one exported
 * type per standalone schema. Every `$ref` is emitted as `Schema.suspend`, so
 * recursive and mutually recursive schemas work without a topological sort.
 */
export function generate(root: ParsedJSONSchema, options: GenerateOptions = {}): string {
	const objectRoot = isPlainObject(root) ? (root as ParsedJSONSchemaObject) : undefined;
	const collected = objectRoot
		? collectStandaloneSchemas(objectRoot)
		: { schemas: [] as ParsedJSONSchemaObject[], edges: [] as SchemaEdge[] };
	const standalone = collected.schemas.filter((schema) => schema !== objectRoot);
	const cyclic = findCyclicSchemas(collected.edges, collected.schemas);
	const valueAliases = new Map<ParsedJSONSchemaObject, string>();

	const { rootNames, definitionNames, typeNames } = nameDeclarations(
		objectRoot,
		standalone,
		options
	);
	const valueTypeContext: ValueTypeContext = {
		dialect: dialectOf(root),
		aliasFor(schema) {
			return cyclic.has(schema) ? aliasOf(schema) : undefined;
		},
		typeNameFor(schema) {
			return namesOf(schema)!.type;
		},
	};

	const context: Context = {
		nameOf(schema, ref) {
			const names = namesOf(schema);

			if (names === undefined) {
				throw new UnresolvedReferenceError(ref);
			}

			return names.schema;
		},
		dialect: dialectOf(root),
	};

	const parts: string[] = [];

	if (options.importEffect ?? true) {
		parts.push("import { Schema } from 'effect';");
	}

	for (const schema of standalone) {
		parts.push(renderDeclaration(definitionNames.get(schema)!, schema));
	}

	parts.push(renderDeclaration(rootNames, root));

	return `${parts.join('\n\n')}\n`;

	function renderDeclaration(names: DeclarationNames, schema: ParsedJSONSchema): string {
		const alias = isPlainObject(schema)
			? valueTypeContext.aliasFor(schema as ParsedJSONSchemaObject)
			: undefined;
		const expression = generateSchema(schema, context);
		const declaration =
			alias === undefined
				? `export const ${names.schema} = ${expression};`
				: `export const ${names.schema}: Schema.Codec<${alias}> = ${expression};`;
		const lines =
			alias === undefined
				? []
				: [renderValueTypeDeclaration(alias, schema as ParsedJSONSchemaObject, valueTypeContext)];

		return [...lines, declaration, `export type ${names.type} = typeof ${names.schema}.Type;`].join(
			'\n\n'
		);
	}

	function namesOf(schema: ParsedJSONSchemaObject): DeclarationNames | undefined {
		return schema === objectRoot ? rootNames : definitionNames.get(schema);
	}

	function aliasOf(schema: ParsedJSONSchemaObject): string {
		const existing = valueAliases.get(schema);

		if (existing !== undefined) {
			return existing;
		}

		const alias = allocateName(`${namesOf(schema)!.schema}Value`, typeNames);

		valueAliases.set(schema, alias);
		return alias;
	}
}

/**
 * Names the root and every standalone schema in two passes: first the resolved
 * names, which stay unique among themselves, then the mapped names, which are
 * allocated only once every resolved name is known. A mapped name therefore
 * never depends on the order in which schemas are declared.
 */
function nameDeclarations(
	objectRoot: ParsedJSONSchemaObject | undefined,
	standalone: ParsedJSONSchemaObject[],
	options: GenerateOptions
) {
	const usedResolvedNames = new Set(RESERVED_NAMES);
	const resolve = (schema: ParsedJSONSchemaObject): string => {
		const resolvedName =
			schema[Meta]?.resolvedName ??
			resolveName({
				schema,
				usedNames: usedResolvedNames,
				customResolver: options.customNameResolver,
			});

		if (schema[Meta] !== undefined) {
			schema[Meta].resolvedName = resolvedName;
		}

		return resolvedName;
	};
	const rootName = objectRoot ? resolve(objectRoot) : FALLBACK_ROOT_NAME;
	const mapped = mapDeclarationNames([rootName, ...standalone.map(resolve)], {
		schemaName: options.schemaName,
		typeName: options.typeName,
		reservedNames: RESERVED_NAMES,
	});
	const [rootNames, ...standaloneNames] = mapped.names;

	return {
		rootNames: rootNames!,
		definitionNames: new Map(standalone.map((schema, index) => [schema, standaloneNames[index]!])),
		typeNames: mapped.typeNames,
	};
}

function generateSchema(schema: ParsedJSONSchema, context: Context): string {
	if (schema === undefined || schema === null || schema === true) {
		return 'Schema.Json';
	}

	if (schema === false) {
		return 'Schema.Never';
	}

	if (!isPlainObject(schema)) {
		return 'Schema.Json';
	}

	const dialect = dialectOf(schema, context.dialect);
	const nodeContext = dialect === context.dialect ? context : { ...context, dialect };

	assertSupportedKeywords(schema, dialect);

	const expression = applyChecks(
		generateExpression(schema, nodeContext),
		filterChecks(schema, nodeContext)
	);

	return applyAnnotations(expression, schema);
}

function generateExpression(schema: ParsedJSONSchemaObject, context: Context): string {
	const dialect = dialectOf(schema, context.dialect);

	if (typeof schema.$ref === 'string') {
		if (dialect.refSiblings === 'ignore') {
			return reference(schema, context);
		}

		if (constraintKeywords(schema).length === 0) {
			if (schema.not !== undefined || schema.if !== undefined) {
				throw new UnsupportedEffectSchemaFeatureError(
					'$ref siblings',
					'a reference cannot be combined with not/if/then/else'
				);
			}

			return reference(schema, context);
		}

		const target = dereference(schema);

		if (!isPlainObject(target)) {
			throw new UnsupportedEffectSchemaFeatureError(
				'$ref siblings',
				'a reference with sibling keywords must resolve to an object schema'
			);
		}

		const rest = referenceConstraints(schema);
		const branches = [
			target as ParsedJSONSchemaObject,
			...(Array.isArray(rest.allOf) ? rest.allOf : []),
			withSourceMeta(schema, { ...rest, allOf: undefined }) as unknown as ParsedJSONSchemaObject,
		];

		return generateIntersection(branches, context);
	}

	if (Object.hasOwn(schema, 'const') && isKeywordApplicable(dialect, 'const')) {
		return literal(schema.const);
	}

	if (Array.isArray(schema.enum)) {
		return literals(schema.enum);
	}

	if (Array.isArray(schema.allOf) && schema.allOf.length > 0) {
		return generateIntersection([parentSchema(schema), ...schema.allOf], context);
	}

	const alternatives = Array.isArray(schema.anyOf)
		? schema.anyOf
		: Array.isArray(schema.oneOf)
			? schema.oneOf
			: undefined;

	if (alternatives) {
		return generateUnion(alternatives, schema.oneOf !== undefined, context);
	}

	return generateType(schema, context);
}

function generateUnion(
	alternatives: ParsedJSONSchema[],
	exclusive: boolean,
	context: Context
): string {
	const members = [...new Set(alternatives.map((member) => generateSchema(member, context)))];

	if (members.length === 0) {
		return 'Schema.Never';
	}

	if (members.length === 1) {
		return members[0]!;
	}

	const options = exclusive ? ", { mode: 'oneOf' }" : '';

	return `Schema.Union([${members.join(', ')}]${options})`;
}

function generateType(schema: ParsedJSONSchemaObject, context: Context): string {
	if (Array.isArray(schema.type)) {
		const members = [
			...new Set(
				schema.type.map((type) =>
					generateType(schemaWithType(schema, type as ParsedJSONSchemaObject['type']), context)
				)
			),
		];

		if (members.length === 0) {
			return 'Schema.Never';
		}

		return members.length === 1 ? members[0]! : `Schema.Union([${members.join(', ')}])`;
	}

	switch (schema.type) {
		case 'string':
			return generateString(schema);
		case 'number':
			return generateNumber(schema, false);
		case 'integer':
			return generateNumber(schema, true);
		case 'boolean':
			return 'Schema.Boolean';
		case 'null':
			return 'Schema.Null';
		case 'array':
			return generateArray(schema, context);
		case 'object':
			return generateObject(schema, context);
		default:
			return generateUntyped(schema, context);
	}
}

/**
 * The declaring schema without the `allOf` that is being merged and without the
 * filter keywords, which are applied on top of the merged object.
 */
function parentSchema(schema: ParsedJSONSchemaObject): ParsedJSONSchemaObject {
	return {
		...schema,
		allOf: undefined,
		not: undefined,
		if: undefined,
		then: undefined,
		else: undefined,
	};
}

/** Drops metadata so that only the keyword applicability of each union member remains. */
function schemaWithType(
	schema: ParsedJSONSchemaObject,
	type: ParsedJSONSchemaObject['type']
): ParsedJSONSchemaObject {
	return {
		...schema,
		type,
		default: undefined,
		title: undefined,
		description: undefined,
		examples: undefined,
		$id: undefined,
	};
}

function generateString(schema: ParsedJSONSchemaObject): string {
	const checks: string[] = [];

	if (typeof schema.minLength === 'number') {
		checks.push(`Schema.isMinCodePoints(${schema.minLength})`);
	}
	if (typeof schema.maxLength === 'number') {
		checks.push(`Schema.isMaxCodePoints(${schema.maxLength})`);
	}
	if (typeof schema.pattern === 'string') {
		checks.push(`Schema.isPattern(${patternExpression(schema.pattern)})`);
	}

	return checks.length > 0 ? `Schema.String.check(${checks.join(', ')})` : 'Schema.String';
}

function patternExpression(pattern: string): string {
	try {
		RegExp(pattern, 'u');
	} catch {
		throw new UnsupportedEffectSchemaFeatureError(
			'pattern',
			`${JSON.stringify(pattern)} is not a valid ECMAScript regular expression in unicode mode`
		);
	}

	return `new RegExp(${JSON.stringify(pattern)}, 'u')`;
}

function generateNumber(schema: ParsedJSONSchemaObject, integer: boolean): string {
	const checks: string[] = [];

	if (typeof schema.minimum === 'number') {
		checks.push(`Schema.isGreaterThanOrEqualTo(${schema.minimum})`);
	}
	if (typeof schema.maximum === 'number') {
		checks.push(`Schema.isLessThanOrEqualTo(${schema.maximum})`);
	}
	if (typeof schema.exclusiveMinimum === 'number') {
		checks.push(`Schema.isGreaterThan(${schema.exclusiveMinimum})`);
	}
	if (typeof schema.exclusiveMaximum === 'number') {
		checks.push(`Schema.isLessThan(${schema.exclusiveMaximum})`);
	}
	if (typeof schema.multipleOf === 'number') {
		checks.push(`Schema.isMultipleOf(${schema.multipleOf})`);
	}

	const base = integer ? 'Schema.Int' : 'Schema.Finite';

	return checks.length > 0 ? `${base}.check(${checks.join(', ')})` : base;
}

function generateArray(schema: ParsedJSONSchemaObject, context: Context): string {
	const dialect = dialectOf(schema, context.dialect);
	const items = schema.items as unknown as ParsedJSONSchema | ParsedJSONSchema[] | undefined;
	const tupleItems = Array.isArray(items) ? items : undefined;
	const prefixItems =
		dialect.tuple === 'prefixItems'
			? Array.isArray(schema.prefixItems)
				? (schema.prefixItems as ParsedJSONSchema[])
				: undefined
			: tupleItems;
	const checks = arrayChecks(schema, context);
	const singleItem = Array.isArray(items) ? undefined : items;

	if (prefixItems === undefined) {
		const item =
			singleItem === undefined || singleItem === true
				? 'Schema.Json'
				: generateSchema(singleItem, context);

		return applyChecks(`Schema.Array(${item})`, checks);
	}

	const minItems = typeof schema.minItems === 'number' ? schema.minItems : 0;
	const elements = prefixItems.map((item, index) => {
		const expression = generateSchema(item, context);

		return index < minItems ? expression : `Schema.optionalKey(${expression})`;
	});
	const rest = arrayRest(schema, items, dialect);

	if (rest === false) {
		return applyChecks(`Schema.Tuple([${elements.join(', ')}])`, checks);
	}

	if (elements.length === 0) {
		return applyChecks(`Schema.Array(${generateSchema(rest, context)})`, checks);
	}

	return applyChecks(
		`Schema.TupleWithRest(Schema.Tuple([${elements.join(', ')}]), [${generateSchema(rest, context)}])`,
		checks
	);
}

function arrayRest(
	schema: ParsedJSONSchemaObject,
	items: ParsedJSONSchema | ParsedJSONSchema[] | undefined,
	dialect: Dialect
): ParsedJSONSchema | false {
	if (dialect.tuple === 'prefixItems') {
		if (items === false) {
			return false;
		}

		return Array.isArray(items) ? true : (items ?? true);
	}

	if (schema.additionalItems === false) {
		return false;
	}

	return (schema.additionalItems as unknown as ParsedJSONSchema | undefined) ?? true;
}

function arrayChecks(schema: ParsedJSONSchemaObject, context: Context): string[] {
	const checks: string[] = [];
	const dialect = dialectOf(schema, context.dialect);
	const prefixLength =
		dialect.tuple === 'prefixItems'
			? Array.isArray(schema.prefixItems)
				? schema.prefixItems.length
				: 0
			: Array.isArray(schema.items)
				? schema.items.length
				: 0;
	const minItems = typeof schema.minItems === 'number' ? schema.minItems : 0;

	if (minItems > prefixLength) {
		checks.push(`Schema.isMinLength(${minItems})`);
	}
	if (typeof schema.maxItems === 'number') {
		checks.push(`Schema.isMaxLength(${schema.maxItems})`);
	}
	if (schema.uniqueItems === true) {
		checks.push('Schema.isUnique()');
	}
	if (schema.contains !== undefined) {
		const contains = generateSchema(schema.contains, context);

		checks.push(
			`Schema.makeFilter((value) => value.some((item) => Schema.is(${contains})(item)) ? undefined : 'Array does not contain a matching item')`
		);
	}

	return checks;
}

function generateObject(schema: ParsedJSONSchemaObject, context: Context): string {
	const properties = isPlainObject(schema.properties) ? schema.properties : {};
	const required = new Set(
		Array.isArray(schema.required)
			? schema.required.filter((key): key is string => typeof key === 'string')
			: []
	);
	const keys = [...new Set([...Object.keys(properties), ...required])];
	const additional = schema.additionalProperties;
	const checks = objectChecks(schema, context);

	if (keys.length === 0) {
		const expression =
			additional === false
				? 'Schema.Record(Schema.String, Schema.Never)'
				: isPlainObject(additional)
					? `Schema.Record(Schema.String, ${generateSchema(additional, context)})`
					: 'Schema.Record(Schema.String, Schema.Json)';

		return applyChecks(expression, checks);
	}

	const fields = keys.map((key) => {
		const property = Object.hasOwn(properties, key) ? properties[key] : undefined;
		// A required key without a `properties` entry is still validated by
		// `additionalProperties`, and is unsatisfiable when that is `false`.
		const expression =
			property !== undefined
				? generateSchema(property, context)
				: additional === false
					? 'Schema.Never'
					: isPlainObject(additional)
						? generateSchema(additional, context)
						: 'Schema.Json';

		return `${JSON.stringify(key)}: ${
			required.has(key) ? expression : `Schema.optionalKey(${expression})`
		}`;
	});
	const additionalChecks = additionalChecksFor(keys, additional, context);

	return applyChecks(
		`Schema.StructWithRest(Schema.Struct({ ${fields.join(', ')} }), [Schema.Record(Schema.String, Schema.Json)])`,
		[...additionalChecks, ...checks]
	);
}

/**
 * `Schema.Struct` silently strips excess keys and `Schema.Record` validates
 * declared keys too, so excess keys are preserved and validated by a filter.
 */
function additionalChecksFor(
	keys: string[],
	additional: ParsedJSONSchemaObject['additionalProperties'],
	context: Context
): string[] {
	if (additional === undefined || additional === true) {
		return [];
	}

	const declared = JSON.stringify(keys);

	if (additional === false) {
		return [
			`Schema.makeFilter((value) => Object.keys(value).every((key) => ${declared}.includes(key)) ? undefined : 'Unexpected property')`,
		];
	}

	const additionalSchema = generateSchema(additional, context);

	return [
		`Schema.makeFilter((value) => Object.entries(value).every(([key, entry]) => ${declared}.includes(key) || Schema.is(${additionalSchema})(entry)) ? undefined : 'Property does not match the schema')`,
	];
}

function objectChecks(schema: ParsedJSONSchemaObject, context: Context): string[] {
	const checks: string[] = [];

	if (typeof schema.minProperties === 'number') {
		checks.push(`Schema.isMinProperties(${schema.minProperties})`);
	}
	if (typeof schema.maxProperties === 'number') {
		checks.push(`Schema.isMaxProperties(${schema.maxProperties})`);
	}
	if (
		schema.propertyNames !== undefined &&
		isKeywordApplicable(dialectOf(schema, context.dialect), 'propertyNames')
	) {
		checks.push(`Schema.isPropertyNames(${generateSchema(schema.propertyNames, context)})`);
	}

	const dependencies = dependencyChecks(schema, context);

	if (dependencies !== undefined) {
		checks.push(dependencies);
	}

	return checks;
}

function dependencyChecks(schema: ParsedJSONSchemaObject, context: Context): string | undefined {
	if (!isPlainObject(schema.dependencies)) {
		return undefined;
	}

	const conditions: string[] = [];

	for (const [key, dependency] of Object.entries(schema.dependencies)) {
		const present = `Object.hasOwn(value, ${JSON.stringify(key)})`;

		if (Array.isArray(dependency)) {
			const required = dependency.filter((item): item is string => typeof item === 'string');

			if (required.length > 0) {
				conditions.push(
					`(!${present} || ${JSON.stringify(required)}.every((key) => Object.hasOwn(value, key)))`
				);
			}
		} else if (dependency !== undefined && dependency !== null) {
			conditions.push(`(!${present} || Schema.is(${generateSchema(dependency, context)})(value))`);
		}
	}

	if (conditions.length === 0) {
		return undefined;
	}

	return `Schema.makeFilter((value) => ${conditions.join(' && ')} ? undefined : 'Object does not satisfy its dependencies')`;
}

/**
 * `not` and `if`/`then`/`else` have no schema constructor, so they are applied
 * as filters that evaluate the subschemas with `Schema.is`.
 */
function filterChecks(schema: ParsedJSONSchemaObject, context: Context): string[] {
	if (
		typeof schema.$ref === 'string' &&
		dialectOf(schema, context.dialect).refSiblings === 'ignore'
	) {
		return [];
	}

	const checks: string[] = [];

	if (schema.not !== undefined) {
		const not = generateSchema(schema.not, context);

		checks.push(
			`Schema.makeFilter((value) => Schema.is(${not})(value) ? 'Value must not match the "not" schema' : undefined)`
		);
	}

	if (schema.if !== undefined && isKeywordApplicable(context.dialect, 'if')) {
		const condition = generateSchema(parsed(schema.if), context);
		const thenBranch = branchCheck(schema.then, 'then', context);
		const elseBranch = branchCheck(schema.else, 'else', context);

		checks.push(
			`Schema.makeFilter((value) => Schema.is(${condition})(value) ? (${thenBranch}) : (${elseBranch}))`
		);
	}

	return checks;
}

function branchCheck(branch: unknown, keyword: 'then' | 'else', context: Context): string {
	if (branch === undefined) {
		return 'undefined';
	}

	return `Schema.is(${generateSchema(parsed(branch), context)})(value) ? undefined : 'Value does not match the "${keyword}" schema'`;
}

/** `JSONSchema7` types `if`/`then`/`else` without the linked schema metadata. */
function parsed(schema: unknown): ParsedJSONSchema {
	return schema as ParsedJSONSchema;
}

/**
 * Builds a static schema for a schema that has type-specific keywords but no
 * `type`. JSON Schema keywords only constrain the type they apply to, so the
 * result is a union over all JSON value types, with the matching ones refined.
 */
function generateUntyped(schema: ParsedJSONSchemaObject, context: Context): string {
	const dialect = dialectOf(schema, context.dialect);
	const constrained = JSON_VALUE_TYPES.filter((type) => appliesTo(schema, type, dialect));

	if (constrained.length === 0) {
		return 'Schema.Json';
	}

	const members = [
		'Schema.Null',
		'Schema.Boolean',
		constrained.includes('string') ? generateString(schema) : 'Schema.String',
		constrained.includes('number') ? generateNumber(schema, false) : 'Schema.Finite',
		constrained.includes('object') ? generateObject(schema, context) : 'Schema.JsonObject',
		constrained.includes('array') ? generateArray(schema, context) : 'Schema.Array(Schema.Json)',
	];

	return `Schema.Union([${[...new Set(members)].join(', ')}])`;
}

function appliesTo(schema: ParsedJSONSchemaObject, type: JSONValueType, dialect: Dialect): boolean {
	const record = schema as unknown as Record<string, unknown>;
	const anyKeyword = (keywords: string[]) =>
		keywords.some(
			(keyword) => record[keyword] !== undefined && isKeywordApplicable(dialect, keyword)
		);

	switch (type) {
		case 'string':
			return anyKeyword(['minLength', 'maxLength', 'pattern']);
		case 'number':
			return anyKeyword([
				'minimum',
				'maximum',
				'exclusiveMinimum',
				'exclusiveMaximum',
				'multipleOf',
			]);
		case 'object':
			return anyKeyword([
				'properties',
				'required',
				'additionalProperties',
				'minProperties',
				'maxProperties',
				'propertyNames',
			]);
		case 'array':
			return anyKeyword([
				'items',
				'prefixItems',
				'additionalItems',
				'minItems',
				'maxItems',
				'uniqueItems',
			]);
	}
}

/**
 * Merges object subschemas from `allOf` (or a `$ref` with `allOf` siblings).
 * Effect Schema has no generic intersection, so only disjoint object schemas
 * can be combined.
 */
function generateIntersection(schemas: ParsedJSONSchema[], context: Context): string {
	const properties: Record<string, ParsedJSONSchema> = {};
	const required = new Set<string>();
	let additionalProperties: ParsedJSONSchemaObject['additionalProperties'];
	let additionalDeclared = false;

	for (const raw of schemas) {
		const dereferenced = dereference(raw);

		if (dereferenced === false) {
			return 'Schema.Never';
		}

		if (!isPlainObject(dereferenced)) {
			throw new UnsupportedEffectSchemaFeatureError(
				'allOf',
				'only object subschemas can be merged'
			);
		}

		const resolved = dereferenced as ParsedJSONSchemaObject;

		assertIntersectable(resolved);

		for (const [key, property] of Object.entries(
			(resolved.properties ?? {}) as Record<string, ParsedJSONSchema>
		)) {
			if (Object.hasOwn(properties, key)) {
				throw new UnsupportedEffectSchemaFeatureError(
					'allOf',
					`property ${JSON.stringify(key)} is declared by more than one subschema`
				);
			}

			properties[key] = property;
		}

		for (const key of resolved.required ?? []) {
			if (typeof key === 'string') {
				required.add(key);
			}
		}

		const additional = resolved.additionalProperties;

		if (additional !== undefined && additional !== true) {
			if (additionalDeclared && additionalProperties !== additional) {
				throw new UnsupportedEffectSchemaFeatureError(
					'allOf',
					'every subschema would have to declare the same "additionalProperties"'
				);
			}

			additionalProperties = additional;
			additionalDeclared = true;
		}
	}

	const merged: Record<string, unknown> = {
		type: 'object',
		properties,
		required: [...required],
	};

	if (additionalDeclared) {
		merged.additionalProperties = additionalProperties;
	}

	return generateObject(merged as unknown as ParsedJSONSchemaObject, context);
}

function assertIntersectable(schema: ParsedJSONSchemaObject): void {
	if (schema.type !== undefined && schema.type !== 'object') {
		throw new UnsupportedEffectSchemaFeatureError('allOf', 'only object subschemas can be merged');
	}
	if (schema.$ref !== undefined) {
		throw new UnsupportedEffectSchemaFeatureError('allOf', 'nested references cannot be merged');
	}

	const allowed = new Set(['type', 'properties', 'required', 'additionalProperties']);
	const record = schema as unknown as Record<string, unknown>;

	for (const keyword of Object.keys(schema)) {
		if (record[keyword] === undefined) {
			continue;
		}
		if (ANNOTATION_KEYWORDS.has(keyword) || allowed.has(keyword)) {
			continue;
		}

		throw new UnsupportedEffectSchemaFeatureError(
			'allOf',
			`${JSON.stringify(keyword)} cannot be merged`
		);
	}
}

function reference(schema: ParsedJSONSchemaObject, context: Context): string {
	const ref = schema.$ref ?? '#';
	const resolved = schema[Meta]?.reference;

	if (resolved === undefined || resolved === null) {
		throw new UnresolvedReferenceError(ref);
	}

	if (typeof resolved === 'boolean') {
		return resolved ? 'Schema.Json' : 'Schema.Never';
	}

	return `Schema.suspend(() => ${context.nameOf(resolved, ref)})`;
}

function dereference(schema: ParsedJSONSchema): ParsedJSONSchema {
	if (!isPlainObject(schema) || typeof schema.$ref !== 'string') {
		return schema;
	}

	const resolved = (schema as ParsedJSONSchemaObject)[Meta]?.reference;

	if (resolved === undefined) {
		throw new UnresolvedReferenceError(schema.$ref);
	}

	return resolved;
}

function literal(value: unknown): string {
	if (value === null) {
		return 'Schema.Null';
	}
	if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
		return `Schema.Literal(${JSON.stringify(value)})`;
	}

	throw new UnsupportedEffectSchemaFeatureError(
		'const',
		'only primitive values are supported in const and enum'
	);
}

function literals(values: unknown[]): string {
	if (values.length === 0) {
		return 'Schema.Never';
	}
	if (values.length === 1) {
		return literal(values[0]);
	}

	return `Schema.Literals([${values.map((value) => literalValue(value)).join(', ')}])`;
}

function literalValue(value: unknown): string {
	if (value === null || typeof value === 'string' || typeof value === 'number') {
		return JSON.stringify(value);
	}
	if (typeof value === 'boolean') {
		return String(value);
	}

	throw new UnsupportedEffectSchemaFeatureError(
		'enum',
		'only primitive values are supported in const and enum'
	);
}

function assertSupportedKeywords(schema: ParsedJSONSchemaObject, dialect: Dialect): void {
	const record = schema as unknown as Record<string, unknown>;

	for (const keyword of UNSUPPORTED_KEYWORDS) {
		if (record[keyword] !== undefined && isKeywordApplicable(dialect, keyword)) {
			throw new UnsupportedEffectSchemaFeatureError(keyword);
		}
	}
}

/** Constraint keywords, i.e. everything that is not only metadata. */
function constraintKeywords(schema: ParsedJSONSchemaObject): string[] {
	return Object.keys(schema).filter(
		(keyword) =>
			keyword !== '$ref' && !ANNOTATION_KEYWORDS.has(keyword) && !FILTER_KEYWORDS.has(keyword)
	);
}

function applyChecks(expression: string, checks: string[]): string {
	return checks.length > 0 ? `${expression}.check(${checks.join(', ')})` : expression;
}

function applyAnnotations(expression: string, schema: ParsedJSONSchemaObject): string {
	const annotations: string[] = [];

	if (typeof schema.title === 'string') {
		annotations.push(`title: ${JSON.stringify(schema.title)}`);
	}
	if (typeof schema.description === 'string') {
		annotations.push(`description: ${JSON.stringify(schema.description)}`);
	}
	if (schema.default !== undefined) {
		annotations.push(`default: ${JSON.stringify(schema.default)}`);
	}
	if (Array.isArray(schema.examples)) {
		annotations.push(`examples: ${JSON.stringify(schema.examples)}`);
	}
	if (typeof schema.$id === 'string') {
		annotations.push(`identifier: ${JSON.stringify(schema.$id)}`);
	}
	if (typeof schema.format === 'string') {
		annotations.push(`format: ${JSON.stringify(schema.format)}`);
	}
	if (typeof schema.readOnly === 'boolean') {
		annotations.push(`readOnly: ${schema.readOnly}`);
	}
	if (typeof schema.writeOnly === 'boolean') {
		annotations.push(`writeOnly: ${schema.writeOnly}`);
	}
	if (typeof schema.deprecated === 'boolean') {
		annotations.push(`deprecated: ${schema.deprecated}`);
	}

	return annotations.length > 0
		? `${expression}.annotate({ ${annotations.join(', ')} })`
		: expression;
}
