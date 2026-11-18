import { Meta, type ParsedJSONSchema, type ParsedJSONSchemaObject } from '@utilize/json-schema';
import toposort from 'toposort';

import { breakReferenceCycles } from './breakReferenceCycles';
import { collectStandaloneSchemas } from './collectStandaloneSchemas';
import { unsupportedUnionCycleError } from './errors';
import { findCyclicSchemas } from './findCyclicSchemas';
import { generateSchema } from './generators/generateSchema';
import type { GeneratorContext } from './generators/types';
import {
	allocateName,
	mapDeclarationNames,
	resolveName,
	type CustomNameResolver,
	type DeclarationNames,
	type NameMapper,
} from './resolveName';
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

/** Names the generated code uses besides the declarations. */
const RESERVED_NAMES = ['z'];

export function generate(root: ParsedJSONSchema, options: GenerateOptions = {}): string {
	if (typeof root !== 'object' || root === null) {
		return generateSchema(root, {
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

	const { names, typeNames } = nameDeclarations(
		[...sorted, ...standaloneSchemas.filter((schema) => !sorted.includes(schema))],
		options
	);
	const aliases = new Map<ParsedJSONSchemaObject, string>();

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
		nameOf: (schema) => namesOf(schema).schema,
	};

	const valueTypeContext: ValueTypeContext = {
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

/**
 * Names every standalone schema in two passes: first the resolved names, which
 * stay unique among themselves, then the mapped names, which are allocated only
 * once every resolved name is known. A mapped name therefore never depends on
 * the order in which schemas are generated.
 */
function nameDeclarations(schemas: ParsedJSONSchemaObject[], options: GenerateOptions) {
	const usedResolvedNames = new Set(RESERVED_NAMES);
	const resolvedNames = schemas.map((schema) => {
		const resolvedName =
			schema[Meta].resolvedName ??
			resolveName({
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
		names: new Map(schemas.map((schema, index) => [schema, mapped.names[index]!])),
		typeNames: mapped.typeNames,
	};
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
