import type { ParsedJSONSchema } from '@utilize/json-schema';
import { describe, expect, test } from 'vitest';

import { renderType } from '../src/renderType';
import type { TypeContext } from '../src/renderType';

const context: TypeContext = {
	nameOf: () => 'Reference',
};

function render(schema: unknown): string {
	return renderType(schema as ParsedJSONSchema, context);
}

describe('renderType dispatch', () => {
	test('normalizes boolean and missing schemas', () => {
		expect(render(undefined)).toBe('unknown');
		expect(render(true)).toBe('unknown');
		expect(render(false)).toBe('never');
		expect(render(null)).toBe('unknown');
	});

	test('prefers a custom resolver over built-in rendering', () => {
		expect(
			renderType({ type: 'string' } as unknown as ParsedJSONSchema, {
				...context,
				customSchemaResolver: () => 'Date',
			})
		).toBe('Date');
	});

	test('dispatches literals, applicators and type arrays', () => {
		expect(render({ const: 'a' })).toBe("'a'");
		expect(render({ enum: ['a', 'b'] })).toBe("'a' | 'b'");
		expect(render({ anyOf: [{ type: 'string' }, { type: 'number' }] })).toBe('string | number');
		expect(render({ type: ['string', 'number'] })).toBe('string | number');
		expect(render({ type: [] })).toBe('never');
	});
});
