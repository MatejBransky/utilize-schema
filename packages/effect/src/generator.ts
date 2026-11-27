import {
	allocateName,
	allocateRuntimeNames,
	collectStandaloneSchemas,
	createRuntimeGuard,
	dialectOf,
	expectDefined,
	formatNameFor,
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
	const {
		runtimeGuard,
		generationRoot,
		objectRoot,
		standalone,
		cyclic,
		valueAliases,
		rootNames,
		definitionNames,
		typeNames,
		formatNames,
		usedNames,
		declaredSchemas,
		internalNames,
		validatorName,
	} = prepareGeneration();

	function prepareGeneration() {
		const runtimeGuard = createRuntimeGuard(root);
		const generationRoot = runtimeGuard?.shape ?? root;
		const objectRoot = isParsedJSONSchemaObject(generationRoot) ? generationRoot : undefined;
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
		const formatNames = new Map<string, string>();
		const usedNames = new Set(RESERVED_NAMES);

		for (const names of [...definitionNames.values(), rootNames]) {
			usedNames.add(names.schema);
			usedNames.add(names.type);
		}

		const declaredSchemas = objectRoot ? [...standalone, objectRoot] : [];
		const { internalNames, validatorName } = allocateRuntimeNames(
			runtimeGuard,
			declaredSchemas,
			(schema) =>
				schema === objectRoot
					? rootNames.schema
					: expectDefined(definitionNames.get(schema)).schema,
			typeNames,
			usedNames
		);

		return {
			runtimeGuard,
			generationRoot,
			objectRoot,
			standalone,
			cyclic,
			valueAliases,
			rootNames,
			definitionNames,
			typeNames,
			formatNames,
			usedNames,
			declaredSchemas,
			internalNames,
			validatorName,
		};
	}

	const valueTypeContext: ValueTypeContext = {
		dialect: dialectOf(generationRoot),
		customSchemaResolver: options.customSchemaResolver,
		aliasFor(schema) {
			return cyclic.has(schema) || hasStructuredLiteral(schema) ? aliasOf(schema) : undefined;
		},
		typeNameFor(schema) {
			return expectDefined(namesOf(schema)).type;
		},
	};

	let jsonLiteralName: string | undefined;

	const context: Context = {
		formatOf: (format) => formatNameFor(format, formatNames, usedNames),
		jsonLiteralCall(value) {
			jsonLiteralName ??= allocateName('jsonLiteral', usedNames);

			return `${jsonLiteralName}<${literalType(value)}>(${JSON.stringify(canonicalJson(value))})`;
		},
		nameOf(schema, ref) {
			const names = namesOf(schema);

			if (names === undefined) {
				throw new UnresolvedReferenceError(ref);
			}

			return internalNames.get(schema) ?? names.schema;
		},
		isCyclic(schema) {
			return cyclic.has(schema);
		},
		dialect: dialectOf(generationRoot),
		formatMode: options.formatMode,
		generateSchema,
		customSchemaResolver: options.customSchemaResolver,
	};

	return renderParts();

	function renderDeclarations(): string[] {
		const declarations: string[] = [];

		if (runtimeGuard && validatorName) {
			for (const schema of declaredSchemas) {
				declarations.push(renderInternalDeclaration(schema));
			}

			for (const schema of declaredSchemas) {
				declarations.push(renderGuardedDeclaration(schema, validatorName));
			}

			return declarations;
		}

		for (const schema of standalone) {
			declarations.push(renderDeclaration(expectDefined(definitionNames.get(schema)), schema));
		}

		declarations.push(renderDeclaration(rootNames, generationRoot));
		return declarations;
	}

	function renderParts(): string {
		const declarations = renderDeclarations();
		const parts: string[] = [];

		if (options.importEffect ?? true) {
			parts.push("import { Schema } from 'effect';");
		}

		if (runtimeGuard && validatorName) {
			parts.push(
				"import { createJsonSchemaValidator } from '@utilize/json-schema/runtime';",
				`const ${validatorName} = createJsonSchemaValidator(${JSON.stringify(JSON.stringify(runtimeGuard.bundle))}, ${JSON.stringify(options.formatMode ?? 'assert')});`
			);
		}

		// Rendering declarations registered the formats they use.
		for (const [format, name] of formatNames) {
			parts.push(`const ${name} = ${expectDefined(formatCheck(format))};`);
		}

		if (jsonLiteralName !== undefined) {
			parts.push(`const ${jsonLiteralName} = ${jsonLiteralHelper()};`);
		}

		parts.push(...declarations);
		return `${parts.join('\n\n')}\n`;
	}

	function renderInternalDeclaration(schema: ParsedJSONSchemaObject): string {
		const alias = valueTypeContext.aliasFor(schema);
		const expression = generateSchema(schema, context);
		const internalName = expectDefined(internalNames.get(schema));
		const declaration =
			alias === undefined
				? `const ${internalName} = ${expression};`
				: `const ${internalName}: Schema.Codec<${alias}> = ${expression};`;

		return alias === undefined
			? declaration
			: [renderValueTypeDeclaration(alias, schema, valueTypeContext), declaration].join('\n\n');
	}

	function renderGuardedDeclaration(schema: ParsedJSONSchemaObject, validator: string): string {
		const names = expectDefined(namesOf(schema));
		const internalName = expectDefined(internalNames.get(schema));
		const ref = runtimeGuard?.refFor(schema) ?? '';
		const source = `Schema.Unknown.check(Schema.makeFilter((value) => ${validator}(value, ${JSON.stringify(ref)}) ? undefined : 'Value does not match the JSON Schema'))`;
		const expression = `Schema.decodeTo(${internalName})(${source})`;

		return `export const ${names.schema} = ${expression};\n\nexport type ${names.type} = typeof ${names.schema}.Type;`;
	}

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
