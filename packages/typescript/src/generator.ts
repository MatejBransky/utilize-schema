import { isParsedJSONSchemaObject, Meta } from '@utilize/json-schema';
import type {
	CustomNameResolver,
	ParsedJSONSchema,
	ParsedJSONSchemaObject,
} from '@utilize/json-schema';

import { collectStandaloneSchemas } from './collectStandaloneSchemas';
import type { BooleanDefinition } from './collectStandaloneSchemas';
import { findUnsupportedCycles } from './cycles';
import { UnresolvedReferenceError, UnsupportedCircularTypeError } from './errors';
import {
	isObjectDeclaration,
	RENDERED_GLOBAL_TYPES,
	renderJsDoc,
	renderObjectBody,
	renderType,
} from './renderType';
import type { CustomSchemaResolver, TypeContext } from './renderType';
import { resolveName } from './resolveName';

export type { CustomSchemaResolver } from './renderType';

export interface GenerateOptions {
	/** Overrides the name allocated for a standalone schema. */
	customNameResolver?: CustomNameResolver;
	/** Emits a caller-provided TypeScript type for a matching schema node. */
	customSchemaResolver?: CustomSchemaResolver;
	/**
	 * Treats a schema that would otherwise be `unknown` and has `format` as
	 * `string`. Off by default because `format` only applies to strings;
	 * non-string instances stay valid without `type`.
	 */
	inferFormatAsString?: boolean;
}

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
	const names = new Map<ParsedJSONSchemaObject, string>();

	const context: TypeContext = {
		nameOf(schema, ref) {
			const name = names.get(schema);

			if (name === undefined) {
				throw new UnresolvedReferenceError(ref);
			}

			return name;
		},
		customSchemaResolver: options.customSchemaResolver,
		inferFormatAsString: options.inferFormatAsString,
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

	function ensureBooleanDefinitionName(definition: BooleanDefinition): string {
		// A boolean has no metadata of its own, so the name comes from its path.
		const synthetic = { [Meta]: { path: definition.path } };

		if (!isParsedJSONSchemaObject(synthetic)) {
			throw new Error('Expected a synthetic schema with metadata');
		}

		return ensureName(synthetic);
	}

	function ensureName(schema: ParsedJSONSchemaObject): string {
		const existing = names.get(schema);

		if (existing !== undefined) {
			return existing;
		}

		const name = resolveName({
			schema,
			usedNames,
			customResolver: options.customNameResolver,
		});

		names.set(schema, name);
		return name;
	}
}

function renderDeclaration(
	name: string,
	schema: ParsedJSONSchemaObject,
	context: TypeContext
): string {
	const doc = renderJsDoc(schema, 0, name);
	const customType = context.customSchemaResolver?.(schema);

	if (customType !== undefined) {
		return [...doc, `export type ${name} = ${customType};`].join('\n');
	}

	const body = isObjectDeclaration(schema) ? renderObjectBody(schema, context, 1) : undefined;

	return body === undefined
		? [...doc, `export type ${name} = ${renderType(schema, context)};`].join('\n')
		: [...doc, `export interface ${name} {\n${body}\n}`].join('\n');
}

function renderBooleanDeclaration(
	name: string,
	definition: BooleanDefinition,
	context: TypeContext
): string {
	return `export type ${name} = ${renderType(definition.schema, context)};`;
}
