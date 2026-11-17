import { Meta, type ParsedJSONSchema, type ParsedJSONSchemaObject } from '@utilize/json-schema';
import toposort from 'toposort';

import { breakReferenceCycles } from './breakReferenceCycles';
import { collectStandaloneSchemas } from './collectStandaloneSchemas';
import { unsupportedUnionCycleError } from './errors';
import { findCyclicSchemas } from './findCyclicSchemas';
import { generateSchema } from './generators/generateSchema';
import type { GeneratorContext } from './generators/types';
import { mapName, resolveName, type CustomNameResolver, type NameMapper } from './resolveName';
import { NEWLINE, ts } from './utils';
import { renderValueTypeDeclaration, type ValueTypeContext } from './valueTypes';

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
}

interface ResolvedNames {
	/** Variable that holds the generated schema. */
	schema: string;
	/** Type exported for the schema. */
	type: string;
}

export function generate(root: ParsedJSONSchema, options: GenerateOptions = {}): string {
	const usedNames = new Set<string>(['z']);

	if (typeof root !== 'object' || root === null) {
		return generateSchema(root, {
			usedNames,
			lazyRefs: new Set(),
			readOnlyKeyword: options.readOnlyKeyword,
			nameOf: () => {
				throw new Error('A primitive schema cannot reference another schema.');
			},
		});
	}

	const { schemas: standaloneSchemas, edges } = collectStandaloneSchemas(root);
	const { schemas: cyclicSchemas, unsupported } = findCyclicSchemas(edges, standaloneSchemas);

	if (unsupported.length > 0) {
		throw unsupportedUnionCycleError(unsupported);
	}

	const broken = breakReferenceCycles(edges, new Set(standaloneSchemas));

	const sorted = (toposort(broken.edges).filter(Boolean) as ParsedJSONSchemaObject[])
		.filter((schema) => standaloneSchemas.includes(schema))
		.reverse();

	const nameCache = new Map<ParsedJSONSchemaObject, ResolvedNames>();
	const aliases = new Map<ParsedJSONSchemaObject, string>();

	function allocateName(base: string): string {
		let name = base;
		let counter = 1;

		while (usedNames.has(name)) {
			name = `${base}${counter++}`;
		}

		usedNames.add(name);
		return name;
	}

	/**
	 * `resolveName` has already reserved the resolved name, so a mapper that keeps
	 * it needs no new one.
	 */
	function allocateMappedName(
		defaultName: string,
		mapper: NameMapper | undefined,
		sharedName?: string
	): string {
		const mapped = mapName(defaultName, mapper);

		if (mapped === sharedName) {
			return mapped;
		}

		if (mapped !== defaultName || !usedNames.has(mapped)) {
			return allocateName(mapped);
		}

		return mapped;
	}

	function ensureNames(schema: ParsedJSONSchemaObject): ResolvedNames {
		const existing = nameCache.get(schema);

		if (existing) {
			return existing;
		}

		const defaultName =
			schema[Meta].resolvedName ??
			resolveName({
				schema,
				usedNames,
				customResolver: options.customNameResolver,
			});

		schema[Meta].resolvedName = defaultName;

		const schemaName = allocateMappedName(defaultName, options.schemaName);
		const names: ResolvedNames = {
			schema: schemaName,
			type: allocateMappedName(defaultName, options.typeName, schemaName),
		};

		nameCache.set(schema, names);
		return names;
	}

	const context: GeneratorContext = {
		usedNames,
		lazyRefs: broken.lazyRefs,
		readOnlyKeyword: options.readOnlyKeyword,
		nameOf: (schema) => ensureNames(schema).schema,
	};

	const valueTypeContext: ValueTypeContext = {
		aliasFor: (schema) => {
			if (!cyclicSchemas.has(schema)) {
				return undefined;
			}

			let alias = aliases.get(schema);

			if (!alias) {
				alias = allocateName(`${ensureNames(schema).schema}Value`);
				aliases.set(schema, alias);
			}

			return alias;
		},
		typeNameFor: (schema) => ensureNames(schema).type,
		readOnlyKeyword: options.readOnlyKeyword,
	};

	const code: string[] = [];
	if (options.importZod ?? true) {
		code.push(ts`import { z } from 'zod';${NEWLINE}`);
	}

	for (const schema of sorted) {
		const { schema: schemaName, type: typeName } = ensureNames(schema);
		const alias = valueTypeContext.aliasFor(schema);
		const zodExpression = generateSchema(schema, context);

		if (alias) {
			code.push(renderValueTypeDeclaration(alias, schema, valueTypeContext));
			code.push(ts`export const ${schemaName}: z.ZodType<${alias}> = ${zodExpression};`);
		} else {
			code.push(ts`export const ${schemaName} = ${zodExpression};`);
		}

		code.push(ts`export type ${typeName} = z.infer<typeof ${schemaName}>;`);
		code.push(NEWLINE);
	}

	if (context.usesOneOf) {
		code.splice((options?.importZod ?? true) ? 1 : 0, 0, ONE_OF_HELPER + NEWLINE);
	}

	return code.join(NEWLINE);
}

const ONE_OF_HELPER = ts`function oneOfSchema<T extends z.ZodType>(
  options: readonly T[]
): z.ZodType<z.output<T>, z.input<T>> {
  return z.any().transform((value, ctx) => {
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

    if (matches.length !== 1) {
      ctx.addIssue({
        code: 'custom',
        message: 'Value must match exactly one "oneOf" schema.',
      });

      return z.NEVER;
    }

    return matches[0]!;
  }) as z.ZodType<z.output<T>, z.input<T>>;
}`;
