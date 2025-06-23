import { isPlainObject, type ParsedJSONSchema } from '@utilize/json-schema';

export const ts = String.raw;

export const NEWLINE = '\n';

export function isSchemaObject<S extends ParsedJSONSchema = ParsedJSONSchema>(
	schema: unknown
): schema is S {
	if (isPlainObject(schema)) {
		return true;
	}

	return false;
}
