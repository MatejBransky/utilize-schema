import { isPlainObject, type ParsedJSONSchema } from '@utilize/json-schema';
import prettierConfig from '@utilize/prettier-config/prettier.json';
import {
	format as prettierFormat,
	type Options as PrettierOptions,
} from 'prettier';

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

export function format(code: string) {
	return prettierFormat(code, {
		...(prettierConfig as PrettierOptions),
		parser: 'typescript',
	});
}
