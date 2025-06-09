import {
	ASTKind,
	ASTNode,
	ASTNodeWithStandaloneName,
	toSafeString,
} from '@utilize/json-schema-core';
import { logger } from '@utilize/json-schema-core/src/logger';

import { collectSchemasInDependencyOrder } from './utils';

const log = logger.withNamespace('zod-generator');

const NEWLINE = '\n';
const ts = String.raw;

/**
 * Generates Zod schemas and corresponding TypeScript types from an AST representation
 * derived from JSON Schema Draft 7 definitions.
 *
 * For each schema node, this function emits both the Zod runtime validation schema
 * and the associated TypeScript type using `z.infer<typeof ...>`.
 *
 * The generator is designed to support all features expressible in JSON Schema Draft 7,
 * within the capabilities and limitations of Zod and TypeScript.
 *
 * @param node - The AST node representing the normalized JSON Schema structure.
 * @returns The generated Zod schema and inferred TypeScript type.
 */
export function generate(ast: ASTNode) {
	const zodImport = ts`import { z } from 'zod';${NEWLINE}`;
	const ordered = collectSchemasInDependencyOrder(ast);
	const body = ordered.map(generateNamedSchema).join(NEWLINE + NEWLINE);

	return [zodImport, body].filter(Boolean).join('\n\n');
}

function generateNamedSchema(ast: ASTNodeWithStandaloneName) {
	const name = toSafeString(ast.standaloneName);
	const schemaStr = generateZodSchema(ast);

	return ts`
    export const ${name} = ${schemaStr};
    export type ${name} = z.infer<typeof ${name}>;
  `;
}

function generateZodSchema(ast: ASTNode) {
	const astKind = ast.kind;

	log.debug(
		`Generating Zod schema for AST kind: ${astKind}`,
		JSON.stringify(ast, null, 2)
	);

	switch (astKind) {
		case ASTKind.STRING:
			return ts`z.string()`;

		case ASTKind.NUMBER:
			return ts`z.number()`;

		case ASTKind.INTEGER:
			return ts`z.int()`;

		case ASTKind.BOOLEAN:
			return ts`z.boolean()`;

		case ASTKind.NULL:
			return ts`z.null()`;

		case ASTKind.LITERAL:
			return ts`z.literal(${JSON.stringify(ast.params)})`;

		case ASTKind.ARRAY:
			return ts`z.array(${generateZodSchema(ast.params)})`;

		case ASTKind.TUPLE: {
			const items = ast.params.map(generateZodSchema);
			const spread = ast.spreadParam ? generateZodSchema(ast.spreadParam) : '';
			return spread
				? ts`z.tuple([${items.join(', ')}]).rest(${spread})`
				: ts`z.tuple([${items.join(', ')}])`;
		}

		case ASTKind.UNION:
			return ts`z.union([${ast.params.map(generateZodSchema).join(', ')}])`;

		case ASTKind.INTERSECTION:
			return ast.params
				.map(generateZodSchema)
				.reduce((a, b) => `${a}.and(${b})`);

		case ASTKind.ENUM: {
			const literalNodes = ast.params;
			return ts`z.enum([${literalNodes.map((literalNode) => JSON.stringify(literalNode.ast.params)).join(', ')}])`;
		}

		case ASTKind.OBJECT: {
			const entries = ast.params.map(
				({ keyName, ast: paramAst, isRequired }) =>
					`${JSON.stringify(keyName)}: ${generateZodSchema(paramAst)}${isRequired ? '' : '.optional()'}`
			);
			return ts`
        z.object({
          ${entries.join(`,${NEWLINE}`)}
        })
      `;
		}

		case ASTKind.ANY:
			return ts`z.any()`;

		case ASTKind.UNKNOWN:
			return ts`z.unknown()`;
	}

	astKind satisfies never;
}
