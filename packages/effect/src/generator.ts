import {
	allocateName,
	collectStandaloneSchemas,
	dialectOf,
	expectDefined,
	isParsedJSONSchemaObject,
	mapDeclarationNames,
	Meta,
	resolveName,
} from '@utilize/json-schema';
import type {
	DeclarationNames,
	ParsedJSONSchema,
	ParsedJSONSchemaObject,
	SchemaEdge,
} from '@utilize/json-schema';

import type { Context, GenerateOptions } from './context';
import { FALLBACK_ROOT_NAME, RESERVED_NAMES } from './context';
import { generateSchema } from './dispatch';
import { UnresolvedReferenceError } from './errors';
import { findCyclicSchemas } from './findCyclicSchemas';
import { formatCheck } from './formats';
import { canonicalJson, hasStructuredLiteral, jsonLiteralHelper } from './literals';
import { formatConstantBase } from './string';
import { literalType, renderValueTypeDeclaration } from './valueTypes';
import type { ValueTypeContext } from './valueTypes';

// `generator.ts` is the entry the playground maps `@utilize/effect` to, so the
// option types stay reachable from here even though they are declared in
// `context.ts`. `FormatMode` is not part of that surface; import it from
// `context.ts` or the package barrel.
export type { CustomSchemaResolver, GenerateOptions } from './context';

/**
 * Generates Effect Schema (v4) code from a linked JSON Schema.
 *
 * The output mirrors the Zod generator: one exported const and one exported
 * type per standalone schema. Every `$ref` is emitted as `Schema.suspend`, so
 * recursive and mutually recursive schemas work without a topological sort.
 */
export function generate(root: ParsedJSONSchema, options: GenerateOptions = {}): string {
	const objectRoot = isParsedJSONSchemaObject(root) ? root : undefined;
	const collected = objectRoot
		? collectStandaloneSchemas(objectRoot)
		: { schemas: [], edges: [] satisfies SchemaEdge[] };
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
			return cyclic.has(schema) || hasStructuredLiteral(schema) ? aliasOf(schema) : undefined;
		},
		typeNameFor(schema) {
			return expectDefined(namesOf(schema)).type;
		},
	};

	const formatNames = new Map<string, string>();
	const usedNames = new Set(RESERVED_NAMES);

	for (const names of [...definitionNames.values(), rootNames]) {
		usedNames.add(names.schema);
		usedNames.add(names.type);
	}

	let jsonLiteralName: string | undefined;

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
		jsonLiteralCall(value) {
			jsonLiteralName ??= allocateName('jsonLiteral', usedNames);

			return `${jsonLiteralName}<${literalType(value)}>(${JSON.stringify(canonicalJson(value))})`;
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
		generateSchema,
		customSchemaResolver: options.customSchemaResolver,
	};

	const declarations: string[] = [];

	for (const schema of standalone) {
		declarations.push(renderDeclaration(expectDefined(definitionNames.get(schema)), schema));
	}

	declarations.push(renderDeclaration(rootNames, root));

	const parts: string[] = [];

	if (options.importEffect ?? true) {
		parts.push("import { Schema } from 'effect';");
	}

	// Declarations rendered above registered the formats they use, so the
	// constants can be emitted once, before any schema that references them.
	for (const [format, name] of formatNames) {
		parts.push(`const ${name} = ${expectDefined(formatCheck(format))};`);
	}

	if (jsonLiteralName !== undefined) {
		parts.push(`const ${jsonLiteralName} = ${jsonLiteralHelper()};`);
	}

	parts.push(...declarations);

	return `${parts.join('\n\n')}\n`;

	function renderDeclaration(names: DeclarationNames, schema: ParsedJSONSchema): string {
		const object = isParsedJSONSchemaObject(schema) ? schema : undefined;
		const alias = object === undefined ? undefined : valueTypeContext.aliasFor(object);
		const expression = generateSchema(schema, context);
		const declaration =
			alias === undefined
				? `export const ${names.schema} = ${expression};`
				: `export const ${names.schema}: Schema.Codec<${alias}> = ${expression};`;
		const lines =
			alias === undefined
				? []
				: [renderValueTypeDeclaration(alias, expectDefined(object), valueTypeContext)];

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

		const alias = allocateName(`${expectDefined(namesOf(schema)).schema}Value`, typeNames);

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
		rootNames: expectDefined(rootNames),
		definitionNames: new Map(
			standalone.map((schema, index) => [schema, expectDefined(standaloneNames[index])])
		),
		typeNames: mapped.typeNames,
	};
}
