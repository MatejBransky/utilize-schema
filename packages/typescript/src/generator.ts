import { isParsedJSONSchemaObject } from '@utilize/json-schema';
import type { ParsedJSONSchema, ParsedJSONSchemaObject } from '@utilize/json-schema';

import { collectStandaloneSchemas } from './collectStandaloneSchemas';
import { renderBooleanDeclaration, renderDeclaration } from './declarations';
import { findUnsupportedCycles } from './cycles';
import { UnsupportedCircularTypeError } from './errors';
import { RENDERED_GLOBAL_TYPES, renderType } from './renderType';
import type { TypeContext } from './render/context';
import type { GenerateOptions } from './generatorOptions';
import { createNameAllocator } from './nameAllocator';

export type { CustomSchemaResolver } from './renderType';
export type { InferenceMode } from './render/context';

export type { GenerateOptions } from './generatorOptions';

/**
 * Generates TypeScript types from a linked JSON Schema.
 *
 * One exported interface or type alias is emitted per standalone schema (root,
 * `$defs`, `definitions`, referenced). Declarations are order-independent
 * because TypeScript hoists types, so no topological sort is needed.
 */
export function generate(root: ParsedJSONSchema, options: GenerateOptions = {}): string {
	// The renderer emits `Array<…>` and `Record<string, never>`; a schema named
	// after one of those globals would shadow it and not compile.
	const usedNames = new Set<string>(RENDERED_GLOBAL_TYPES);
	const { ensureBooleanDefinitionName, ensureName, nameOf } = createNameAllocator(
		usedNames,
		options.customNameResolver
	);
	const context: TypeContext = {
		nameOf,
		customSchemaResolver: options.customSchemaResolver,
		inference: options.inference,
	};

	if (!isParsedJSONSchemaObject(root)) {
		return `export type Root = ${renderType(root, context)};\n`;
	}

	const collected = collectStandaloneSchemas(root);
	const unsupported = findUnsupportedCycles(collected.schemas);

	if (unsupported.length > 0) {
		throw new UnsupportedCircularTypeError(unsupported);
	}

	const rootSchema = root;
	const rootName = ensureName(rootSchema);
	const definitions = collected.schemas.filter(
		(schema): schema is ParsedJSONSchemaObject =>
			schema !== rootSchema && isParsedJSONSchemaObject(schema)
	);

	// Every name has to exist before the first declaration is rendered, because
	// a definition may reference a schema that is declared later.
	for (const schema of definitions) {
		ensureName(schema);
	}

	const booleanNames = collected.booleanDefinitions.map((definition) => ({
		definition,
		name: ensureBooleanDefinitionName(definition),
	}));

	const declarations = definitions.map((schema) =>
		renderDeclaration(ensureName(schema), schema, context)
	);

	for (const { definition, name } of booleanNames) {
		declarations.push(renderBooleanDeclaration(name, definition, context));
	}

	declarations.push(renderDeclaration(rootName, rootSchema, context));

	return `${declarations.join('\n\n')}\n`;
}
