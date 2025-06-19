import type { JSONSchema } from '@apidevtools/json-schema-ref-parser';

import { logger, LogLevel, safeStringify } from './logger';
import {
	ADDITIONAL_PROPERTY_KEY_NAME,
	ASTKind,
	NO_ADDITIONAL_PROPERTIES,
	UNKNOWN_ADDITIONAL_PROPERTIES,
	UNKNOWN_NODE,
	type ASTMeta,
	type ASTNode,
	type LiteralNode,
	type ObjectNode,
	type ObjectProperty,
	type ReferenceNode,
} from './types/AST';
import {
	getRootSchema,
	isBoolean,
	isPrimitive,
	Parent,
	Reference,
	SchemaType,
	type LinkedJSONSchema,
} from './types/JSONSchema';
import { typesOfSchema } from './typesOfSchema';
import {
	assert,
	findKey,
	generateName,
	getDefinitionsMemoized,
	maybeStripNameHints,
} from './utils';

const log = logger.withNamespace('parser');
logger.setNamespaceLevels('parser', [
	LogLevel.DEBUG,
	LogLevel.INFO,
	LogLevel.WARN,
	LogLevel.ERROR,
]);

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

interface CommonParseParams {
	schema: LinkedJSONSchema;
	usedRefSchemas: Map<JSONSchema, { name: string; ref: string; ast: ASTNode }>;
	options?: ParserOptions;
	keyName?: string;
	processed?: Processed;
	usedNames?: UsedNames;
}

let callId = 0;

export function parse({
	schema,
	keyName,
	options,
	processed = new Map(),
	usedNames = new Set(),
	usedRefSchemas,
}: CommonParseParams): ASTNode {
	callId++;
	const otherParams = {
		keyName,
		options,
		processed,
		usedNames,
		usedRefSchemas,
	};

	log.accumulate(schema, `Call #${callId}`);
	log.accumulate(schema, 'schema:', safeStringify(schema));
	log.accumulate(schema, { keyName, usedNames });

	if (schema[Reference]) {
		const reference = schema[Reference];
		const usedReference = usedRefSchemas.get(reference.schema);
		let refName = usedReference?.name;
		let refAst = usedReference?.ast;

		log.accumulate(schema, 'Reference found:', {
			refSchema: safeStringify(reference.schema),
			refRefSchema: safeStringify(
				reference.schema[Reference]?.schema[Reference]
			),
			usedReference,
		});

		if (!usedReference) {
			const definitions = getDefinitionsMemoized({
				schema: getRootSchema(schema),
			});
			const keyNameFromDefinition = findKey(
				definitions,
				(_) => _ === reference.schema
			);

			refName = keyNameFromDefinition;

			assert(
				keyNameFromDefinition,
				'Reference schema should have a definition key'
			);

			refAst = parse({
				schema: reference.schema,
				...otherParams,
				keyName: undefined,
			});

			usedRefSchemas.set(reference.schema, {
				name: keyNameFromDefinition,
				ref: reference.ref,
				ast: refAst,
			});
		}

		log.accumulate(schema, 'Reference:', safeStringify(reference));

		assert(refName, 'Reference name should be defined');
		assert(refAst, 'Reference AST should be defined');

		const ast: ReferenceNode = {
			kind: ASTKind.REFERENCE,
			refName,
			reference: refAst,
			default:
				schema.default !== reference.schema.default
					? schema.default
					: undefined,
			meta: {
				provenance: reference.ref,
				title: schema.title,
				description: schema.description,
			},
		};

		log.accumulate(schema, 'AST (reference):', safeStringify(ast));
		const logs = log.flush(schema) ?? [];
		log.debug(BLOCK_START, ...logs, BLOCK_END);

		return ast;
	}

	if (isPrimitive(schema)) {
		if (isBoolean(schema)) {
			const ast = parseBooleanSchema({ schema, keyName, usedRefSchemas });

			log.accumulate(schema, 'AST (boolean):', safeStringify(ast));
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

		log.accumulate(schema, 'AST (one type):', safeStringify(ast));
		printLogs(schema);

		return ast;
	}

	// Be careful to first process the intersection before processing its params,
	// so that it gets first pick for standalone name.
	const ast = parseAsTypeWithCache({
		...otherParams,
		schema: {
			[Parent]: null,
			$id: schema.$id,
			anyOf: [],
			description: schema.description,
			title: schema.title,
		},
		type: SchemaType.ANY_OF,
	});

	// FIXME: This doesn't work for JSONSchemaDraft7.input.ts
	// assert(
	// 	ast.kind === ASTKind.INTERSECTION,
	// 	'AST should be an intersection type'
	// );

	ast.nodes = types.map((type) => {
		// We hoist description (for comment) and id/title (for standaloneName)
		// to the parent intersection type, so we remove it from the children.
		return parseAsTypeWithCache({
			...otherParams,
			type,
			schema: maybeStripNameHints(schema),
		});
	});

	log.accumulate(schema, 'AST (multiple types):', safeStringify(ast));
	printLogs(schema);

	return ast;
}

interface ParseWithTypeParams extends CommonParseParams {
	type: SchemaType;
	schema: LinkedJSONSchema;
	usedNames: UsedNames;
	processed: Processed;
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
	return Object.assign(
		ast,
		parseNonLiteral({ ...otherParams, type, schema, processed })
	);
}

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
		case SchemaType.ALL_OF: {
			const nodes =
				schema.allOf?.map((subschema) =>
					parse({ ...otherParams, schema: subschema, keyName: undefined })
				) ?? [];

			if (nodes.length === 0) {
				return {
					kind: ASTKind.NEVER,
					standaloneName,
					meta,
					keyName,
				};
			}

			return {
				kind: ASTKind.INTERSECTION,
				default: schema.default,
				meta,
				keyName,
				standaloneName,
				nodes,
			};
		}

		case SchemaType.ANY_OF: {
			const nodes = schema.anyOf?.map((subschema) =>
				parse({
					...otherParams,
					schema: subschema,
					keyName: undefined,
				})
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
				parse({
					...otherParams,
					schema: subschema,
					keyName: undefined,
				})
			);

			assert(nodes, 'Schema should have oneOf nodes');

			if (schema.discriminator) {
				return {
					kind: ASTKind.DISCRIMINATED_UNION,
					discriminator: schema.discriminator,
					default: schema.default,
					meta,
					keyName,
					standaloneName,
					nodes,
				};
			}

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
				standaloneName,
			});
		}

		case SchemaType.UNNAMED_SCHEMA: {
			return createObject({
				...otherParams,
				schema,
				standaloneName,
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
				`Refs should have been resolved by the resolver! ${safeStringify(
					schema
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
						schema: maybeStripNameHints({ ...schema, type: subtype }),
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

function parseBooleanSchema({ schema, keyName }: CommonParseParams): ASTNode {
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

interface ParseLiteralParams extends CommonParseParams {
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

interface CreateObjectParams extends CommonParseParams {
	keyName?: string;
	standaloneName?: string;
}

function createObject({
	schema,
	standaloneName,
	keyName,
	...otherParams
}: CreateObjectParams): ObjectNode {
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

type ParsePropertiesParams = CommonParseParams;

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
				isRequired: false,
				keyName: '[k: string]',
			});

		case undefined:
			return asts;

		case false:
			return asts.concat({
				ast: NO_ADDITIONAL_PROPERTIES,
				isPatternProperty: false,
				isRequired: false,
				keyName: '',
			});

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
				isRequired: false,
				keyName: ADDITIONAL_PROPERTY_KEY_NAME,
			});
	}
}

interface StandaloneNameParams extends CommonParseParams {
	schema: LinkedJSONSchema;
	keyNameFromDefinition: string | undefined;
	usedNames: UsedNames;
}
/**
 * Computes a unique standalone name for a schema node, used for generating named exports.
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
	if (schema[Parent] !== null && schema[Reference]) {
		return undefined;
	}

	const name = schema.title || schema.$id || keyNameFromDefinition;
	if (name) {
		return generateName(name, usedNames);
	}
}
