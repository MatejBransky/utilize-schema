import { dialectOf } from '@utilize/json-schema';
import type { Dialect, ParsedJSONSchema, ParsedJSONSchemaObject } from '@utilize/json-schema';

import { withoutAlwaysValidAnyOf } from './alwaysValidAnyOf';
import type { Recursion } from './createGenerator';
import { generator as refGenerator, referenceTo } from './refGenerator';
import { composedSchemaParts, refSiblingConstraints } from './schemaParts';
import { selectGenerator } from './selectGenerator';
import type { GeneratorContext } from './types';

import { applyRefinements } from '../refinements';
import { isRefNode, NEWLINE, ts } from '../utils';

export const generateSchema = (schema: ParsedJSONSchema | undefined, context: GeneratorContext) => {
	const simple = simpleSchemaExpression(schema);

	return simple ?? generateObjectSchema(schema as ParsedJSONSchemaObject, context);
};

function simpleSchemaExpression(schema: ParsedJSONSchema | undefined): string | undefined {
	if (typeof schema !== 'object' || schema === null) {
		return schema === true ? ts`z.any()` : schema === false ? ts`z.never()` : ts`z.unknown()`;
	}

	return undefined;
}

function generateObjectSchema(schema: ParsedJSONSchemaObject, context: GeneratorContext): string {
	const customExpression = context.customSchemaResolver?.(schema);

	if (customExpression !== undefined) {
		return customExpression;
	}

	const declaration = context.declarationOf?.(schema);

	if (declaration) {
		return referenceTo(schema, declaration, context);
	}

	const dialect = dialectOf(schema, context.dialect);
	const nodeContext = dialect === context.dialect ? context : { ...context, dialect };
	const validated = withoutAlwaysValidAnyOf(schema);
	let expression = generateCore(validated, nodeContext);

	if (!ignoresRefSiblings(validated, dialect)) {
		expression = applyRefinements(expression, validated, nodeContext, generateSchema);
	}

	return applySchemaDecorators(expression, schema, nodeContext);
}

function applySchemaDecorators(
	expression: string,
	schema: ParsedJSONSchemaObject,
	context: GeneratorContext
): string {
	let decorated = expression;

	if (hasMetadata(schema)) {
		decorated = withMetadata(decorated, schema);
	}

	if (schema.default !== undefined) {
		decorated = withDefault(decorated, schema.default, schema);
	}

	if (context.readOnlyKeyword && schema.readOnly === true) {
		decorated = ts`${decorated}.readonly()`;
	}

	return decorated;
}

function hasMetadata(schema: ParsedJSONSchemaObject): boolean {
	return Boolean(
		schema.$id ||
		schema.title ||
		schema.description ||
		schema.examples !== undefined ||
		schema.deprecated !== undefined ||
		schema.format !== undefined
	);
}

/** Passed to every keyword generator, so it can generate its subschemas. */
const recursion: Recursion = { generateSchema, selectGenerator };

/**
 * True for a `$ref` node in a dialect that ignores every keyword next to the
 * reference (draft-07 and older), so no refinement may be applied to it.
 */
export function ignoresRefSiblings(schema: ParsedJSONSchemaObject, dialect: Dialect): boolean {
	return isRefNode(schema) && dialect.refSiblings === 'ignore';
}

/**
 * Generates the schema without applying refinements or metadata, and combines
 * keywords that would otherwise be lost.
 *
 * A schema can combine a `$ref` or a combinator with sibling keywords, e.g.
 * `{ allOf: [...], properties: {...} }` or `{ $ref: "#/x", maxItems: 2 }`. The
 * generator for the reference/combinator only reads its own keyword, so the
 * siblings are intersected with it, matching JSON Schema semantics.
 *
 * `$ref` siblings are dialect-specific: draft-07 and older override them, while
 * 2019-09 and newer apply them. Refinement keywords (`not`, `if`, ...) are left
 * for `applyRefinements`, which knows whether the dialect allows them.
 */
function generateCore(schema: ParsedJSONSchemaObject, context: GeneratorContext): string {
	const { dialect } = context;

	if (isRefNode(schema)) {
		const reference = refGenerator.generate(schema, context, recursion);

		if (dialect.refSiblings === 'apply') {
			const rest = refSiblingConstraints(schema);

			if (rest) {
				return ts`z.intersection(${reference},${NEWLINE}${generateSchema(rest, context)})`;
			}
		}

		return reference;
	}

	const parts = composedSchemaParts(schema);

	if (parts) {
		return ts`z.intersection(${generateCore(parts.main, context)},${NEWLINE}${generateSchema(
			parts.rest,
			context
		)})`;
	}

	return selectGenerator(schema, context.dialect).generate(schema, context, recursion);
}

function withMetadata(
	expression: string,
	{ $id, title, description, examples, deprecated, format }: ParsedJSONSchemaObject
) {
	return ts`${expression}.meta(${JSON.stringify({ id: $id, title, description, examples, deprecated, format })})`;
}

function withDefault(expression: string, defaultValue: unknown, schema: ParsedJSONSchemaObject) {
	if (schema.type === 'boolean' && typeof defaultValue === 'string') {
		if (defaultValue === 'true') {
			return ts`${expression}.default(true)`;
		}
		if (defaultValue === 'false') {
			return ts`${expression}.default(false)`;
		}
	}
	return ts`${expression}.default(${JSON.stringify(defaultValue)})`;
}
