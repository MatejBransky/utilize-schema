import { dequal } from 'dequal';

import type { DereferencedPaths } from './dereference';
import {
	Parent,
	type JSONSchemaTypeName,
	type LinkedJSONSchema,
} from './types/JSONSchema';
import { isSchemaLike, justName, toSafeString } from './utils';

function hasType(schema: LinkedJSONSchema, type: JSONSchemaTypeName) {
	return (
		schema.type === type ||
		(Array.isArray(schema.type) && schema.type.includes(type))
	);
}
function isObjectType(schema: LinkedJSONSchema) {
	return schema.properties !== undefined || hasType(schema, 'object');
}
function isArrayType(schema: LinkedJSONSchema) {
	return schema.items !== undefined || hasType(schema, 'array');
}

// FIXME: Update type once you know what `options` are needed
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RuleOptions = any;

type RuleParams = {
	schema: LinkedJSONSchema;
	fileName: string;
	options: RuleOptions;
	key: string | null;
	dereferencedPaths: DereferencedPaths;
};

export type Rule = (params: RuleParams) => void;

export const rules = new Map<string, Rule>();

// Boolean schemas (true/false) are not currently supported.
// No investigation has been done yet to estimate the required effort for full support.
rules.set('Unsupported boolean schemas', ({ schema }) => {
	if (typeof schema === 'boolean') {
		throw new Error(
			'Boolean schemas (true/false) are not supported in this pipeline.'
		);
	}
});

rules.set('Transform definitions to $defs', ({ schema, fileName }) => {
	if (
		schema.definitions &&
		schema.$defs &&
		!dequal(schema.definitions, schema.$defs)
	) {
		throw ReferenceError(
			`Schema must define either definitions or $defs, not both. Given id=${schema.$id} in ${fileName}`
		);
	}
	if (schema.definitions) {
		schema.$defs = schema.definitions;
		delete schema.definitions;
	}
});

rules.set('Normalize null-only schemas', ({ schema }) => {
	if (
		Array.isArray(schema.enum) &&
		schema.enum.length === 1 &&
		schema.enum[0] === null
	) {
		schema.type = 'null';
		delete schema.enum;
	}
});

rules.set('Destructure unary types', ({ schema }) => {
	if (schema.type && Array.isArray(schema.type) && schema.type.length === 1) {
		schema.type = schema.type[0];
	}
});

rules.set('Add empty `required` property if none is defined', ({ schema }) => {
	if (isObjectType(schema) && !('required' in schema)) {
		schema.required = [];
	}
});

/**
 * Adds a `$id` property to schemas that require it but do not already have one.
 *
 * - For the top-level schema (no parent and no `$id`), assigns `$id` based on the file name.
 * - For sub-schemas that are objects or arrays and lack both `$id` and `title`, assigns `$id` based on their dereferenced path if available.
 * - This normalization ensures that all relevant schemas have a unique identifier,
 *   which is important for referencing, code generation, and schema reuse.
 */
rules.set(
	'Add an $id to anything that needs it',
	({ schema, fileName, dereferencedPaths }) => {
		if (!isSchemaLike(schema)) {
			return;
		}

		// Top-level schema
		if (!schema.$id && !schema[Parent]) {
			schema.$id = toSafeString(justName(fileName));
			return;
		}

		// Sub-schemas with references
		if (!isArrayType(schema) && !isObjectType(schema)) {
			return;
		}

		// We'll infer from $id and title downstream
		// TODO: Normalize upstream
		const dereferencedName = dereferencedPaths.get(schema);
		if (!schema.$id && !schema.title && dereferencedName) {
			schema.$id = toSafeString(justName(dereferencedName));
		}

		if (dereferencedName) {
			dereferencedPaths.delete(schema);
		}
	}
);

/**
 * Ensures that every array-type schema has an explicit `minItems` property.
 *
 * JSON Schema allows `minItems` to be omitted, which is equivalent to `minItems: 0`.
 * This rule normalizes array schemas by always setting `minItems` to a number,
 * defaulting to 0 if not already specified. This makes downstream processing
 * and code generation more predictable and consistent.
 */
rules.set('Normalize schema.minItems', ({ schema }) => {
	// make sure we only add the props onto array types
	if (!isArrayType(schema)) {
		return;
	}
	const { minItems } = schema;
	schema.minItems = typeof minItems === 'number' ? minItems : 0;
	// cannot normalize maxItems because maxItems = 0 has an actual meaning
});
