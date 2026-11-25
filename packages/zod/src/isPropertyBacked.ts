import { Meta } from '@utilize/json-schema';
import type { ParsedJSONSchemaObject } from '@utilize/json-schema';

import type { InlineCopies } from './inlineCopies';

/**
 * Returns true when the schema is (transitively) a value of an object's
 * `properties` entry.
 *
 * This is the only place where the generator can emit a getter, and a getter is
 * the only way to defer a recursive reference without losing type inference.
 * With `standaloneSchemas`, the property must also be generated in the same
 * declaration as the reference; `copies` tells which inline subschemas are
 * generated as references to another declaration.
 */
export function isPropertyBacked(
	schema: ParsedJSONSchemaObject,
	standaloneSchemas?: Set<ParsedJSONSchemaObject>,
	copies: InlineCopies = new Map()
): boolean {
	let node: ParsedJSONSchemaObject = schema;

	for (;;) {
		const parent = node[Meta]?.parent;

		if (!parent || typeof parent !== 'object') {
			return false;
		}

		if (isPropertiesMap(parent)) {
			if (!standaloneSchemas) {
				return true;
			}

			const owner = parent[Meta]?.parent;

			if (!owner || typeof owner !== 'object') {
				return false;
			}

			const scope = { standaloneSchemas, copies };

			return declarationReferencing(schema, scope) === declarationContaining(owner, scope);
		}

		node = parent;
	}
}

interface DeclarationScope {
	standaloneSchemas: Set<ParsedJSONSchemaObject>;
	copies: InlineCopies;
}

/**
 * The declaration a reference is generated in. An inline copy is generated as
 * a reference where it appears, even when it is the copy a hoisted declaration
 * was made from.
 */
function declarationReferencing(
	reference: ParsedJSONSchemaObject,
	scope: DeclarationScope
): ParsedJSONSchemaObject | undefined {
	const parent = reference[Meta]?.parent;

	if (!scope.copies.has(reference) || !parent || typeof parent !== 'object') {
		return declarationContaining(reference, scope);
	}

	return declarationContaining(parent, scope);
}

/**
 * The declaration a node is generated in. A node inside the copy a hoisted
 * declaration was made from is generated in that declaration.
 */
function declarationContaining(
	node: ParsedJSONSchemaObject,
	{ standaloneSchemas, copies }: DeclarationScope
): ParsedJSONSchemaObject | undefined {
	let current: ParsedJSONSchemaObject = node;

	for (;;) {
		if (standaloneSchemas.has(current)) {
			return current;
		}

		const declaration = copies.get(current);

		if (declaration) {
			return declaration;
		}

		const parent = current[Meta]?.parent;

		if (!parent || typeof parent !== 'object') {
			return undefined;
		}

		current = parent;
	}
}

/**
 * The linker represents `properties` as its own node, so the parent of a
 * property value is the properties map, not the enclosing schema.
 */
function isPropertiesMap(schema: ParsedJSONSchemaObject): boolean {
	const meta = schema[Meta];

	if (meta?.path.at(-1) !== 'properties') {
		return false;
	}

	const owner = meta.parent;

	return !!owner && typeof owner === 'object' && (owner.properties as unknown) === schema;
}
