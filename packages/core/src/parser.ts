import moize from 'moize';

import { logger } from './logger';
import {
	ADDITIONAL_PROPERTY_KEY_NAME,
	ASTKind,
	UNKNOWN_ADDITIONAL_PROPERTIES,
	UNKNOWN_NODE,
	type ASTMeta,
	type ASTNode,
	type LiteralNode,
	type ObjectNode,
	type ObjectProperty,
} from './types/AST';
import {
	getRootSchema,
	isBoolean,
	isPrimitive,
	Parent,
	SchemaType,
	type LinkedJSONSchema,
	type NormalizedJSONSchema,
} from './types/JSONSchema';
import { typesOfSchema } from './typesOfSchema';
import {
	assert,
	findKey,
	generateName,
	isPlainObject,
	maybeStripNameHints,
} from './utils';

const log = logger.withNamespace('parser');
const BLOCK_START = 'Parsing:';
const BLOCK_END = '---\n';
const printLogs = (schema: LinkedJSONSchema) => {
	const logs = log.flush(schema);
	if (logs) {
		log.debug(BLOCK_START, ...logs, BLOCK_END);
	}
};

export type ParserOptions = unknown;

type Processed = Map<LinkedJSONSchema, Map<SchemaType, ASTNode>>;

type UsedNames = Set<string>;

interface ParseParams {
	schema: LinkedJSONSchema;
	options?: ParserOptions;
	keyName?: string;
	processed?: Processed;
	usedNames?: UsedNames;
}

export function parse({
	schema,
	keyName,
	options,
	processed = new Map(),
	usedNames = new Set(),
}: ParseParams): ASTNode {
	const otherParams = { keyName, options, processed, usedNames };

	log.accumulate(schema, 'schema:', JSON.stringify(schema, null, 2));
	log.accumulate(schema, { keyName, usedNames });

	if (isPrimitive(schema)) {
		if (isBoolean(schema)) {
			const ast = parseBooleanSchema({ schema, keyName });

			log.accumulate(schema, 'AST (boolean):', ast);
			printLogs(schema);

			return ast;
		}

		const definitions = getDefinitionsMemoized({
			schema: getRootSchema(schema),
		});
		const keyNameFromDefinition = findKey(definitions, (_) => _ === schema);

		const ast = parseLiteral({
			...otherParams,
			schema,
			keyName,
			keyNameFromDefinition,
		});

		log.accumulate(schema, 'AST (literal):', ast);
		printLogs(schema);

		return ast;
	}

	const types = typesOfSchema(schema);

	log.accumulate(schema, 'Schema types:', types);

	if (types.length === 1) {
		const ast = parseAsTypeWithCache({
			...otherParams,
			type: types[0],
			schema,
		});

		log.accumulate(schema, 'AST (one type):', ast);
		printLogs(schema);

		return ast;
	}

	// Be careful to first process the intersection before processing its params,
	// so that it gets first pick for standalone name.
	const ast = parseAsTypeWithCache({
		...otherParams,
		schema: {
			[Parent]: schema[Parent] ?? null,
			$id: schema.$id,
			allOf: [],
			description: schema.description,
			title: schema.title,
		},
		type: 'ALL_OF',
	});

	assert(
		ast.kind === ASTKind.INTERSECTION,
		'AST should be an intersection type'
	);

	ast.nodes = types.map((type) => {
		// We hoist description (for comment) and id/title (for standaloneName)
		// to the parent intersection type, so we remove it from the children.
		return parseAsTypeWithCache({
			...otherParams,
			type,
			schema: maybeStripNameHints(schema),
		});
	});

	log.accumulate(schema, ['AST (multiple types):', ast]);
	printLogs(schema);

	return ast;
}

interface ParseWithTypeParams extends ParseParams {
	type: SchemaType;
	schema: LinkedJSONSchema;
	usedNames: UsedNames;
}

function parseAsTypeWithCache({
	type,
	schema,
	processed = new Map(),
	...otherParams
}: ParseWithTypeParams): ASTNode {
	// If we've seen this node before, return it.
	let cachedTypeMap = processed.get(schema);
	if (!cachedTypeMap) {
		cachedTypeMap = new Map();
		processed.set(schema, cachedTypeMap);
	}
	const cachedAST = cachedTypeMap.get(type);
	if (cachedAST) {
		return cachedAST;
	}

	// Cache processed ASTs before they are actually computed, then update
	// them in place using set(). This is to avoid cycles.
	// TODO: Investigate alternative approaches (lazy-computing nodes, etc.)
	const ast = {} as ASTNode;
	cachedTypeMap.set(type, ast);

	// Update the AST in place. This updates the `processed` cache, as well
	// as any nodes that directly reference the node.
	return Object.assign(ast, parseNonLiteral({ ...otherParams, type, schema }));
}

const getDefinitionsMemoized = moize(getDefinitions);

function parseNonLiteral({
	type: schemaType,
	schema,
	keyName,
	...otherParams
}: ParseWithTypeParams): ASTNode {
	const definitions = getDefinitionsMemoized({
		schema: getRootSchema(schema),
	});
	const keyNameFromDefinition = findKey(definitions, (_) => _ === schema);
	const standaloneName = computeStandaloneName({
		...otherParams,
		schema,
		keyNameFromDefinition,
	});
	const meta: ASTMeta = {
		provenance: schema.$ref,
		title: schema.title,
		description: schema.description,
	};

	switch (schemaType) {
		case SchemaType.ALL_OF:
			return {
				kind: ASTKind.INTERSECTION,
				default: schema.default,
				meta,
				keyName,
				standaloneName,
				nodes:
					schema.allOf?.map((subschema) =>
						parse({ ...otherParams, schema: subschema, keyName: undefined })
					) ?? [],
			};

		case SchemaType.ANY_OF: {
			const nodes = schema.anyOf?.map((subschema) =>
				parse({ ...otherParams, schema: subschema, keyName: undefined })
			);

			assert(nodes, 'Schema should have anyOf nodes');

			return {
				kind: ASTKind.UNION,
				default: schema.default,
				meta,
				keyName,
				standaloneName,
				nodes,
			};
		}

		case SchemaType.ONE_OF: {
			const nodes = schema.oneOf?.map((subschema) =>
				parse({ ...otherParams, schema: subschema, keyName: undefined })
			);

			assert(nodes, 'Schema should have oneOf nodes');

			return {
				kind: ASTKind.UNION,
				default: schema.default,
				meta,
				keyName,
				standaloneName,
				nodes,
			};
		}

		case SchemaType.BOOLEAN:
			return {
				kind: ASTKind.BOOLEAN,
				default: schema.default,
				meta,
				keyName,
				standaloneName,
			};

		case SchemaType.UNNAMED_ENUM: {
			assert(schema.enum, 'Named enum should have enum values');

			const values = Object.values(schema.enum).filter(
				(value) =>
					typeof value === 'string' ||
					typeof value === 'number' ||
					typeof value === 'boolean' ||
					value === null
			);

			if (values.length !== Object.keys(schema.enum).length) {
				throw new Error('Only primitive values are supported in enums');
			}

			return {
				kind: ASTKind.ENUM,
				default: schema.default,
				meta,
				keyName,
				standaloneName,
				values,
			};
		}

		case SchemaType.OBJECT:
		case SchemaType.NAMED_SCHEMA: {
			return createObject({
				...otherParams,
				schema,
				keyName,
			});
		}

		case SchemaType.UNNAMED_SCHEMA: {
			return createObject({
				...otherParams,
				schema,
				keyName: undefined,
				keyNameFromDefinition: keyNameFromDefinition ?? undefined,
			});
		}

		case SchemaType.STRING: {
			const defaultValue = schema.default ?? undefined;
			assert(
				typeof defaultValue === 'string' || defaultValue === undefined,
				'Default value should be string'
			);
			return {
				kind: ASTKind.STRING,
				default: defaultValue,
				meta,
				keyName,
				standaloneName,
				minLength: schema.minLength,
				maxLength: schema.maxLength,
				pattern: schema.pattern,
				format: schema.format,
			};
		}

		case SchemaType.INTEGER:
		case SchemaType.NUMBER: {
			const defaultValue = schema.default ?? undefined;
			assert(
				typeof defaultValue === 'number' || defaultValue === undefined,
				'Default value should be number'
			);
			return {
				kind:
					schemaType === SchemaType.INTEGER ? ASTKind.INTEGER : ASTKind.NUMBER,
				default: defaultValue,
				meta,
				keyName,
				standaloneName,
				minimum: schema.minimum,
				maximum: schema.maximum,
				exclusiveMinimum: schema.exclusiveMinimum,
				exclusiveMaximum: schema.exclusiveMaximum,
				multipleOf: schema.multipleOf,
			};
		}

		case SchemaType.UNTYPED_ARRAY: {
			// No items specified, treat as array of any
			return {
				kind: ASTKind.ARRAY,
				default: schema.default,
				meta,
				keyName,
				standaloneName,
				items: UNKNOWN_NODE,
				minItems: schema.minItems,
				maxItems: schema.maxItems,
			};
		}

		case SchemaType.TYPED_ARRAY: {
			if (Array.isArray(schema.items)) {
				// Tuple
				return {
					kind: ASTKind.TUPLE,
					default: schema.default,
					meta,
					keyName,
					standaloneName,
					items: schema.items.map((item, idx) =>
						parse({ ...otherParams, schema: item, keyName: idx.toString() })
					),
					minItems: schema.minItems ?? schema.items.length,
					maxItems: schema.maxItems,
					spreadParam:
						schema.additionalItems === true
							? UNKNOWN_NODE
							: schema.additionalItems
								? parse({ ...otherParams, schema: schema.additionalItems })
								: undefined,
				};
			} else {
				// Homogeneous array
				return {
					kind: ASTKind.ARRAY,
					default: schema.default,
					meta,
					keyName,
					standaloneName,
					items: schema.items
						? parse({
								...otherParams,
								schema: schema.items,
								keyName: undefined,
							})
						: UNKNOWN_NODE,
					minItems: schema.minItems,
					maxItems: schema.maxItems,
				};
			}
		}

		case SchemaType.REFERENCE: {
			throw new Error(
				`Refs should have been resolved by the resolver! ${JSON.stringify(
					schema,
					null,
					2
				)}`
			);
		}

		case SchemaType.UNION: {
			assert(
				Array.isArray(schema.type),
				'Union schema should have type as an array'
			);
			return {
				kind: ASTKind.UNION,
				default: schema.default,
				meta,
				keyName,
				standaloneName,
				nodes: schema.type.map((subtype) => {
					return parse({
						...otherParams,
						schema: { ...schema, type: subtype },
						keyName: undefined,
					});
				}),
			};
		}

		case SchemaType.NULL: {
			return {
				kind: ASTKind.NULL,
				meta,
				keyName,
				standaloneName,
			};
		}

		case SchemaType.ANY:
			return {
				kind: ASTKind.ANY,
				meta,
				keyName,
				standaloneName,
			};

		case SchemaType.CONST: {
			assert(
				schema.const !== undefined,
				'Const schema should have a const value'
			);
			return {
				kind: ASTKind.LITERAL,
				default: schema.default,
				meta,
				keyName,
				standaloneName,
				value: schema.const,
			};
		}
	}

	schemaType satisfies never;
}

function parseBooleanSchema({ schema, keyName }: ParseParams): ASTNode {
	if (schema) {
		return {
			kind: ASTKind.UNKNOWN,
			keyName,
		};
	}

	return {
		keyName,
		kind: ASTKind.NEVER,
	};
}

interface ParseLiteralParams extends ParseParams {
	usedNames: UsedNames;
	keyNameFromDefinition: string | undefined;
}

function parseLiteral({
	schema,
	keyName,
	...otherParams
}: ParseLiteralParams): LiteralNode {
	const commonProps = {
		kind: ASTKind.LITERAL,
		meta: {
			provenance: schema.$ref,
			title: schema.title,
			description: schema.description,
		},
		keyName,
		standaloneName: computeStandaloneName({
			...otherParams,
			schema,
			keyName,
		}),
	} satisfies Omit<LiteralNode, 'value'>;

	if ('const' in schema) {
		assert(
			schema.const !== undefined,
			'Literal schema should have a const value'
		);

		return {
			...commonProps,
			value: schema.const,
		};
	}
	assert(
		schema.type === 'null' || schema.type === 'string',
		'Literal schema should be of type null or string'
	);

	const defaultValue = schema.default ?? undefined;
	assert(
		schema.type !== 'null' || defaultValue === null,
		'Default value for null literal should be null'
	);
	assert(
		schema.type !== 'string' || typeof defaultValue === 'string',
		'Default value for string literal should be a string'
	);
	assert(defaultValue !== undefined, 'Schema type should be defined');

	return {
		...commonProps,
		default: defaultValue,
		value: schema.type === 'null' ? null : defaultValue,
	};
}

interface CreateObjectParams extends ParseParams {
	keyName?: string;
	keyNameFromDefinition?: string;
}

function createObject({
	schema,
	keyName,
	keyNameFromDefinition,
	...otherParams
}: CreateObjectParams): ObjectNode {
	const standaloneName = computeStandaloneName({
		schema,
		keyNameFromDefinition,
		usedNames: new Set(),
	});
	const meta: ASTMeta = {
		provenance: schema.$ref,
		title: schema.title,
		description: schema.description,
	};
	return {
		kind: ASTKind.OBJECT,
		default: schema.default,
		meta,
		keyName,
		standaloneName,
		properties: parseProperties({ ...otherParams, schema }),
		superTypes: [],
	};
}

type ParsePropertiesParams = ParseParams;

function parseProperties({
	schema,
	...otherParams
}: ParsePropertiesParams): ObjectProperty[] {
	let asts: ObjectProperty[] = Object.entries(schema.properties ?? {}).map(
		([key, subschema]) => {
			return {
				ast: parse({ ...otherParams, schema: subschema, keyName: key }),
				isPatternProperty: false,
				isRequired: schema.required?.includes(key) ?? false,
				keyName: key,
			};
		}
	);

	let singlePatternProperty = false;

	if (schema.patternProperties) {
		// TODO: verify validity for zod generator
		// partially support patternProperties. in the case that
		// additionalProperties is not set, and there is only a single
		// value definition, we can validate against that.
		singlePatternProperty =
			!schema.additionalProperties &&
			Object.keys(schema.patternProperties).length === 1;

		asts = asts.concat(
			Object.entries(schema.patternProperties).map(([key, subschema]) => {
				const ast = parse({ ...otherParams, schema: subschema, keyName: key });
				return {
					ast,
					isPatternProperty: !singlePatternProperty,
					isRequired:
						singlePatternProperty || (schema.required ?? []).includes(key), // pattern properties are never required
					isUnreachableDefinition: false,
					keyName: singlePatternProperty ? '[k: string]' : key,
				};
			})
		);
	}

	switch (schema.additionalProperties) {
		case true:
			if (singlePatternProperty) {
				return asts;
			}

			return asts.concat({
				ast: UNKNOWN_ADDITIONAL_PROPERTIES,
				isPatternProperty: false,
				isRequired: true,
				keyName: '[k: string]',
			});

		case undefined:
		case false:
			return asts;

		// pass "true" as the last param because in TS, properties
		// defined via index signatures are already optional
		default:
			return asts.concat({
				ast: parse({
					...otherParams,
					schema: schema.additionalProperties,
					keyName: ADDITIONAL_PROPERTY_KEY_NAME,
				}),
				isPatternProperty: false,
				isRequired: true,
				keyName: ADDITIONAL_PROPERTY_KEY_NAME,
			});
	}
}

interface GetDefinitionsParams {
	schema: LinkedJSONSchema;
	isSchema?: boolean;
	processed?: Set<LinkedJSONSchema>;
}

interface Definitions {
	[k: string]: LinkedJSONSchema;
}

function getDefinitions({
	schema,
	isSchema = true,
	processed = new Set<LinkedJSONSchema>(),
}: GetDefinitionsParams): Definitions {
	if (processed.has(schema)) {
		return {};
	}

	processed.add(schema);

	if (Array.isArray(schema)) {
		return schema.reduce(
			(prev, cur) => ({
				...prev,
				...getDefinitions({ schema: cur, isSchema: false, processed }),
			}),
			{}
		);
	}

	if (isPlainObject(schema)) {
		return {
			...(isSchema && hasDefinitions(schema) ? schema.$defs : {}),
			...Object.keys(schema).reduce<Definitions>((prev, cur) => {
				const subschema = schema[
					cur as keyof typeof schema
				] as LinkedJSONSchema;

				return {
					...prev,
					...getDefinitions({
						schema: subschema,
						isSchema: false,
						processed,
					}),
				};
			}, {}),
		};
	}

	return {};
}

/**
 * TODO: Reduce rate of false positives
 */
function hasDefinitions(
	schema: LinkedJSONSchema
): schema is NormalizedJSONSchema {
	return '$defs' in schema;
}

interface StandaloneNameParams extends ParseParams {
	schema: LinkedJSONSchema;
	keyNameFromDefinition: string | undefined;
	usedNames: UsedNames;
}

/**
 * Computes a unique standalone name for a schema node, used for generating named exports.
 *
 * Standalone names are assigned only to:
 *   - Root schemas (where schema[Parent] === null)
 *   - Schemas that are present in $defs (i.e., have a keyNameFromDefinition)
 *
 * Inline subschemas (such as union members, object properties, etc.) do not receive a standalone name,
 * and will be emitted inline in the generated code.
 *
 * The name is determined by the following priority:
 *   1. schema.title
 *   2. schema.$id
 *   3. keyNameFromDefinition (the key under which the schema appears in $defs)
 *
 * If a name is found, it is made unique using the usedNames set.
 */
function computeStandaloneName({
	schema,
	keyNameFromDefinition,
	usedNames,
}: StandaloneNameParams): string | undefined {
	if (schema[Parent] !== null && keyNameFromDefinition === undefined) {
		return undefined;
	}

	const name = schema.title || schema.$id || keyNameFromDefinition;
	if (name) {
		return generateName(name, usedNames);
	}
}
