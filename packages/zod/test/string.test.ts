import type { JSONSchema } from '@utilize/json-schema';
import { describe, test, expect } from 'vitest';

import { generateCode, ts } from './test-utils';

import { generateName } from '../src/resolveName';

describe('string constraints', () => {
	test('minLength', async () => {
		await expect(generateCode({ type: 'string', minLength: 5 })).toMatchCode(ts`
      export const Root = z.string().min(5)
      export type Root = z.infer<typeof Root>;
    `);
	});

	test('maxLength', async () => {
		await expect(generateCode({ type: 'string', maxLength: 10 })).toMatchCode(ts`
      export const Root = z.string().max(10)
      export type Root = z.infer<typeof Root>;
    `);
	});

	test('pattern', async () => {
		await expect(generateCode({ type: 'string', pattern: String.raw`^\d+$` })).toMatchCode(ts`
      export const Root = z.string().regex(/^\d+$/u)
      export type Root = z.infer<typeof Root>;
    `);
	});

	test('names the keyword when unicode mode rejects a pattern', async () => {
		const pattern = String.raw`^\-?\d+$`;

		await expect(generateCode({ type: 'string', pattern })).rejects.toThrow(
			`"pattern" is not a valid ECMAScript regular expression in unicode mode: ${JSON.stringify(pattern)}.`
		);
	});

	test('names patternProperties when unicode mode rejects a pattern', async () => {
		await expect(
			generateCode({ type: 'object', patternProperties: { 'a{': { type: 'string' } } })
		).rejects.toThrow(
			'"patternProperties" is not a valid ECMAScript regular expression in unicode mode: "a{".'
		);
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
        export const ${name} = z${zod}.meta({ format: '${format}' });
        export type ${name} = z.infer<typeof ${name}>;
      `,
			name: format,
		};
	});

	describe('format', () => {
		testCases.forEach((testCase) => {
			test(testCase.name, async () => {
				await expect(
					generateCode(testCase.schema, {
						fileName: `Format ${testCase.name}.json`,
						formatMode: 'assert',
					})
				).toMatchCode(testCase.expected);
			});
		});

		test('validates a known format by default', async () => {
			await expect(generateCode({ type: 'string', format: 'email' })).toMatchCode(ts`
        export const Root = z.email().meta({ format: 'email' });
        export type Root = z.infer<typeof Root>;
      `);
		});

		test('keeps a known format as metadata in annotate mode', async () => {
			await expect(generateCode({ type: 'string', format: 'email' }, { formatMode: 'annotate' }))
				.toMatchCode(ts`
        export const Root = z.string().meta({ format: 'email' });
        export type Root = z.infer<typeof Root>;
      `);
		});

		test('keeps string constraints next to an asserted format', async () => {
			await expect(generateCode({ type: 'string', format: 'email', minLength: 5 })).toMatchCode(ts`
        export const Root = z.email().min(5).meta({ format: 'email' });
        export type Root = z.infer<typeof Root>;
      `);
		});

		test('maps a custom format to a Zod expression', async () => {
			await expect(
				generateCode(
					{ type: 'string', format: 'phone-number' },
					{
						formatMap: {
							'phone-number': String.raw`z.string().regex(/^\d{3}-\d{4}$/)`,
						},
					}
				)
			).toMatchCode(ts`
        export const Root = z.string().regex(/^\d{3}-\d{4}$/).meta({ format: 'phone-number' });
        export type Root = z.infer<typeof Root>;
      `);
		});

		test.each(['constructor', 'toString'])(
			'treats the inherited object key %s as an unknown format',
			async (format) => {
				const expected = ts`
          export const Root = z.string().meta({ format: '${format}' });
          export type Root = z.infer<typeof Root>;
        `;

				await expect(generateCode({ type: 'string', format })).toMatchCode(expected);
				await expect(generateCode({ type: 'string', format }, { formatMap: {} })).toMatchCode(
					expected
				);
			}
		);

		test('lets formatMap override a built-in format and keeps string constraints', async () => {
			await expect(
				generateCode(
					{ type: 'string', format: 'email', minLength: 5 },
					{ formatMap: { email: 'z.string().endsWith("@example.com")' } }
				)
			).toMatchCode(ts`
        export const Root = z.string().endsWith('@example.com').min(5).meta({ format: 'email' });
        export type Root = z.infer<typeof Root>;
      `);
		});
	});
});
