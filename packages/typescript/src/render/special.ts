import type { ParsedJSONSchemaObject } from '@utilize/json-schema';

import type { RenderNested, TypeContext } from './context';
import { renderLiteralConstraint } from './literals';
import { renderReference } from './references';

export function renderSpecialSchema(
	schema: ParsedJSONSchemaObject,
	context: TypeContext,
	level: number,
	render: RenderNested
): string | undefined {
	const customType = context.customSchemaResolver?.(schema);

	if (customType !== undefined) {
		return customType;
	}

	if (typeof schema.$ref === 'string') {
		return renderReference(schema, context, level, render);
	}

	if (Object.hasOwn(schema, 'const')) {
		return renderLiteralConstraint([schema.const], 'const', schema, context, level, render);
	}

	if (Array.isArray(schema.enum)) {
		return renderLiteralConstraint(schema.enum, 'enum', schema, context, level, render);
	}

	return undefined;
}
