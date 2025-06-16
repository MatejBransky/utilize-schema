import {
	ADDITIONAL_PROPERTY_KEY_NAME,
	ASTKind,
	type ASTNode,
	type ASTNodeWithStandaloneName,
	toSafeString,
} from '@utilize/json-schema-core';

import { formatToZodMethod } from './string';
import { collectSchemasInDependencyOrder } from './utils';

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

function generateZodSchema(ast: ASTNode): string {
	const astKind = ast.kind;
	let expression: string;

	switch (astKind) {
		case ASTKind.STRING:
			expression = ts`z.string()`;

			if (ast.minLength !== undefined) {
				expression += `.min(${ast.minLength})`;
			}

			if (ast.maxLength !== undefined) {
				expression += `.max(${ast.maxLength})`;
			}

			if (ast.pattern) {
				expression += `.regex(${new RegExp(ast.pattern)})`;
			}

			if (ast.format) {
				const zodMethod = formatToZodMethod[ast.format];
				if (zodMethod) {
					expression += zodMethod;
				} else {
					console.warn?.(`Unsupported string format: ${ast.format}`);
				}
			}

			break;

		case ASTKind.NUMBER:
			expression = applyNumberConstraints(ts`z.number()`, ast);
			break;

		case ASTKind.INTEGER:
			expression = applyNumberConstraints(ts`z.int()`, ast);
			break;

		case ASTKind.BOOLEAN:
			expression = ts`z.boolean()`;
			break;

		case ASTKind.NULL:
			expression = ts`z.null()`;
			break;

		case ASTKind.LITERAL:
			expression = ts`z.literal(${JSON.stringify(ast.value)})`;
			break;

		case ASTKind.ARRAY: {
			expression = ts`z.array(${resolveZodSchema(ast.items)})`;
			if (ast.minItems !== undefined && ast.minItems > 0) {
				expression = ts`${expression}.min(${ast.minItems})`;
			}
			if (ast.maxItems !== undefined) {
				expression = ts`${expression}.max(${ast.maxItems})`;
			}
			break;
		}

		case ASTKind.TUPLE: {
			const items = ast.items.map(resolveZodSchema);
			const spread = ast.spreadParam ? resolveZodSchema(ast.spreadParam) : '';
			expression = spread
				? ts`z.tuple([${items.join(', ')}], ${spread})`
				: ts`z.tuple([${items.join(', ')}])`;
			break;
		}

		case ASTKind.UNION:
			expression = ts`z.union([${ast.nodes.map(resolveZodSchema).join(', ')}])`;
			break;

		case ASTKind.INTERSECTION:
			expression = ast.nodes.map(resolveZodSchema).reduce(
				(a, b) => ts`z.intersection(
          ${a},
          ${b},
        )`
			);
			break;

		case ASTKind.ENUM: {
			expression = ts`z.enum([${ast.values.map((value) => (typeof value === 'string' ? `"${value}"` : value)).join(', ')}])`;
			break;
		}

		case ASTKind.OBJECT: {
			const entries = ast.properties
				.filter(({ keyName }) => keyName !== ADDITIONAL_PROPERTY_KEY_NAME)
				.map(
					({ keyName, ast: propertyAst, isRequired }) =>
						`${JSON.stringify(keyName)}: ${resolveZodSchema(propertyAst)}${isRequired ? '' : '.optional()'}`
				);

			const catchallProp = ast.properties.find(
				(p) => p.keyName === ADDITIONAL_PROPERTY_KEY_NAME
			);
			const catchall = catchallProp
				? `.catchall(${resolveZodSchema(catchallProp.ast)})`
				: '';

			expression = ts`
        z.object({
          ${entries.join(`,${NEWLINE}`)}
        })${catchall}
      `;
			break;
		}

		case ASTKind.ANY:
			expression = ts`z.any()`;
			break;

		case ASTKind.UNKNOWN:
			expression = ts`z.unknown()`;
			break;

		default:
			throw new Error('Unsupported AST kind: ' + astKind);
	}

	if ('default' in ast && ast.default !== undefined) {
		expression = `${expression}.default(${JSON.stringify(ast.default)})`;
	}

	if (ast.meta?.title || ast.meta?.description) {
		const { title, description } = ast.meta;
		expression = ts`${expression}.meta(${JSON.stringify({ title, description })})`;
	}

	return expression;
}

function applyNumberConstraints(
	base: string,
	ast: {
		minimum?: number;
		maximum?: number;
		exclusiveMinimum?: number;
		exclusiveMaximum?: number;
		multipleOf?: number;
	}
): string {
	if (ast.minimum !== undefined) {
		base += `.min(${ast.minimum})`;
	}
	if (ast.maximum !== undefined) {
		base += `.max(${ast.maximum})`;
	}
	if (ast.exclusiveMinimum !== undefined) {
		base += `.gt(${ast.exclusiveMinimum})`;
	}
	if (ast.exclusiveMaximum !== undefined) {
		base += `.lt(${ast.exclusiveMaximum})`;
	}
	if (ast.multipleOf !== undefined) {
		base += `.multipleOf(${ast.multipleOf})`;
	}
	return base;
}

function resolveZodSchema(ast: ASTNode): string {
	if (ast.standaloneName) {
		return ast.standaloneName;
	}
	return generateZodSchema(ast);
}
