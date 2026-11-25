import { describe, expect, test } from 'vitest';

import { compile } from './test-utils';

import { UnsupportedCyclicReferenceError, UnsupportedPatternError } from '../src/index';

describe('errors exported from the package entry', () => {
	test('a union-only cycle throws UnsupportedCyclicReferenceError', async () => {
		await expect(
			compile({
				anyOf: [{ $ref: '#' }, { type: 'null' }],
			})
		).rejects.toBeInstanceOf(UnsupportedCyclicReferenceError);
	});

	test('a pattern rejected in unicode mode throws UnsupportedPatternError', async () => {
		await expect(compile({ type: 'string', pattern: 'a{' })).rejects.toBeInstanceOf(
			UnsupportedPatternError
		);
	});
});
