import { describe, expect, test } from 'vitest';

import {
	compileFile,
	readSchema,
	resolveName,
	toSafeString,
	UnresolvedReferenceError,
	UnsupportedEffectSchemaFeatureError,
	withBanner,
} from '../src';

/**
 * The file and CLI helpers are exported for the generator CLI and for consumers
 * that compile a file instead of a schema object. They have no caller inside
 * this package, so this test is the only dependency path that reaches them.
 */
describe('public API', () => {
	test('exports the compile and file helpers', () => {
		expect(compileFile).toBeTypeOf('function');
		expect(readSchema).toBeTypeOf('function');
		expect(resolveName).toBeTypeOf('function');
		expect(toSafeString).toBeTypeOf('function');
		expect(withBanner).toBeTypeOf('function');
	});

	test('exports the error the generator throws for an unresolved $ref', () => {
		const error = new UnresolvedReferenceError('#/missing');

		expect(error).toBeInstanceOf(Error);
		expect(error.message).toContain('#/missing');
	});

	test('exports the error the generator throws for an unsupported keyword', () => {
		const error = new UnsupportedEffectSchemaFeatureError('patternProperties');

		expect(error).toBeInstanceOf(Error);
		expect(error.message).toContain('patternProperties');
	});
});
