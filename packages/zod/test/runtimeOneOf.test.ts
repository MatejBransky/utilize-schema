import { z } from 'zod';
import { describe, expect, test } from 'vitest';

import { oneOfSchema } from '../src/runtime';

describe('oneOfSchema', () => {
	test('returns the transformed output of the only matching branch', () => {
		const schema = oneOfSchema([z.string().transform((value) => value.length)]);

		expect(schema.parse('abc')).toBe(3);
	});

	test('rejects values that match no branch', () => {
		const schema = oneOfSchema([z.string(), z.number()]);

		expect(schema.safeParse(false).success).toBe(false);
	});

	test('rejects values that match more than one branch', () => {
		const schema = oneOfSchema([z.string(), z.string().min(1)]);

		expect(schema.safeParse('abc').success).toBe(false);
	});
});
