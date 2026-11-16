import type { ParsedJSONSchemaObject } from '@utilize/json-schema';

export type UsedNames = Set<string>;
export type GeneratorContext = {
	usedNames: UsedNames;
	/** $refs that must be emitted as `z.lazy()` because a getter cannot defer them. */
	lazyRefs: Set<ParsedJSONSchemaObject>;
};
