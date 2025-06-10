import moize from 'moize';

import { logger } from './logger';
import {
	ASTKind,
	UNKNOWN_ADDITIONAL_PROPERTIES,
	type ASTMeta,
	type ASTNode,
	type ObjectNode,
	type ObjectParam,
} from './types/AST';
import {
	getRootSchema,
	Parent,
	SchemaType,
	type JSONSchemaType,
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
	// TODO: handle primitive schemas (boolean, number, string)

	const types = typesOfSchema(schema);

	if (types.length === 1) {
		const ast = parseAsTypeWithCache({
			...otherParams,
			type: types[0],
			schema,
		});

		log.debug(
			'Types:',
			types,
			'\nInput:',
			schema,
			'\nOutput:',
			ast,
			'\nOther params:',
			otherParams
		);
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

	ast.params = types.map((type) => {
		// We hoist description (for comment) and id/title (for standaloneName)
		// to the parent intersection type, so we remove it from the children.
		return parseAsTypeWithCache({
			...otherParams,
			type,
			schema: maybeStripNameHints(schema),
		});
	});

	log.debug(
		'Types:',
		types,
		'\nInput:',
		schema,
		'\nOutput:',
		ast,
		'\nOther params:',
		otherParams
	);
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
	log.debug('otherParams:', otherParams);
	log.debug('standaloneName:', standaloneName);
	log.debug('keyNameFromDefinition:', keyNameFromDefinition);

	switch (schemaType) {
		case SchemaType.ALL_OF:
			return {
				kind: ASTKind.INTERSECTION,
				default: schema.default,
				meta,
				keyName,
				standaloneName,
				params:
					schema.allOf?.map((subschema) =>
						parse({ ...otherParams, schema: subschema, keyName: undefined })
					) ?? [],
			};

		case SchemaType.ANY_OF: {
			const params = schema.anyOf?.map((subschema) =>
				parse({ ...otherParams, schema: subschema, keyName: undefined })
			);

			assert(params, 'Schema should have anyOf params');

			return {
				kind: ASTKind.UNION,
				default: schema.default,
				meta,
				keyName,
				standaloneName,
				params,
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

		case SchemaType.NAMED_ENUM: {
			return {
				kind: ASTKind.ENUM,
				default: schema.default,
				meta,
				keyName,
				standaloneName,
				params: Object.entries(schema.enum ?? {}).map(([key, value]) => ({
					keyName: key,
					ast: parseLiteral({ schema: value, keyName: undefined }),
				})),
			};
		}

		case SchemaType.UNNAMED_ENUM: {
			return {
				kind: ASTKind.ENUM,
				default: schema.default,
				meta,
				keyName,
				standaloneName,
				params: Object.entries(schema.enum ?? {}).map(([key, value]) => ({
					keyName: key,
					ast: parseLiteral({ schema: value, keyName: undefined }),
				})),
			};
		}

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
				params: {
					minLength: schema.minLength,
					maxLength: schema.maxLength,
					pattern: schema.pattern,
					format: schema.format,
				},
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
				params: {
					minimum: schema.minimum,
					maximum: schema.maximum,
					exclusiveMinimum: schema.exclusiveMinimum,
					exclusiveMaximum: schema.exclusiveMaximum,
					multipleOf: schema.multipleOf,
				},
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

		// TODO: remove once we handle all schema types
		default:
			throw new Error('Unsupported schema type: ' + schemaType);
	}

	// schemaType satisfies never;
}

interface ParseLiteralParams {
	schema: JSONSchemaType;
	keyName?: string;
}

function parseLiteral({ schema, keyName }: ParseLiteralParams): ASTNode {
	return {
		kind: ASTKind.LITERAL,
		keyName,
		params: schema,
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
		params: parseProperties({ ...otherParams, schema }),
		superTypes: [],
	};
}

type ParsePropertiesParams = ParseParams;

function parseProperties({
	schema,
	...otherParams
}: ParsePropertiesParams): ObjectParam[] {
	let asts: ObjectParam[] = Object.entries(schema.properties ?? {}).map(
		([key, subschema]) => {
			return {
				ast: parse({ ...otherParams, schema: subschema, keyName: key }),
				isPatternProperty: false,
				isRequired: schema.required?.includes(key) ?? false,
				isUnreachableDefinition: false,
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

	// TODO: decide about generating TS code for unused definitions.
	// if (options.unreachableDefinitions) {
	//   asts = asts.concat(
	//     map(schema.$defs, (value, key: string) => {
	//       const ast = parse(value, options, key, processed, usedNames);
	//       return {
	//         ast,
	//         isPatternProperty: false,
	//         isRequired: includes(schema.required || [], key),
	//         isUnreachableDefinition: true,
	//         keyName: key,
	//       };
	//     }),
	//   );
	// }

	switch (schema.additionalProperties) {
		case true:
			if (singlePatternProperty) {
				return asts;
			}

			return asts.concat({
				ast: UNKNOWN_ADDITIONAL_PROPERTIES,
				isPatternProperty: false,
				isRequired: true,
				isUnreachableDefinition: false,
				keyName: '[k: string]',
			});

		default:
			return asts;

		// TODO: verify validity for zod generator
		// pass "true" as the last param because in TS, properties
		// defined via index signatures are already optional
		// default:
		// 	return asts.concat({
		// 		ast: parse({
		// 			...otherParams,
		// 			schema: schema.additionalProperties,
		// 			keyName: '[k: string]',
		// 		}),
		// 		isPatternProperty: false,
		// 		isRequired: true,
		// 		isUnreachableDefinition: false,
		// 		keyName: '[k: string]',
		// 	});
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

				assert(subschema, 'Schema should not have undefined properties');

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
 * Compute a schema name using a series of fallbacks
 */
function computeStandaloneName({
	schema,
	keyNameFromDefinition,
	usedNames,
}: StandaloneNameParams): string | undefined {
	// if (options.customName) {
	// 	return options.customName(schema, keyNameFromDefinition);
	// }

	const name = schema.title || schema.$id || keyNameFromDefinition;
	if (name) {
		return generateName(name, usedNames);
	}
}
