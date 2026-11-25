import {
	collectStandaloneSchemas as collectSharedStandaloneSchemas,
	isPlainObject,
	Meta,
} from '@utilize/json-schema';
import type {
	ParsedJSONSchema,
	ParsedJSONSchemaObject,
	StandaloneSchemas,
} from '@utilize/json-schema';

/**
 * A `$defs` or `definitions` entry that is a boolean schema. Booleans carry no
 * metadata, so the path is kept to name the declaration.
 */
export interface BooleanDefinition {
	schema: boolean;
	path: (string | number)[];
}

export interface StandaloneSchemasResult extends StandaloneSchemas {
	booleanDefinitions: BooleanDefinition[];
}

const DEFINITION_NAMESPACES = ['$defs', 'definitions'] as const;

/**
 * Collects all standalone schemas: referenced, `$defs`/`definitions` and the
 * root. Both definition namespaces are valid at once, so neither may shadow the
 * other, and a boolean definition gets its own declaration too.
 */
export function collectStandaloneSchemas(root: ParsedJSONSchemaObject): StandaloneSchemasResult {
	const booleanDefinitions: BooleanDefinition[] = [];

	// Boolean definitions are recorded while the object ones are read, so they
	// keep the order in which the traversal meets them.
	function* definitionsOf(schema: ParsedJSONSchemaObject): Generator<ParsedJSONSchemaObject> {
		const basePath = schema[Meta]?.path ?? [];

		for (const namespace of DEFINITION_NAMESPACES) {
			const definitions = schema[namespace] as unknown as
				| Record<string, ParsedJSONSchema>
				| undefined;

			if (!isPlainObject(definitions)) {
				continue;
			}

			for (const [key, definition] of Object.entries(definitions)) {
				if (isPlainObject(definition)) {
					yield definition as ParsedJSONSchemaObject;
				} else if (typeof definition === 'boolean') {
					booleanDefinitions.push({ schema: definition, path: [...basePath, namespace, key] });
				}
			}
		}
	}

	return {
		...collectSharedStandaloneSchemas(root, { definitionsOf }),
		booleanDefinitions,
	};
}
