import { isParsedJSONSchemaObject, Meta } from '@utilize/json-schema';
import type { CustomNameResolver, ParsedJSONSchemaObject } from '@utilize/json-schema';

import type { BooleanDefinition } from './collectStandaloneSchemas';
import { UnresolvedReferenceError } from './errors';
import { resolveName } from './resolveName';

/** Allocates one stable TypeScript name per schema object. */
export function createNameAllocator(
	usedNames: Set<string>,
	customResolver: CustomNameResolver | undefined
) {
	const names = new Map<ParsedJSONSchemaObject, string>();

	function ensureName(schema: ParsedJSONSchemaObject): string {
		const existing = names.get(schema);

		if (existing !== undefined) {
			return existing;
		}

		const name = resolveName({ schema, usedNames, customResolver });

		names.set(schema, name);
		return name;
	}

	function ensureBooleanDefinitionName(definition: BooleanDefinition): string {
		// A boolean has no metadata of its own, so the name comes from its path.
		const synthetic = { [Meta]: { path: definition.path } };

		if (!isParsedJSONSchemaObject(synthetic)) {
			throw new Error('Expected a synthetic schema with metadata');
		}

		return ensureName(synthetic);
	}

	return {
		ensureBooleanDefinitionName,
		ensureName,
		nameOf: (schema: ParsedJSONSchemaObject, ref: string): string => {
			const name = names.get(schema);

			if (name === undefined) {
				throw new UnresolvedReferenceError(ref);
			}

			return name;
		},
	};
}
