import { isPlainObject, type ParsedJSONSchema } from '@utilize/json-schema';

import {
	Type,
	type MatchedJSONSchema,
	type NonObjectJSONSchema,
} from './types';

import { isSchemaObject } from '../utils';

export type Matcher = (schema: MatchedJSONSchema) => boolean;

// TODO: support Array schema.type
export function matchSchema(schema: ParsedJSONSchema) {
	if (!isSchemaObject<MatchedJSONSchema>(schema)) {
		return schema as NonObjectJSONSchema;
	}

	Object.defineProperty(schema, Type, {
		enumerable: false,
		value: undefined,
		writable: true,
	});

	for (const [key, matcher] of Object.entries(matchers)) {
		if (matcher(schema)) {
			schema[Type] = key as keyof typeof matchers;
			return schema;
		}
	}
}

export const matchers = {
	Union: (schema) => {
		if (
			Array.isArray(schema.type) ||
			Array.isArray(schema.anyOf) ||
			Array.isArray(schema.oneOf)
		) {
			return true;
		}

		return false;
	},
	Enum: (schema) => {
		if ('enum' in schema) {
			return true;
		}

		return false;
	},
	Literal: (schema) => {
		if (schema.const !== undefined) {
			return true;
		}

		return false;
	},
	Null: (schema) => schema.type === 'null',
	Boolean: (schema) => {
		if ('enum' in schema) {
			return false;
		}
		if (schema.type === 'boolean') {
			return true;
		}

		if (schema.type && !schema.type.includes('boolean')) {
			return false;
		}

		if (!schema.type && typeof schema.default === 'boolean') {
			return true;
		}

		return false;
	},
	Number: (schema) => {
		const numberTypes = ['number', 'integer'];

		if ('enum' in schema) {
			return false;
		}

		if (typeof schema.type === 'string' && numberTypes.includes(schema.type)) {
			return true;
		}

		if (!schema.type && typeof schema.default === 'number') {
			return true;
		}

		return false;
	},
	String: (schema) => {
		if ('enum' in schema) {
			return false;
		}

		if (schema.type === 'string') {
			return true;
		}

		if (!schema.type && typeof schema.default === 'string') {
			return true;
		}

		return false;
	},
	Record: (schema) => {
		if (!schema.properties && isPlainObject(schema.additionalProperties)) {
			return true;
		}

		return false;
	},
	Object: (schema) => {
		if (typeof schema === 'object' && 'type' in schema && schema.properties) {
			return true;
		}

		return false;
	},
	Tuple: (schema) => {
		if (schema.type === 'array' && Array.isArray(schema.items)) {
			return true;
		}

		return false;
	},
	Array: (schema) => {
		if (schema.type === 'array' && !Array.isArray(schema.items)) {
			return true;
		}

		return false;
	},
	Unknown: () => {
		return true;
	},
} as const satisfies Record<string, Matcher>;

export type MatchType = keyof typeof matchers;

export const MatchType = Object.fromEntries(
	Object.keys(matchers).map((key) => [key, key])
) as Record<MatchType, MatchType>;
