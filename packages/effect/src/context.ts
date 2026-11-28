import type {
	CustomNameResolver,
	Dialect,
	NameMapper,
	ParsedJSONSchema,
	ParsedJSONSchemaObject,
} from '@utilize/json-schema';

/** The JSON value types an untyped schema can constrain. */
export const JSON_VALUE_TYPES = ['string', 'number', 'object', 'array'] as const;
export type JSONValueType = (typeof JSON_VALUE_TYPES)[number];

/** Names the generated code uses besides the declarations. */
export const RESERVED_NAMES = ['Schema'];

/** Name of a root schema that is not an object, so it has nothing to resolve a name from. */
export const FALLBACK_ROOT_NAME = 'Root';

/**
 * What `format` becomes in the generated code. `assert` validates known
 * formats; `annotate` keeps `format` as an annotation.
 */
export type FormatMode = 'annotate' | 'assert';

/**
 * Returns an Effect Schema expression for a schema node, or `undefined` to use
 * the generator. Called for every object node, `$ref` nodes and generated
 * copies included. The expression replaces the whole node, so no
 * `.annotate()` is added to it.
 */
export type CustomSchemaResolver = (schema: ParsedJSONSchemaObject) => string | undefined;

export interface GenerateOptions {
	/** Emit `import { Schema } from 'effect';` at the top of the generated code. */
	importEffect?: boolean;
	/** Overrides the name allocated for a standalone schema. */
	customNameResolver?: CustomNameResolver;
	/** Rewrites the variable that holds each generated schema. Receives the resolved name. */
	schemaName?: NameMapper;
	/** Rewrites the type exported for each generated schema. Receives the resolved name. */
	typeName?: NameMapper;
	/**
	 * What `format` becomes in the generated code: `assert` (default) validates
	 * known formats, `annotate` keeps `format` as `.annotate({ format })`.
	 */
	formatMode?: FormatMode;
	/** Emits a caller-provided Effect Schema expression for a matching schema node. */
	customSchemaResolver?: CustomSchemaResolver;
}

/**
 * What a generator module reads while it renders one node: the document's
 * dialect, the registered formats and literals, and the recursion back into
 * `generateSchema`. It is created once per `generate()` call and copied when a
 * node carries a different dialect.
 */
export type Context = {
	/** Name of an already declared standalone schema. */
	nameOf: (schema: ParsedJSONSchemaObject, ref: string) => string;
	/** Whether a standalone schema is part of a reference cycle. */
	isCyclic: (schema: ParsedJSONSchemaObject) => boolean;
	/**
	 * Dialect of the node being generated. Starts as the document root's dialect;
	 * `generateSchema` sets it to each node's dialect, so helpers and copies
	 * without `Meta` read it from here instead of resolving it again.
	 */
	dialect: Dialect;
	/** Whether `format` becomes a validation or only an annotation. */
	formatMode?: FormatMode;
	/**
	 * Local name of the imported validator for a format. Registered on first use,
	 * so one format yields one import per file.
	 */
	formatOf: (format: string) => string;
	/**
	 * The call expression for a canonical JSON literal. The first call also
	 * reserves the name of the module-level helper, which makes `generate` emit
	 * it.
	 */
	jsonLiteralCall: (value: unknown) => string;
	/**
	 * Generates a subschema. It travels on the context so a target module can
	 * recurse without importing `generateSchema`, which imports every target
	 * module and would close an import cycle.
	 */
	generateSchema: (schema: ParsedJSONSchema, context: Context) => string;
	customSchemaResolver?: CustomSchemaResolver;
};
