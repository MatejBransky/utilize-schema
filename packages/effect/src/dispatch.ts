import {
	dialectOf,
	expectDefined,
	isKeywordApplicable,
	isParsedJSONSchemaObject,
	isPlainObject,
	withSourceMeta,
} from '@utilize/json-schema';
import type { ParsedJSONSchema, ParsedJSONSchemaObject } from '@utilize/json-schema';

import { generateAllOfExpression } from './allOf';
import { generateAlternativeExpression } from './alternatives';
import type { Context } from './context';
import { applyAnnotations, applyChecks } from './expressions';
import { literal, literals } from './literals';
import { generateReference } from './references';
import { TYPE_GENERATORS } from './registry';
import { generateUntyped } from './untyped';

export function generateSchema(schema: ParsedJSONSchema, context: Context): string {
	const simple = generateSimpleSchema(schema);

	if (simple !== undefined) {
		return simple;
	}

	if (!isParsedJSONSchemaObject(schema)) {
		return 'Schema.Json';
	}

	const object = schema;
	const customExpression = context.customSchemaResolver?.(object);

	if (customExpression !== undefined) {
		return customExpression;
	}

	const dialect = dialectOf(object, context.dialect);
	const nodeContext = dialect === context.dialect ? context : { ...context, dialect };
	const filters = filterChecks(object, nodeContext);
	const expression =
		typeof object.$ref === 'string'
			? generateReference(object, filters, nodeContext)
			: applyChecks(generateExpression(object, nodeContext), filters);

	return applyAnnotations(expression, object);
}

function generateSimpleSchema(schema: ParsedJSONSchema): string | undefined {
	if (schema === undefined || schema === null || schema === true) {
		return 'Schema.Json';
	}

	if (schema === false) {
		return 'Schema.Never';
	}

	return isPlainObject(schema) ? undefined : 'Schema.Json';
}

function generateExpression(schema: ParsedJSONSchemaObject, context: Context): string {
	const literalExpression = generateLiteralExpression(schema, context);

	if (literalExpression !== undefined) {
		return literalExpression;
	}

	const intersection = generateAllOfExpression(schema, context);

	if (intersection !== undefined) {
		return intersection;
	}

	return generateAlternativeExpression(schema, context) ?? generateType(schema, context);
}

function generateLiteralExpression(
	schema: ParsedJSONSchemaObject,
	context: Context
): string | undefined {
	if (Object.hasOwn(schema, 'const') && isKeywordApplicable(context.dialect, 'const')) {
		return literal(schema.const, context);
	}

	return Array.isArray(schema.enum) ? literals(schema.enum, context) : undefined;
}

function generateType(schema: ParsedJSONSchemaObject, context: Context): string {
	const union = generateTypeUnion(schema, context);

	if (union !== undefined) {
		return union;
	}

	const type = typeof schema.type === 'string' ? schema.type : undefined;

	return TYPE_GENERATORS.get(type ?? '')?.(schema, context) ?? generateUntyped(schema, context);
}

function generateTypeUnion(schema: ParsedJSONSchemaObject, context: Context): string | undefined {
	if (!Array.isArray(schema.type)) {
		return undefined;
	}

	const members = [
		...new Set(
			schema.type.map((type) => generateTypeMember(schemaWithType(schema, type), context))
		),
	];

	if (members.length === 0) {
		return 'Schema.Never';
	}

	return members.length === 1 ? expectDefined(members[0]) : `Schema.Union([${members.join(', ')}])`;
}

function generateTypeMember(schema: ParsedJSONSchemaObject, context: Context): string {
	return context.customSchemaResolver?.(schema) ?? generateType(schema, context);
}

/** Drops metadata so that only the keyword applicability of each union member remains. */
function schemaWithType(
	schema: ParsedJSONSchemaObject,
	type: ParsedJSONSchemaObject['type']
): ParsedJSONSchemaObject {
	return withSourceMeta(schema, {
		...schema,
		type,
		default: undefined,
		title: undefined,
		description: undefined,
		examples: undefined,
		$id: undefined,
	});
}

/**
 * `not` and `if`/`then`/`else` have no schema constructor, so they are applied
 * as filters that evaluate the subschemas with `Schema.is`.
 */
function filterChecks(schema: ParsedJSONSchemaObject, context: Context): string[] {
	if (typeof schema.$ref === 'string' && context.dialect.refSiblings === 'ignore') {
		return [];
	}

	const checks: string[] = [];

	if (schema.not !== undefined) {
		const not = context.generateSchema(schema.not, context);

		checks.push(
			`Schema.makeFilter((value) => Schema.is(${not})(value) ? 'Value must not match the "not" schema' : undefined)`
		);
	}

	if (schema.if !== undefined && isKeywordApplicable(context.dialect, 'if')) {
		const condition = context.generateSchema(parsed(schema.if), context);
		const thenBranch = branchCheck(schema.then, 'then', context);
		const elseBranch = branchCheck(schema.else, 'else', context);

		checks.push(
			`Schema.makeFilter((value) => Schema.is(${condition})(value) ? (${thenBranch}) : (${elseBranch}))`
		);
	}

	return checks;
}

function branchCheck(branch: unknown, keyword: 'then' | 'else', context: Context): string {
	if (branch === undefined) {
		return 'undefined';
	}

	return `Schema.is(${context.generateSchema(parsed(branch), context)})(value) ? undefined : 'Value does not match the "${keyword}" schema'`;
}

/** `JSONSchema7` types `if`/`then`/`else` without the linked schema metadata. */
function parsed(schema: unknown): ParsedJSONSchema {
	if (typeof schema === 'boolean' || schema === null || isParsedJSONSchemaObject(schema)) {
		return schema;
	}

	throw new TypeError('Expected a parsed JSON Schema');
}
