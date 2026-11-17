import { Meta, type ParsedJSONSchema, type ParsedJSONSchemaObject } from '@utilize/json-schema';
import toposort from 'toposort';

import { breakReferenceCycles } from './breakReferenceCycles';
import { collectStandaloneSchemas } from './collectStandaloneSchemas';
import { unsupportedUnionCycleError } from './errors';
import { findCyclicSchemas } from './findCyclicSchemas';
import { generateSchema } from './generators/generateSchema';
import type { GeneratorContext } from './generators/types';
import { resolveName, type CustomNameResolver } from './resolveName';
import { NEWLINE, ts } from './utils';
import { renderValueTypeDeclaration, type ValueTypeContext } from './valueTypes';

export function generate(
	root: ParsedJSONSchema,
	options?: { importZod?: boolean; customNameResolver?: CustomNameResolver }
): string {
	const usedNames = new Set<string>(['z']);
	const lazyRefs = new Set<ParsedJSONSchemaObject>();

	if (typeof root !== 'object' || root === null) {
		return generateSchema(root, { usedNames, lazyRefs });
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

	const context: GeneratorContext = {
		usedNames,
		lazyRefs: broken.lazyRefs,
	};

	const aliases = new Map<ParsedJSONSchemaObject, string>();
	const typeNames = new Set<string>(['z']);

	function ensureName(schema: ParsedJSONSchemaObject): string {
		const existing = schema[Meta].resolvedName;

		if (existing) {
			return existing;
		}

		const name = resolveName({
			schema,
			usedNames,
			customResolver: options?.customNameResolver,
		});

		schema[Meta].resolvedName = name;
		return name;
	}

	function allocateTypeName(base: string): string {
		let name = base;
		let counter = 1;

		while (usedNames.has(name) || typeNames.has(name)) {
			name = `${base}${counter++}`;
		}

		typeNames.add(name);
		usedNames.add(name);
		return name;
	}

	const valueTypeContext: ValueTypeContext = {
		aliasFor: (schema) => {
			if (!cyclicSchemas.has(schema)) {
				return undefined;
			}

			let alias = aliases.get(schema);

			if (!alias) {
				alias = allocateTypeName(`${ensureName(schema)}Value`);
				aliases.set(schema, alias);
			}

			return alias;
		},
		typeNameFor: (schema) => ensureName(schema),
	};

	const code: string[] = [];
	if (options?.importZod ?? true) {
		code.push(ts`import { z } from 'zod';${NEWLINE}`);
	}

	for (const schema of sorted) {
		const name = ensureName(schema);
		const alias = valueTypeContext.aliasFor(schema);
		const zodExpression = generateSchema(schema, context);

		if (alias) {
			code.push(renderValueTypeDeclaration(alias, schema, valueTypeContext));
			code.push(ts`export const ${name}: z.ZodType<${alias}> = ${zodExpression};`);
		} else {
			code.push(ts`export const ${name} = ${zodExpression};`);
		}

		code.push(ts`export type ${name} = z.infer<typeof ${name}>;`);
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
