import type { Dialect, ParsedJSONSchemaObject } from '@utilize/json-schema';

export type GeneratorContext = {
	/** $refs that must be emitted as `z.lazy()` because a getter cannot defer them. */
	lazyRefs: Set<ParsedJSONSchemaObject>;
	/** Set when a `oneOf` needs the single-pass helper emitted at the top of the file. */
	usesOneOf?: boolean;
	/** Map `readOnly: true` to `.readonly()`; off by default because it changes the value type. */
	readOnlyKeyword?: boolean;
	/** The variable under which a referenced schema is exported. */
	nameOf(reference: ParsedJSONSchemaObject): string;
	/**
	 * Dialect of the node being generated. Starts as the document root's dialect;
	 * `generateSchema` sets it to each node's dialect, so generators and copies
	 * without `Meta` read it from here instead of resolving it again.
	 */
	dialect: Dialect;
};
