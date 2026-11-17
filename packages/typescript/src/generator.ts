import {
	isPlainObject,
	type ParsedJSONSchema,
	type ParsedJSONSchemaObject,
} from '@utilize/json-schema';

import { collectStandaloneSchemas } from './collectStandaloneSchemas';
import { findUnsupportedCycles } from './cycles';
import { UnresolvedReferenceError, UnsupportedCircularTypeError } from './errors';
import {
	isObjectDeclaration,
	renderJsDoc,
	renderObjectBody,
	renderType,
	type TypeContext,
} from './renderType';
import { resolveName, type CustomNameResolver } from './resolveName';

export interface GenerateOptions {
	/** Overrides the name allocated for a standalone schema. */
	customNameResolver?: CustomNameResolver;
}

/**
 * Generates TypeScript types from a linked JSON Schema.
 *
 * One exported interface or type alias is emitted per standalone schema (root,
 * `$defs`, `definitions`, referenced). Declarations are order-independent
 * because TypeScript hoists types, so no topological sort is needed.
 */
export function generate(root: ParsedJSONSchema, options: GenerateOptions = {}): string {
	const usedNames = new Set<string>();
	const names = new Map<ParsedJSONSchemaObject, string>();

	const context: TypeContext = {
		nameOf(schema, ref) {
			const name = names.get(schema);

			if (name === undefined) {
				throw new UnresolvedReferenceError(ref);
			}

			return name;
		},
	};

	if (!isPlainObject(root)) {
		return `export type Root = ${renderType(root, context)};\n`;
	}

	const collected = collectStandaloneSchemas(root as ParsedJSONSchemaObject);
	const unsupported = findUnsupportedCycles(collected.schemas);

	if (unsupported.length > 0) {
		throw new UnsupportedCircularTypeError(unsupported);
	}

	const rootSchema = root as ParsedJSONSchemaObject;
	const rootName = ensureName(rootSchema);
	const definitions = collected.schemas.filter(
		(schema): schema is ParsedJSONSchemaObject => schema !== rootSchema && isPlainObject(schema)
	);

	// Every name has to exist before the first declaration is rendered, because
	// a definition may reference a schema that is declared later.
	for (const schema of definitions) {
		ensureName(schema);
	}

	const declarations = definitions.map((schema) =>
		renderDeclaration(ensureName(schema), schema, context)
	);

	declarations.push(renderDeclaration(rootName, rootSchema, context));

	return `${declarations.join('\n\n')}\n`;

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
	const doc = renderJsDoc(schema);
	const body = isObjectDeclaration(schema) ? renderObjectBody(schema, context, 1) : undefined;

	return body === undefined
		? [...doc, `export type ${name} = ${renderType(schema, context)};`].join('\n')
		: [...doc, `export interface ${name} {\n${body}\n}`].join('\n');
}
