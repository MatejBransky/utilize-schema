import { Meta, type ParsedJSONSchemaObject } from '@utilize/json-schema';

import { createGenerator } from './createGenerator';
import type { GeneratorContext } from './types';

import { isRefNode, ts } from '../utils';

export const generator = createGenerator(isRefNode, (schema, context) => {
	const metadata = schema[Meta];
	const reference = metadata.reference;

	if (reference === undefined || reference === null) {
		console.warn(
			`Reference schema at "${metadata.filePath}#/${metadata.path.join('/')}" must have a reference "${schema.$ref}"`
		);
		return ts`z.unknown()`;
	}

	if (typeof reference === 'boolean') {
		return reference ? ts`z.any()` : ts`z.never()`;
	}

	return referenceTo(schema, reference, context);
});

/**
 * The expression that refers to a standalone schema from `node`: a `$ref`, or
 * an inline copy of the standalone schema.
 */
export function referenceTo(
	node: ParsedJSONSchemaObject,
	reference: ParsedJSONSchemaObject,
	context: GeneratorContext
): string {
	const name = context.nameOf(reference);

	if (node[Meta].isCircular && context.lazyRefs.has(node)) {
		return ts`z.lazy(() => ${name})`;
	}

	return name;
}
