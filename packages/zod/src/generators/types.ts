import type { Dialect, ParsedJSONSchemaObject } from '@utilize/json-schema';

/**
 * Maps a JSON Schema `format` name to a Zod string expression. An entry applies
 * in both `formatMode`s, so it is also a way to validate one format while the
 * rest stay annotations. Formats that are not listed follow `formatMode`.
 * String constraints are appended to the expression, so it has to be a string
 * schema.
 */
export type FormatMap = Record<string, string>;

/**
 * What `format` becomes in the generated code. `annotate` keeps it as
 * `.meta({ format })`, which is the JSON Schema default and the default here.
 * `assert` turns known formats into validation (`.iso.date()`, `url` patterns, …).
 */
export type FormatMode = 'annotate' | 'assert';

/**
 * Returns a Zod expression for a schema node, or `undefined` to use the
 * generator. Called for every object node, `$ref` nodes and generated copies
 * included, before `formatMap`. The expression replaces the whole node, so no
 * `.meta()`, `.default()` or `.readonly()` is added to it.
 */
export type CustomSchemaResolver = (schema: ParsedJSONSchemaObject) => string | undefined;

export type GeneratorContext = {
	/** $refs that must be emitted as `z.lazy()` because a getter cannot defer them. */
	lazyRefs: Set<ParsedJSONSchemaObject>;
	/** Set when a `oneOf` needs the single-pass helper emitted at the top of the file. */
	usesOneOf?: boolean;
	/** Map `readOnly: true` to `.readonly()`; off by default because it changes the value type. */
	readOnlyKeyword?: boolean;
	/** The standalone schema an inline subschema is an identical copy of, if any. */
	declarationOf?(schema: ParsedJSONSchemaObject): ParsedJSONSchemaObject | undefined;
	/** The variable under which a referenced schema is exported. */
	nameOf(reference: ParsedJSONSchemaObject): string;
	/**
	 * Dialect of the node being generated. Starts as the document root's dialect;
	 * `generateSchema` sets it to each node's dialect, so generators and copies
	 * without `Meta` read it from here instead of resolving it again.
	 */
	dialect: Dialect;
	/** Maps a `format` to a Zod expression; it applies in both modes, other formats follow `formatMode`. */
	formatMap?: FormatMap;
	/** Whether `format` becomes a validation or only metadata. Defaults to `annotate`. */
	formatMode?: FormatMode;
	/** Emits a caller-provided expression before the built-in generator runs. */
	customSchemaResolver?: CustomSchemaResolver;
	/**
	 * Name of the module-level validator constant for a format. Registered on
	 * first use, so one format yields one constant per file.
	 */
	formatOf(format: string): string;
};
