import { isJSONSchemaObject, isParsedJSONSchemaObject } from '@utilize/json-schema';
import { describe, expect, test } from 'vitest';

import { renderType } from '../src/renderType';
import type { TypeContext } from '../src/renderType';

import { withMeta } from './test-utils';

const context: TypeContext = {
	nameOf: () => 'Reference',
};

function render(schema: unknown): string {
	if (schema === undefined || schema === null || typeof schema === 'boolean') {
		return renderType(schema, context);
	}

	if (!isJSONSchemaObject(schema)) {
		throw new TypeError('Expected a schema object');
	}

	return renderType(isParsedJSONSchemaObject(schema) ? schema : withMeta(schema), context);
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
			renderType(withMeta({ type: 'string' }), {
				...context,
				customSchemaResolver: () => 'Date',
			})
		).toBe('Date');
	});

	test('dispatches literals, applicators and type arrays', () => {
		expect(render(withMeta({ const: 'a' }))).toBe("'a'");
		expect(render(withMeta({ enum: ['a', 'b'] }))).toBe("'a' | 'b'");
		expect(render(withMeta({ anyOf: [{ type: 'string' }, { type: 'number' }] }))).toBe(
			'string | number'
		);
		expect(render(withMeta({ type: ['string', 'number'] }))).toBe('string | number');
		expect(render(withMeta({ type: [] }))).toBe('never');
	});
});
