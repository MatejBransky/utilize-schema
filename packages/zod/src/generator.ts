import {
	Meta,
	type ParsedJSONSchema,
	type ParsedJSONSchemaObject,
} from '@utilize/json-schema';
import toposort from 'toposort';

import { collectStandaloneSchemas } from './collectStandaloneSchemas';
import { generateSchema } from './generators/generateSchema';
import { resolveName, type CustomNameResolver } from './resolveName';
import { NEWLINE, ts } from './utils';

export function generate(
	root: ParsedJSONSchema,
	options?: { importZod?: boolean; customNameResolver?: CustomNameResolver }
): string {
	const usedNames = new Set<string>();

	if (typeof root !== 'object' || root === null) {
		return generateSchema(root, { usedNames });
	}

	const { schemas: standaloneSchemas, edges } = collectStandaloneSchemas(root);
	const sorted = (toposort(edges).filter(Boolean) as ParsedJSONSchemaObject[])
		.filter((schema) => standaloneSchemas.includes(schema))
		.reverse();

	const code: string[] = [];
	if (options?.importZod ?? true) {
		code.push(ts`import { z } from 'zod/v4';${NEWLINE}`);
	}

	for (const schema of sorted) {
		const name =
			schema[Meta].resolvedName ??
			resolveName({
				schema,
				usedNames,
				customResolver: options?.customNameResolver,
			});
		schema[Meta].resolvedName = name;

		const zodExpression = generateSchema(schema, { usedNames });

		code.push(ts`export const ${name} = ${zodExpression};`);
		code.push(ts`export type ${name} = z.infer<typeof ${name}>;`);
		code.push(NEWLINE);
	}

	return code.join(NEWLINE);
}
