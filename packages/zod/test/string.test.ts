import type { JSONSchema } from '@utilize/json-schema';
import { describe, test, expect } from 'vitest';

import { compile, ts } from './test-utils';

import { generateName } from '../src/resolveName';

describe('string constraints', () => {
	test('minLength', async () => {
		await expect(compile({ type: 'string', minLength: 5 })).toMatchCode(ts`
      export const Root = z.string().min(5)
      export type Root = z.infer<typeof Root>;
    `);
	});

	test('maxLength', async () => {
		await expect(compile({ type: 'string', maxLength: 10 })).toMatchCode(ts`
      export const Root = z.string().max(10)
      export type Root = z.infer<typeof Root>;
    `);
	});

	test('pattern', async () => {
		await expect(compile({ type: 'string', pattern: String.raw`^\d+$` }))
			.toMatchCode(ts`
      export const Root = z.string().regex(/^\d+$/)
      export type Root = z.infer<typeof Root>;
    `);
	});

	const formats = [
		{ format: 'email', zod: '.email()' },
		{ format: 'uuid', zod: '.uuid()' },
		{ format: 'url', zod: '.url()' },
		{ format: 'uri', zod: '.url()' },
		{ format: 'emoji', zod: '.emoji()' },
		{ format: 'base64', zod: '.base64()' },
		{ format: 'base64url', zod: '.base64url()' },
		{ format: 'nanoid', zod: '.nanoid()' },
		{ format: 'cuid', zod: '.cuid()' },
		{ format: 'cuid2', zod: '.cuid2()' },
		{ format: 'ulid', zod: '.ulid()' },
		{ format: 'ipv4', zod: '.ipv4()' },
		{ format: 'ipv6', zod: '.ipv6()' },
		{ format: 'cidrv4', zod: '.cidrv4()' },
		{ format: 'cidrv6', zod: '.cidrv6()' },
		{ format: 'date', zod: '.iso.date()' },
		{ format: 'time', zod: '.iso.time()' },
		{ format: 'date-time', zod: '.iso.datetime()' },
		{ format: 'duration', zod: '.iso.duration()' },
	];

	const testCases = formats.map(({ format, zod }) => {
		const name = `Format${generateName(format, new Set())}`;
		return {
			schema: { type: 'string', format } satisfies JSONSchema,
			expected: ts`
      export const ${name} = z${zod};
      export type ${name} = z.infer<typeof ${name}>;
    `,
			name: format,
		};
	});

	describe('format', () => {
		testCases.forEach((testCase) => {
			test(testCase.name, async () => {
				expect(
					compile(testCase.schema, {
						fileName: `Format ${testCase.name}.json`,
					})
				).toMatchCode(testCase.expected);
			});
		});
	});
});
