import { Meta, type ParsedJSONSchema } from '@utilize/json-schema';

import { collectStandaloneSchemas } from './collectStandaloneSchemas';
import { generateSchema } from './generators/generateSchema';
import { resolveName } from './resolveName';
import { sortSchemasByDependency } from './sorter';
import { NEWLINE, ts } from './utils';

export function generate(
	root: ParsedJSONSchema,
	options?: { importZod?: boolean }
): string {
	const usedNames = new Set<string>();

	if (typeof root !== 'object' || root === null) {
		return generateSchema(root, { usedNames });
	}

	const standaloneSchemas = collectStandaloneSchemas(root);
	const sorted = sortSchemasByDependency(standaloneSchemas);

	const code: string[] = [];
	if (options?.importZod ?? true) {
		code.push(ts`import { z } from 'zod';${NEWLINE}`);
	}

	for (const schema of sorted) {
		const name =
			schema[Meta].resolvedName ?? resolveName({ schema, usedNames });
		schema[Meta].resolvedName = name;
		const zodExpression = generateSchema(schema, { usedNames });

		code.push(ts`export const ${name} = ${zodExpression};`);
		code.push(ts`export type ${name} = z.infer<typeof ${name}>;`);
		code.push(NEWLINE);
	}

	return code.join(NEWLINE);
}
