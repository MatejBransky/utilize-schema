import type {
	ParsedJSONSchema,
	ParsedJSONSchemaObject,
} from '@utilize/json-schema';

import { selectGenerator } from './selectGenerator';
import type { GeneratorContext } from './types';

import { ts } from '../utils';

export const generateSchema = (
	schema: ParsedJSONSchema,
	context: GeneratorContext
) => {
	if (typeof schema !== 'object' || schema === null) {
		return schema ? ts`z.any()` : ts`z.unknown()`;
	}

	const selectedGenerator = selectGenerator(schema);

	let expression = selectedGenerator.generate(schema, context);

	if (schema.$id || schema.title || schema.description) {
		expression = withMetadata(expression, schema);
	}

	if (schema.default !== undefined) {
		expression = withDefault(expression, schema.default, schema);
	}

	return expression;
};

function withMetadata(
	expression: string,
	{ $id, title, description }: ParsedJSONSchemaObject
) {
	return ts`${expression}.meta(${JSON.stringify({ id: $id, title, description })})`;
}

function withDefault(
	expression: string,
	defaultValue: unknown,
	schema: ParsedJSONSchemaObject
) {
	if (schema.type === 'boolean' && typeof defaultValue === 'string') {
		if (defaultValue === 'true') {
			return ts`${expression}.default(true)`;
		}
		if (defaultValue === 'false') {
			return ts`${expression}.default(false)`;
		}
	}
	return ts`${expression}.default(${JSON.stringify(defaultValue)})`;
}
