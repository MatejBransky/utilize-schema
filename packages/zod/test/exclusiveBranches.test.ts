import { resolveDialect } from '@utilize/json-schema';
import type { JSONSchema, ParsedJSONSchemaObject } from '@utilize/json-schema';
import { describe, expect, test } from 'vitest';

import { areMutuallyExclusive } from '../src/generators/exclusiveBranches';
import type { ExclusiveBranchesOptions } from '../src/generators/exclusiveBranches';
import { parsedSchema } from './test-utils';

const options: ExclusiveBranchesOptions = {
	dialect: resolveDialect({}).dialect,
	isOpaque: () => false,
};

function branch(schema: JSONSchema): ParsedJSONSchemaObject {
	return parsedSchema(schema);
}

describe('areMutuallyExclusive', () => {
	test('accepts disjoint literal branches', () => {
		expect(areMutuallyExclusive([branch({ const: 'a' }), branch({ const: 'b' })], options)).toBe(
			true
		);
	});

	test('rejects overlapping enum branches', () => {
		expect(
			areMutuallyExclusive([branch({ enum: ['a', 'b'] }), branch({ enum: ['b', 'c'] })], options)
		).toBe(false);
	});

	test('uses required property constants as object tags', () => {
		const first = branch({
			type: 'object',
			required: ['kind'],
			properties: { kind: { const: 'a' } },
		});
		const second = branch({
			type: 'object',
			required: ['kind'],
			properties: { kind: { const: 'b' } },
		});

		expect(areMutuallyExclusive([first, second], options)).toBe(true);
	});

	test('rejects branches with defaults or opaque schemas', () => {
		expect(
			areMutuallyExclusive(
				[branch({ type: 'string' }), branch({ type: 'string', default: 'a' })],
				options
			)
		).toBe(false);

		const opaque = branch({ type: 'string' });
		expect(
			areMutuallyExclusive([branch({ type: 'number' }), opaque], {
				...options,
				isOpaque: (schema) => schema === opaque,
			})
		).toBe(false);
	});
});
