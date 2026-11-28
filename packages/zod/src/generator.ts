import {
	collectStandaloneSchemas,
	dialectOf,
	expectDefined,
	formatConstantBase,
	formatNameFor,
	formatRuntimeModule,
	Meta,
} from '@utilize/json-schema';
import type { ParsedJSONSchema, ParsedJSONSchemaObject } from '@utilize/json-schema';
import toposort from 'toposort';

import { breakReferenceCycles } from './breakReferenceCycles';
import { unsupportedUnionCycleError } from './errors';
import { findCyclicSchemas } from './findCyclicSchemas';
import { findInlineCopies } from './inlineCopies';
import { generateSchema } from './generators/generateSchema';
import type {
	CustomSchemaResolver,
	FormatMap,
	FormatMode,
	GeneratorContext,
} from './generators/types';

export type { CustomSchemaResolver, FormatMap, FormatMode } from './generators/types';
import { allocateName, mapDeclarationNames, resolveHoistedName, resolveName } from './resolveName';
import type { CustomNameResolver, DeclarationNames, NameMapper } from './resolveName';
import { isResolvedByCaller, NEWLINE, ts } from './utils';
import { renderValueTypeDeclaration } from './valueTypes';
import type { ValueTypeContext } from './valueTypes';

export interface GenerateOptions {
	/** Emit `import { z } from 'zod';` at the top of the generated code. */
	importZod?: boolean;
	/** Overrides the name resolved from a standalone schema. */
	customNameResolver?: CustomNameResolver;
	/** Rewrites the variable that holds each generated schema. Receives the resolved name. */
	schemaName?: NameMapper;
	/** Rewrites the type exported for each generated schema. Receives the resolved name. */
	typeName?: NameMapper;
	/** Map `readOnly: true` to `.readonly()`; off by default because it changes the value type. */
	readOnlyKeyword?: boolean;
	/** Maps a `format` to a Zod expression; it applies in both modes, other formats follow `formatMode`. */
	formatMap?: FormatMap;
	/**
	 * What `format` becomes in the generated code: `assert` (default) validates
	 * known formats (`.email()`, …), `annotate` keeps `format` as
	 * `.meta({ format })`.
	 */
	formatMode?: FormatMode;
	/** Emits a caller-provided Zod expression for a matching schema node. */
	customSchemaResolver?: CustomSchemaResolver;
	/**
	 * Module the generated code imports the `oneOfSchema` helper from, e.g.
	 * `@utilize/zod/runtime`, instead of declaring its own copy in every file.
	 */
	runtimeImport?: string;
}

/** Names the generated code uses besides the declarations. */
const RESERVED_NAMES = ['z'];

export function generate(root: ParsedJSONSchema, options: GenerateOptions = {}): string {
	if (typeof root !== 'object' || root === null) {
		return generatePrimitive(root, options);
	}

	const { copies, hoisted } = findInlineCopies(collectStandaloneSchemas(root).schemas, (schema) =>
		isResolvedByCaller(options.customSchemaResolver, schema)
	);
	const { schemas: standaloneSchemas, edges } = collectStandaloneSchemas(root, {
		inlineCopies: copies,
	});
	const { schemas: cyclicSchemas, unsupported } = findCyclicSchemas(edges, standaloneSchemas);

	if (unsupported.length > 0) {
		throw unsupportedUnionCycleError(unsupported);
	}

	const broken = breakReferenceCycles(edges, new Set(standaloneSchemas), copies);

	const sorted = toposort(broken.edges)
		.filter((schema): schema is ParsedJSONSchemaObject => schema !== null)
		.filter((schema) => standaloneSchemas.includes(schema))
		.reverse();

	const hoistedSet = new Set(hoisted);
	const { names, typeNames } = nameDeclarations(
		[...sorted, ...standaloneSchemas.filter((schema) => !sorted.includes(schema))].filter(
			(schema) => !hoistedSet.has(schema)
		),
		hoisted,
		options
	);
	const aliases = new Map<ParsedJSONSchemaObject, string>();
	const formatNames = new Map<string, string>();
	const usedNames = usedNamesFor(names.values(), typeNames);

	function namesOf(schema: ParsedJSONSchemaObject): DeclarationNames {
		const declarationNames = names.get(schema);

		if (!declarationNames) {
			throw new Error('A referenced schema has no generated declaration.');
		}

		return declarationNames;
	}

	const context: GeneratorContext = {
		lazyRefs: broken.lazyRefs,
		readOnlyKeyword: options.readOnlyKeyword,
		formatMap: options.formatMap,
		formatMode: options.formatMode,
		nameOf: (schema) => namesOf(schema).schema,
		declarationOf: (schema) => copies.get(schema),
		dialect: dialectOf(root),
		customSchemaResolver: options.customSchemaResolver,
		formatOf: (format) => formatNameFor(format, formatNames, usedNames),
	};

	const valueTypeContext: ValueTypeContext = {
		dialect: dialectOf(root),
		customSchemaResolver: options.customSchemaResolver,
		aliasFor: (schema) => {
			if (!cyclicSchemas.has(schema)) {
				return undefined;
			}

			let alias = aliases.get(schema);

			if (!alias) {
				alias = allocateName(`${namesOf(schema).schema}Value`, typeNames);
				aliases.set(schema, alias);
			}

			return alias;
		},
		typeNameFor: (schema) => namesOf(schema).type,
		declarationOf: (schema) => copies.get(schema),
		readOnlyKeyword: options.readOnlyKeyword,
	};

	const code: string[] = [];
	if (options.importZod ?? true) {
		code.push(ts`import { z } from 'zod';${NEWLINE}`);
	}

	for (const schema of sorted) {
		const { schema: schemaName, type: typeName } = namesOf(schema);
		const alias = valueTypeContext.aliasFor(schema);
		const zodExpression = generateSchema(schema, context);

		if (alias) {
			code.push(
				renderValueTypeDeclaration(alias, schema, valueTypeContext),
				ts`export const ${schemaName}: z.ZodType<${alias}> = ${zodExpression};`
			);
		} else {
			code.push(ts`export const ${schemaName} = ${zodExpression};`);
		}

		code.push(ts`export type ${typeName} = z.infer<typeof ${schemaName}>;`, NEWLINE);
	}

	const importIndex = importIndexFor(options);

	code.splice(importIndex, 0, ...formatImportsFor(formatNames));
	code.splice(importIndex, 0, ...oneOfLines(context.usesOneOf, options.runtimeImport));

	return code.join(NEWLINE);
}

function generatePrimitive(
	root: Exclude<ParsedJSONSchema, ParsedJSONSchemaObject>,
	options: GenerateOptions
) {
	return generateSchema(root, {
		lazyRefs: new Set(),
		readOnlyKeyword: options.readOnlyKeyword,
		formatMap: options.formatMap,
		formatMode: options.formatMode,
		nameOf: () => {
			throw new Error('A primitive schema cannot reference another schema.');
		},
		dialect: dialectOf(root),
		customSchemaResolver: options.customSchemaResolver,
		formatOf: () => {
			throw new Error('A primitive schema cannot reference a format constant.');
		},
	});
}

function usedNamesFor(declarations: Iterable<DeclarationNames>, typeNames: Iterable<string>) {
	const usedNames = new Set(RESERVED_NAMES);

	for (const declaration of declarations) {
		usedNames.add(declaration.schema);
		usedNames.add(declaration.type);
	}

	for (const typeName of typeNames) {
		usedNames.add(typeName);
	}

	return usedNames;
}

function formatImportsFor(formatNames: Map<string, string>) {
	if (formatNames.size === 0) {
		return [];
	}

	const specifiers = [...formatNames].map(([format, name]) => {
		const exported = formatConstantBase(format);

		return exported === name ? exported : `${exported} as ${name}`;
	});

	return [
		ts`import { ${specifiers.join(', ')} } from ${singleQuoted(formatRuntimeModule)};${NEWLINE}`,
	];
}

function oneOfLines(usesOneOf: boolean | undefined, runtimeImport: string | undefined): string[] {
	if (!usesOneOf) {
		return [];
	}

	return [
		runtimeImport
			? ts`import { oneOfSchema } from ${singleQuoted(runtimeImport)};${NEWLINE}`
			: ONE_OF_HELPER + NEWLINE,
	];
}

function importIndexFor(options: GenerateOptions) {
	return (options.importZod ?? true) ? 1 : 0;
}

/**
 * Names every standalone schema in two passes: first the resolved names, which
 * stay unique among themselves, then the mapped names, which are allocated only
 * once every resolved name is known. A mapped name therefore never depends on
 * the order in which schemas are generated.
 *
 * Hoisted schemas are named last, so a schema the input names keeps its name
 * and a hoisted one takes the next free name.
 */
function nameDeclarations(
	namedSchemas: ParsedJSONSchemaObject[],
	hoistedSchemas: ParsedJSONSchemaObject[],
	options: GenerateOptions
) {
	const usedResolvedNames = new Set(RESERVED_NAMES);
	const schemas = [...namedSchemas, ...hoistedSchemas];
	const resolvedNames = schemas.map((schema, index) => {
		const resolve = index < namedSchemas.length ? resolveName : resolveHoistedName;
		const resolvedName =
			schema[Meta].resolvedName ??
			resolve({
				schema,
				usedNames: usedResolvedNames,
				customResolver: options.customNameResolver,
			});

		schema[Meta].resolvedName = resolvedName;
		return resolvedName;
	});
	const mapped = mapDeclarationNames(resolvedNames, {
		schemaName: options.schemaName,
		typeName: options.typeName,
		reservedNames: RESERVED_NAMES,
	});

	return {
		names: new Map(schemas.map((schema, index) => [schema, expectDefined(mapped.names[index])])),
		typeNames: mapped.typeNames,
	};
}

function singleQuoted(text: string): string {
	return `'${text.replaceAll('\\', String.raw`\\`).replaceAll("'", String.raw`\'`)}'`;
}

/** Declared in every file that needs it, unless `runtimeImport` is set. A test keeps it identical to `runtime.ts`. */
const ONE_OF_HELPER = ts`function oneOfSchema<T extends z.ZodType>(
  options: readonly T[]
): z.ZodType<z.output<T>, z.input<T>> {
  function matchingResults(value: unknown): z.output<T>[] {
    const matches: z.output<T>[] = [];

    for (const option of options) {
      const result = option.safeParse(value);

      if (result.success) {
        matches.push(result.data);

        if (matches.length > 1) {
          break;
        }
      }
    }

    return matches;
  }

  return z.any().transform((value, ctx) => {
    const matches = matchingResults(value);
    const [match] = matches;

    if (matches.length !== 1 || match === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'Value must match exactly one "oneOf" schema.',
      });

      return z.NEVER;
    }

    return match;
  }) as z.ZodType<z.output<T>, z.input<T>>;
}`;
