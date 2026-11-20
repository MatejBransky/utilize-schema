import {
	type Dialect,
	dialectOf,
	isKeywordApplicable,
	isPlainObject,
	Meta,
	type ParsedJSONSchema,
	type ParsedJSONSchemaObject,
} from '@utilize/json-schema';

import { typedAlternatives } from './alternatives';
import { collectStandaloneSchemas, type SchemaEdge } from './collectStandaloneSchemas';
import { constraintKeywords } from './constraints';
import { UnresolvedReferenceError, UnsupportedEffectSchemaFeatureError } from './errors';
import { findCyclicSchemas } from './findCyclicSchemas';
import { formatCheck } from './formats';
import { ANNOTATION_KEYWORDS } from './keywords';
import { mergeObjectSchemas } from './mergeObjects';
import { planReferenceSiblings } from './refSiblings';
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
	/**
	 * What `format` becomes in the generated code: `assert` (default) validates
	 * known formats, `annotate` keeps `format` as `.annotate({ format })`.
	 */
	formatMode?: FormatMode;
	/** Emits a caller-provided Effect Schema expression for a matching schema node. */
	customSchemaResolver?: CustomSchemaResolver;
}

/**
 * What `format` becomes in the generated code. `assert` validates known
 * formats; `annotate` keeps `format` as an annotation.
 */
export type FormatMode = 'annotate' | 'assert';

/**
 * Returns an Effect Schema expression for a schema node, or `undefined` to use
 * the generator. Called for every object node, `$ref` nodes and generated
 * copies included. The expression replaces the whole node, so no
 * `.annotate()` is added to it.
 */
export type CustomSchemaResolver = (schema: ParsedJSONSchemaObject) => string | undefined;

type Context = {
	/** Name of an already declared standalone schema. */
	nameOf(schema: ParsedJSONSchemaObject, ref: string): string;
	/** Whether a standalone schema is part of a reference cycle. */
	isCyclic(schema: ParsedJSONSchemaObject): boolean;
	/**
	 * Dialect of the node being generated. Starts as the document root's dialect;
	 * `generateSchema` sets it to each node's dialect, so helpers and copies
	 * without `Meta` read it from here instead of resolving it again.
	 */
	dialect: Dialect;
	/** Whether `format` becomes a validation or only an annotation. */
	formatMode?: FormatMode;
	/**
	 * Name of the module-level constant that holds the check for a format.
	 * Registered on first use, so one format yields one constant per file.
	 */
	formatOf(format: string): string;
	customSchemaResolver?: CustomSchemaResolver;
};

/** Keywords that have no Effect Schema equivalent and are rejected instead of ignored. */
const UNSUPPORTED_KEYWORDS = ['minContains', 'maxContains'] as const;

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
		customSchemaResolver: options.customSchemaResolver,
		aliasFor(schema) {
			return cyclic.has(schema) ? aliasOf(schema) : undefined;
		},
		typeNameFor(schema) {
			return namesOf(schema)!.type;
		},
	};

	const formatNames = new Map<string, string>();
	const usedNames = new Set(['Schema']);

	for (const names of [...definitionNames.values(), rootNames]) {
		usedNames.add(names.schema);
		usedNames.add(names.type);
	}

	const context: Context = {
		formatOf(format) {
			const existing = formatNames.get(format);

			if (existing !== undefined) {
				return existing;
			}

			const name = allocateName(formatConstantBase(format), usedNames);

			formatNames.set(format, name);
			return name;
		},
		nameOf(schema, ref) {
			const names = namesOf(schema);

			if (names === undefined) {
				throw new UnresolvedReferenceError(ref);
			}

			return names.schema;
		},
		isCyclic(schema) {
			return cyclic.has(schema);
		},
		dialect: dialectOf(root),
		formatMode: options.formatMode,
		customSchemaResolver: options.customSchemaResolver,
	};

	const declarations: string[] = [];

	for (const schema of standalone) {
		declarations.push(renderDeclaration(definitionNames.get(schema)!, schema));
	}

	declarations.push(renderDeclaration(rootNames, root));

	const parts: string[] = [];

	if (options.importEffect ?? true) {
		parts.push("import { Schema } from 'effect';");
	}

	// Declarations rendered above registered the formats they use, so the
	// constants can be emitted once, before any schema that references them.
	for (const [format, name] of formatNames) {
		parts.push(`const ${name} = ${formatCheck(format)!};`);
	}

	parts.push(...declarations);

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

	const customExpression = context.customSchemaResolver?.(schema);

	if (customExpression !== undefined) {
		return customExpression;
	}

	const dialect = dialectOf(schema, context.dialect);
	const nodeContext = dialect === context.dialect ? context : { ...context, dialect };

	assertSupportedKeywords(schema, dialect);

	const filters = filterChecks(schema, nodeContext);
	const expression =
		typeof schema.$ref === 'string'
			? generateReference(schema, filters, nodeContext)
			: applyChecks(generateExpression(schema, nodeContext), filters);

	return applyAnnotations(expression, schema);
}

function generateExpression(schema: ParsedJSONSchemaObject, context: Context): string {
	const dialect = context.dialect;

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
		// When both are present, each is applied on its own: `anyOf` becomes the
		// union and `oneOf` stays in the base, which counts its own matches.
		const keyword = Array.isArray(schema.anyOf) ? 'anyOf' : 'oneOf';
		const { members, allTyped } = typedAlternatives(schema, alternatives);
		const union = generateUnion(members, keyword === 'oneOf', context);
		const base = alternativesBase(schema, keyword, allTyped);

		if (base === undefined) {
			return union;
		}

		const constraints = generateSchema(base, context);

		// Unknown keywords (`x-*`) generate `Schema.Json`, so a filter over them
		// would accept everything and only make the output noisier.
		if (constraints === 'Schema.Json') {
			return union;
		}

		return applyChecks(union, [siblingKeywordsCheck(constraints, keyword)]);
	}

	return generateType(schema, context);
}

/**
 * A filter that requires the value to match the keywords declared next to
 * `keyword` (`$ref`, `anyOf` or `oneOf`).
 */
function siblingKeywordsCheck(constraints: string, keyword: string): string {
	return `Schema.makeFilter((value) => Schema.is(${constraints})(value) ? undefined : 'Value does not match the keywords next to "${keyword}"')`;
}

/**
 * The keywords declared next to `anyOf`/`oneOf`. They constrain the value on
 * their own, so the union alone would ignore them. The combinator that became
 * the union stays out, along with the annotations and the filter keywords,
 * which `generateSchema` handles on the whole node. A base with only `type`
 * adds nothing once every member took that type (see `typedAlternatives`).
 */
function alternativesBase(
	schema: ParsedJSONSchemaObject,
	applied: 'anyOf' | 'oneOf',
	allTyped: boolean
): ParsedJSONSchemaObject | undefined {
	const base = constraintKeywords(schema, new Set([applied]));
	const keywords = Object.keys(base);
	const onlyAppliedType = allTyped && keywords.length === 1 && keywords[0] === 'type';

	return keywords.length > 0 && !onlyAppliedType ? base : undefined;
}

/**
 * A `$ref` with the keywords next to it (see `planReferenceSiblings`) and the
 * node's filter checks (`not`, `if`, ...).
 */
function generateReference(
	schema: ParsedJSONSchemaObject,
	filters: string[],
	context: Context
): string {
	const siblings = planReferenceSiblings(schema, context.dialect, context.isCyclic);

	switch (siblings.kind) {
		case 'none':
			return checkedReference(schema, filters, context);
		case 'merge':
			return applyChecks(
				siblings.merged === false ? 'Schema.Never' : generateObject(siblings.merged, context),
				filters
			);
		case 'check': {
			const constraints = generateSchema(siblings.constraints, context);

			return checkedReference(
				schema,
				[siblingKeywordsCheck(constraints, '$ref'), ...filters],
				context
			);
		}
	}
}

/**
 * Effect cannot attach checks to `Schema.suspend`, so a checked reference is
 * wrapped in a single-member union. The union keeps the reference's type and
 * its declaration stays shared, which also works for recursive schemas.
 */
function checkedReference(
	schema: ParsedJSONSchemaObject,
	checks: string[],
	context: Context
): string {
	const expression = reference(schema, context);

	return checks.length === 0 ? expression : applyChecks(`Schema.Union([${expression}])`, checks);
}

function generateUnion(
	alternatives: ParsedJSONSchema[],
	exclusive: boolean,
	context: Context
): string {
	const generated = alternatives.map((member) => generateSchema(member, context));
	// `oneOf` counts how many branches match, so identical branches must stay.
	const members = exclusive ? generated : [...new Set(generated)];

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
				schema.type.map((type) => {
					const branch = schemaWithType(schema, type as ParsedJSONSchemaObject['type']);

					return context.customSchemaResolver?.(branch) ?? generateType(branch, context);
				})
			),
		];

		if (members.length === 0) {
			return 'Schema.Never';
		}

		return members.length === 1 ? members[0]! : `Schema.Union([${members.join(', ')}])`;
	}

	switch (schema.type) {
		case 'string':
			return generateString(schema, context);
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

function generateString(schema: ParsedJSONSchemaObject, context: Context): string {
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

	const format =
		(context.formatMode ?? 'assert') === 'assert' &&
		typeof schema.format === 'string' &&
		formatCheck(schema.format) !== undefined
			? context.formatOf(schema.format)
			: undefined;

	if (format !== undefined) {
		checks.push(format);
	}

	return checks.length > 0 ? `Schema.String.check(${checks.join(', ')})` : 'Schema.String';
}

/** `date-time` becomes `formatDateTime`, so one constant covers a format. */
function formatConstantBase(format: string) {
	const pascal = format.replace(/[^a-zA-Z0-9]+(.)?/g, (_, next: string | undefined) =>
		next === undefined ? '' : next.toUpperCase()
	);

	return `format${pascal.charAt(0).toUpperCase()}${pascal.slice(1)}`;
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
	const dialect = context.dialect;
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
	const dialect = context.dialect;
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
	const patterns = patternEntries(schema, context);
	const checks = objectChecks(schema, context);

	if (keys.length === 0) {
		const expression =
			patterns.length > 0
				? 'Schema.Record(Schema.String, Schema.Json)'
				: additional === false
					? 'Schema.Record(Schema.String, Schema.Never)'
					: isPlainObject(additional)
						? `Schema.Record(Schema.String, ${generateSchema(additional, context)})`
						: 'Schema.Record(Schema.String, Schema.Json)';

		const additionalChecks =
			patterns.length > 0 ? additionalChecksFor([], additional, context, patterns) : [];

		return applyChecks(expression, [...patternChecks(patterns), ...additionalChecks, ...checks]);
	}

	const fields = keys.map((key) => {
		const property = Object.hasOwn(properties, key) ? properties[key] : undefined;
		// A required key without a `properties` entry is validated by a matching
		// pattern or by `additionalProperties`, so the placeholder must not make
		// it unsatisfiable when a pattern applies.
		const expression =
			property !== undefined
				? generateSchema(property, context)
				: additional === false && patterns.length === 0
					? 'Schema.Never'
					: isPlainObject(additional) && patterns.length === 0
						? generateSchema(additional, context)
						: 'Schema.Json';

		// A computed key keeps `__proto__` from changing the prototype of the
		// object literal passed to `Schema.Struct`.
		const keyExpression = key === '__proto__' ? `[${JSON.stringify(key)}]` : JSON.stringify(key);

		return `${keyExpression}: ${
			required.has(key) ? expression : `Schema.optionalKey(${expression})`
		}`;
	});
	// With patterns, a required key without a `properties` entry is checked by
	// its pattern or by `additionalProperties`, so only `properties` are declared.
	const additionalChecks = additionalChecksFor(
		patterns.length > 0 ? Object.keys(properties) : keys,
		additional,
		context,
		patterns
	);

	return applyChecks(
		`Schema.StructWithRest(Schema.Struct({ ${fields.join(', ')} }), [Schema.Record(Schema.String, Schema.Json)])`,
		[...patternChecks(patterns), ...additionalChecks, ...checks]
	);
}

interface PatternEntry {
	pattern: string;
	expression: string;
}

function patternEntries(schema: ParsedJSONSchemaObject, context: Context): PatternEntry[] {
	if (!isPlainObject(schema.patternProperties)) {
		return [];
	}

	return Object.entries(schema.patternProperties).map(([pattern, subschema]) => ({
		pattern,
		expression: generateSchema(subschema, context),
	}));
}

/**
 * `patternProperties` applies every matching pattern to a key, so the object is
 * kept open and a filter validates the matching entries.
 */
function patternChecks(patterns: PatternEntry[]): string[] {
	if (patterns.length === 0) {
		return [];
	}

	// One check per pattern keeps every regex and schema at its own type; an
	// array of `[regex, schema]` pairs would widen to a union of both.
	const checks = patterns
		.map(
			({
				pattern,
				expression,
			}) => `if (${patternExpression(pattern)}.test(key) && !Schema.is(${expression})(entry)) {
          return 'Property does not match the pattern schema';
        }`
		)
		.join('\n');

	return [
		`Schema.makeFilter((value) => {
      for (const [key, entry] of Object.entries(value)) {
        ${checks}
      }

      return undefined;
    })`,
	];
}

/**
 * `Schema.Struct` silently strips excess keys and `Schema.Record` validates
 * declared keys too, so excess keys are preserved and validated by a filter.
 */
function additionalChecksFor(
	keys: string[],
	additional: ParsedJSONSchemaObject['additionalProperties'],
	context: Context,
	patterns: PatternEntry[] = []
): string[] {
	if (additional === undefined || additional === true) {
		return [];
	}

	const isDeclared = knownKeyExpression(keys, patterns);

	if (additional === false) {
		return [
			`Schema.makeFilter((value) => Object.keys(value).every((key) => ${isDeclared}) ? undefined : 'Unexpected property')`,
		];
	}

	const additionalSchema = generateSchema(additional, context);

	return [
		`Schema.makeFilter((value) => Object.entries(value).every(([key, entry]) => ${isDeclared} || Schema.is(${additionalSchema})(entry)) ? undefined : 'Property does not match the schema')`,
	];
}

/**
 * Tests whether `key` is declared or matches a pattern. An empty array literal
 * is typed `never[]`, so `[].includes(key)` would not type-check and is left out.
 */
function knownKeyExpression(keys: string[], patterns: PatternEntry[]): string {
	const tests = [
		...(keys.length > 0 ? [`${JSON.stringify(keys)}.includes(key)`] : []),
		...patterns.map(({ pattern }) => `${patternExpression(pattern)}.test(key)`),
	];

	return tests.length > 0 ? tests.join(' || ') : 'false';
}

function objectChecks(schema: ParsedJSONSchemaObject, context: Context): string[] {
	const checks: string[] = [];

	if (typeof schema.minProperties === 'number') {
		checks.push(`Schema.isMinProperties(${schema.minProperties})`);
	}
	if (typeof schema.maxProperties === 'number') {
		checks.push(`Schema.isMaxProperties(${schema.maxProperties})`);
	}
	if (schema.propertyNames !== undefined && isKeywordApplicable(context.dialect, 'propertyNames')) {
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
	if (typeof schema.$ref === 'string' && context.dialect.refSiblings === 'ignore') {
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
	const dialect = context.dialect;
	const constrained = JSON_VALUE_TYPES.filter((type) =>
		appliesTo(schema, type, dialect, (context.formatMode ?? 'assert') === 'assert')
	);

	if (constrained.length === 0) {
		return 'Schema.Json';
	}

	const members = [
		'Schema.Null',
		'Schema.Boolean',
		constrained.includes('string') ? generateString(schema, context) : 'Schema.String',
		constrained.includes('number') ? generateNumber(schema, false) : 'Schema.Finite',
		constrained.includes('object') ? generateObject(schema, context) : 'Schema.JsonObject',
		constrained.includes('array') ? generateArray(schema, context) : 'Schema.Array(Schema.Json)',
	];

	return `Schema.Union([${[...new Set(members)].join(', ')}])`;
}

function appliesTo(
	schema: ParsedJSONSchemaObject,
	type: JSONValueType,
	dialect: Dialect,
	assertFormats: boolean
): boolean {
	const record = schema as unknown as Record<string, unknown>;
	const anyKeyword = (keywords: string[]) =>
		keywords.some(
			(keyword) => record[keyword] !== undefined && isKeywordApplicable(dialect, keyword)
		);

	switch (type) {
		case 'string':
			// A format only constrains the string branch, so an untyped schema
			// asserts it the same way a typed one does. In annotate mode it adds
			// no check, so the branch stays plain `Schema.String`.
			return (
				anyKeyword(['minLength', 'maxLength', 'pattern']) ||
				(assertFormats &&
					typeof schema.format === 'string' &&
					formatCheck(schema.format) !== undefined)
			);
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
				'patternProperties',
				'required',
				'additionalProperties',
				'minProperties',
				'maxProperties',
				'propertyNames',
				'dependencies',
			]);
		case 'array':
			return anyKeyword([
				'items',
				'prefixItems',
				'additionalItems',
				'minItems',
				'maxItems',
				'uniqueItems',
				'contains',
			]);
	}
}

/**
 * Merges `allOf` subschemas. Effect Schema has no generic intersection, so the
 * members have to reduce to either disjoint object schemas or one scalar type
 * with combinable constraints.
 */
function generateIntersection(schemas: ParsedJSONSchema[], context: Context): string {
	const flattened = flattenAllOf(schemas);

	if (flattened.includes(false)) {
		return 'Schema.Never';
	}

	const members = flattened.filter(
		(schema): schema is ParsedJSONSchemaObject =>
			isPlainObject(schema) && !isEmptySchema(schema as unknown as ParsedJSONSchemaObject)
	);

	if (members.length === 0) {
		return 'Schema.Json';
	}

	if (members.length === 1) {
		return generateSchema(members[0]!, context);
	}

	const result = mergeObjectSchemas(members);

	if (result.merged !== undefined) {
		return result.merged === false ? 'Schema.Never' : generateObject(result.merged, context);
	}

	const typed = mergeTypedSchemas(members);

	if (typed !== undefined) {
		return generateSchema(typed, context);
	}

	const conjunction = generateConjunction(members, context);

	if (conjunction !== undefined) {
		return conjunction;
	}

	throw new UnsupportedEffectSchemaFeatureError(
		'allOf',
		`the subschemas could not be merged or checked as filters (${result.reason})`
	);
}

/**
 * Combines `allOf` members that cannot be merged into one schema by checking
 * the value against each member instead. `anyOf` and `oneOf` are split so both
 * constrain the value; every other member is applied as a filter.
 */
function generateConjunction(
	members: ParsedJSONSchemaObject[],
	context: Context
): string | undefined {
	const parts: ParsedJSONSchemaObject[] = [];

	for (const member of members) {
		if (Array.isArray(member.anyOf) || Array.isArray(member.oneOf)) {
			const { anyOf, oneOf, ...rest } = member;

			// Keywords next to the union constrain the value as well, so they stay
			// a separate member instead of being dropped with the union.
			if (!isEmptySchema(rest as ParsedJSONSchemaObject)) {
				parts.push(rest as ParsedJSONSchemaObject);
			}

			// `anyOf` and `oneOf` both constrain the value, so they stay separate.
			if (Array.isArray(anyOf)) {
				parts.push({ anyOf } as unknown as ParsedJSONSchemaObject);
			}

			if (Array.isArray(oneOf)) {
				parts.push({ oneOf } as unknown as ParsedJSONSchemaObject);
			}

			continue;
		}

		parts.push(member);
	}

	if (parts.length < 2) {
		return undefined;
	}

	const [base, ...constraints] = parts;

	return applyChecks(
		generateSchema(base!, context),
		constraints.map(
			(part) =>
				`Schema.makeFilter((value) => Schema.is(${generateSchema(part, context)})(value) ? undefined : 'Value does not match every schema in "allOf"')`
		)
	);
}

/** Keywords a typed subschema may use and still be merged. */
const MERGEABLE_KEYWORDS: Record<'number' | 'string' | 'array', ReadonlySet<string>> = {
	number: new Set(['minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'multipleOf']),
	string: new Set(['minLength', 'maxLength', 'pattern']),
	array: new Set(['minItems', 'maxItems', 'uniqueItems']),
};

/** Removes the `allOf` that is being flattened and keeps every other keyword. */
function withoutAllOf(schema: ParsedJSONSchemaObject): ParsedJSONSchemaObject {
	return { ...schema, allOf: undefined };
}

/**
 * Expands nested `allOf`, splitting the keywords declared next to it. Refinements
 * such as `not` and `if`/`then`/`else` stay on the split-off member, which is
 * generated as a normal member and turns them into filters.
 */
function flattenAllOf(schemas: ParsedJSONSchema[]): ParsedJSONSchema[] {
	const flattened: ParsedJSONSchema[] = [];

	for (const schema of schemas) {
		if (!isPlainObject(schema)) {
			flattened.push(schema);
			continue;
		}

		const node = schema as ParsedJSONSchemaObject;

		if (!Array.isArray(node.allOf) || node.allOf.length === 0) {
			flattened.push(schema);
			continue;
		}

		const parent = withoutAllOf(node);

		if (!isEmptySchema(parent)) {
			flattened.push(parent);
		}

		flattened.push(...flattenAllOf(node.allOf as unknown as ParsedJSONSchema[]));
	}

	return flattened;
}

/** A schema that only carries metadata, `true`, or no keywords at all. */
function isEmptySchema(schema: ParsedJSONSchemaObject): boolean {
	return Object.entries(schema).every(
		([keyword, value]) => value === undefined || ANNOTATION_KEYWORDS.has(keyword)
	);
}

/**
 * Merges subschemas that constrain one JSON type. Bounds are combined into the
 * strictest one; a keyword that cannot be combined (`pattern`, a different
 * `multipleOf`, array items) keeps the intersection a filter.
 */
function mergeTypedSchemas(members: ParsedJSONSchemaObject[]): ParsedJSONSchemaObject | undefined {
	let type: 'number' | 'integer' | 'string' | 'array' | undefined;
	let declaredType = false;

	for (const member of members) {
		if (member.$ref !== undefined) {
			return undefined;
		}

		const memberType = mergeableType(member);

		if (memberType === undefined) {
			return undefined;
		}

		if (
			member.type === 'number' ||
			member.type === 'integer' ||
			member.type === 'string' ||
			member.type === 'array'
		) {
			declaredType = true;
		}

		if (type === undefined) {
			type = memberType;
		} else if (type === 'number' && memberType === 'integer') {
			type = 'integer';
		} else if (type !== memberType && !(type === 'integer' && memberType === 'number')) {
			return undefined;
		}

		const allowed = MERGEABLE_KEYWORDS[memberType === 'integer' ? 'number' : memberType];

		for (const [keyword, value] of Object.entries(member)) {
			if (value === undefined || ANNOTATION_KEYWORDS.has(keyword) || keyword === 'type') {
				continue;
			}

			if (!allowed.has(keyword)) {
				return undefined;
			}
		}
	}

	if (type === undefined) {
		return undefined;
	}

	// Keywords like `minimum` or `minItems` only constrain their own JSON type, so
	// the type stays inferred unless a member declared it.
	const merged: Record<string, unknown> = declaredType ? { type } : {};
	let minimum: number | undefined;
	let maximum: number | undefined;
	let exclusiveMinimum: number | undefined;
	let exclusiveMaximum: number | undefined;
	let multipleOf: number | undefined;
	let minLength: number | undefined;
	let maxLength: number | undefined;
	let pattern: string | undefined;
	let minItems: number | undefined;
	let maxItems: number | undefined;
	let uniqueItems: boolean | undefined;

	for (const member of members) {
		if (typeof member.minimum === 'number') {
			minimum = minimum === undefined ? member.minimum : Math.max(minimum, member.minimum);
		}

		if (typeof member.maximum === 'number') {
			maximum = maximum === undefined ? member.maximum : Math.min(maximum, member.maximum);
		}

		// The draft-04 boolean form cannot be combined with numbers.
		if (member.exclusiveMinimum !== undefined) {
			if (typeof member.exclusiveMinimum !== 'number') {
				return undefined;
			}

			exclusiveMinimum =
				exclusiveMinimum === undefined
					? member.exclusiveMinimum
					: Math.max(exclusiveMinimum, member.exclusiveMinimum);
		}

		if (member.exclusiveMaximum !== undefined) {
			if (typeof member.exclusiveMaximum !== 'number') {
				return undefined;
			}

			exclusiveMaximum =
				exclusiveMaximum === undefined
					? member.exclusiveMaximum
					: Math.min(exclusiveMaximum, member.exclusiveMaximum);
		}

		if (typeof member.multipleOf === 'number') {
			if (multipleOf !== undefined && multipleOf !== member.multipleOf) {
				return undefined;
			}

			multipleOf = member.multipleOf;
		}

		if (typeof member.minLength === 'number') {
			minLength =
				minLength === undefined ? member.minLength : Math.max(minLength, member.minLength);
		}

		if (typeof member.maxLength === 'number') {
			maxLength =
				maxLength === undefined ? member.maxLength : Math.min(maxLength, member.maxLength);
		}

		if (typeof member.pattern === 'string') {
			if (pattern !== undefined && pattern !== member.pattern) {
				return undefined;
			}

			pattern = member.pattern;
		}

		if (typeof member.minItems === 'number') {
			minItems = minItems === undefined ? member.minItems : Math.max(minItems, member.minItems);
		}

		if (typeof member.maxItems === 'number') {
			maxItems = maxItems === undefined ? member.maxItems : Math.min(maxItems, member.maxItems);
		}

		if (member.uniqueItems === true) {
			uniqueItems = true;
		}
	}

	for (const [keyword, value] of Object.entries({
		minimum,
		maximum,
		exclusiveMinimum,
		exclusiveMaximum,
		multipleOf,
		minLength,
		maxLength,
		pattern,
		minItems,
		maxItems,
		uniqueItems,
	})) {
		if (value !== undefined) {
			merged[keyword] = value;
		}
	}

	return merged as unknown as ParsedJSONSchemaObject;
}

/** The type a subschema constrains, from `type` or its keyword family. */
function mergeableType(
	schema: ParsedJSONSchemaObject
): 'number' | 'integer' | 'string' | 'array' | undefined {
	if (
		schema.type === 'number' ||
		schema.type === 'integer' ||
		schema.type === 'string' ||
		schema.type === 'array'
	) {
		return schema.type;
	}

	if (schema.type !== undefined) {
		return undefined;
	}

	const record = schema as unknown as Record<string, unknown>;
	const has = (keywords: string[]) => keywords.some((keyword) => record[keyword] !== undefined);
	const candidates: Array<'number' | 'string' | 'array'> = [];

	if (has(['minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'multipleOf'])) {
		candidates.push('number');
	}

	if (has(['minLength', 'maxLength', 'pattern'])) {
		candidates.push('string');
	}

	if (has(['minItems', 'maxItems', 'uniqueItems'])) {
		candidates.push('array');
	}

	return candidates.length === 1 ? candidates[0] : undefined;
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

function applyChecks(expression: string, checks: string[]): string {
	if (checks.length === 0) {
		return expression;
	}

	// Effect cannot attach checks to `Schema.suspend`, so a checked reference is
	// wrapped in a single-member union. The union keeps the reference's type and
	// its declaration stays shared, which also works for recursive schemas.
	const target = expression.startsWith('Schema.suspend(')
		? `Schema.Union([${expression}])`
		: expression;

	return `${target}.check(${checks.join(', ')})`;
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
