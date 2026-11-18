import { isPlainObject, type ParsedJSONSchemaObject } from '@utilize/json-schema';

export const ts = String.raw;

export const NEWLINE = '\n';

export function isSchemaObject<S = ParsedJSONSchemaObject>(schema: unknown): schema is S {
	return isPlainObject(schema);
}
