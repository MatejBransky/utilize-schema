import type { ParsedJSONSchemaObject } from '@utilize/json-schema';

import { UnsupportedEffectSchemaFeatureError } from './errors';

export function patternExpression(pattern: string): string {
	try {
		RegExp(pattern, 'u');
	} catch {
		throw new UnsupportedEffectSchemaFeatureError(
			'pattern',
			`${JSON.stringify(pattern)} is not a valid ECMAScript regular expression in unicode mode`
		);
	}

	return `new RegExp(${JSON.stringify(pattern)}, 'u')`;
}

export function applyChecks(expression: string, checks: string[]): string {
	if (checks.length === 0) {
		return expression;
	}

	// Effect cannot attach checks to `Schema.suspend`, so a checked reference is
	// wrapped in a single-member union. The union keeps the reference's type and
	// its declaration stays shared, which also works for recursive schemas.
	const target = expression.startsWith('Schema.suspend(')
		? `Schema.Union([${expression}])`
		: expression;

	return `${target}.check(${checks.join(', ')})`;
}

export function applyAnnotations(expression: string, schema: ParsedJSONSchemaObject): string {
	const annotations: string[] = [];

	appendStringAnnotations(annotations, schema);
	appendValueAnnotations(annotations, schema);
	appendIdentifierAnnotations(annotations, schema);
	appendBooleanAnnotations(annotations, schema);

	return annotations.length > 0
		? `${expression}.annotate({ ${annotations.join(', ')} })`
		: expression;
}

function appendStringAnnotations(annotations: string[], schema: ParsedJSONSchemaObject): void {
	if (typeof schema.title === 'string') {
		annotations.push(`title: ${JSON.stringify(schema.title)}`);
	}
	if (typeof schema.description === 'string') {
		annotations.push(`description: ${JSON.stringify(schema.description)}`);
	}
}

function appendValueAnnotations(annotations: string[], schema: ParsedJSONSchemaObject): void {
	if (schema.default !== undefined) {
		annotations.push(`default: ${JSON.stringify(schema.default)}`);
	}
	if (Array.isArray(schema.examples)) {
		annotations.push(`examples: ${JSON.stringify(schema.examples)}`);
	}
}

function appendIdentifierAnnotations(annotations: string[], schema: ParsedJSONSchemaObject): void {
	if (typeof schema.$id === 'string') {
		annotations.push(`identifier: ${JSON.stringify(schema.$id)}`);
	}
	if (typeof schema.format === 'string') {
		annotations.push(`format: ${JSON.stringify(schema.format)}`);
	}
}

function appendBooleanAnnotations(annotations: string[], schema: ParsedJSONSchemaObject): void {
	if (typeof schema.readOnly === 'boolean') {
		annotations.push(`readOnly: ${schema.readOnly}`);
	}
	if (typeof schema.writeOnly === 'boolean') {
		annotations.push(`writeOnly: ${schema.writeOnly}`);
	}
	if (typeof schema.deprecated === 'boolean') {
		annotations.push(`deprecated: ${schema.deprecated}`);
	}
}
