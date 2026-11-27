import { isPlainObject } from '@utilize/json-schema';
import type { ParsedJSONSchemaObject } from '@utilize/json-schema';

import type { RenderNested, TypeContext } from './context';
import { union } from './operators';

/** The type of a required key that no declared property or pattern covers. */
export function implicitPropertyType(
	schema: ParsedJSONSchemaObject,
	key: string,
	context: TypeContext,
	level: number,
	render: RenderNested
): string {
	const patterns = isPlainObject(schema.patternProperties) ? schema.patternProperties : {};
	const matches: string[] = [];

	for (const [pattern, subschema] of Object.entries(patterns)) {
		if (matchesPattern(pattern, key)) {
			matches.push(render(subschema, context, level));
		}
	}

	if (matches.length > 0) {
		return union(matches);
	}

	return additionalPropertyType(schema, context, level, render);
}

/** JSON Schema patterns are unanchored ECMA-262 regular expressions. */
function matchesPattern(pattern: string, key: string): boolean {
	try {
		return new RegExp(pattern).test(key);
	} catch {
		return false;
	}
}

/** Fallback for a required key that no declared property or pattern covers. */
function additionalPropertyType(
	schema: ParsedJSONSchemaObject,
	context: TypeContext,
	level: number,
	render: RenderNested
): string {
	const additional = schema.additionalProperties;

	if (additional === false) {
		return 'never';
	}

	return isPlainObject(additional) ? render(additional, context, level) : 'unknown';
}
