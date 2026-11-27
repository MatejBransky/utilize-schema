import { isPlainObject } from '@utilize/json-schema';
import type { ParsedJSONSchemaObject } from '@utilize/json-schema';

import type { RenderNested, TypeContext } from './context';
import { union } from './operators';

/**
 * A typed `additionalProperties` widens with the declared property types;
 * `false` emits no index signature, the closest a structural type gets to closed.
 */
export function indexSignatureType(
	schema: ParsedJSONSchemaObject,
	context: TypeContext,
	propertyTypes: string[],
	hasOptional: boolean,
	level: number,
	render: RenderNested
): string | undefined {
	const additional = schema.additionalProperties;
	const patterns = isPlainObject(schema.patternProperties)
		? Object.values(schema.patternProperties)
		: [];
	const parts: string[] = [];

	if (additional !== false) {
		parts.push(isPlainObject(additional) ? render(additional, context, level) : 'unknown');
	}

	for (const pattern of patterns) {
		parts.push(render(pattern, context, level));
	}

	if (parts.length === 0) {
		return undefined;
	}

	if (parts.includes('unknown')) {
		return 'unknown';
	}

	const value = union([...parts, ...propertyTypes]);

	return hasOptional ? union([value, 'undefined']) : value;
}
