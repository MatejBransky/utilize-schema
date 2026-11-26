import type { JSONSchema } from '@utilize/json-schema';
import { describe, test, expect } from 'vitest';

import { compileToZod, generateCode, ts } from './test-utils';

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
		{ format: 'uuid', zod: '.uuid()' },
		{ format: 'url', zod: '.url()' },
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
			const code = await generateCode({ type: 'string', format: 'email' });

			expect(code).toContain('z\n\t.string()\n\t.refine(');
			expect(code).toContain(".meta({ format: 'email' })");
		});

		test('keeps a known format as metadata in annotate mode', async () => {
			await expect(generateCode({ type: 'string', format: 'email' }, { formatMode: 'annotate' }))
				.toMatchCode(ts`
        export const Root = z.string().meta({ format: 'email' });
        export type Root = z.infer<typeof Root>;
      `);
		});

		test('emits one complex validator and reuses it', async () => {
			const code = await generateCode({
				type: 'object',
				properties: {
					email: { type: 'string', format: 'email' },
					backup: { type: 'string', format: 'email' },
				},
			});

			expect(code.match(/const formatEmail =/g)).toHaveLength(1);
			expect(code.match(/\.refine\(formatEmail,/g)).toHaveLength(2);
		});

		test('keeps string constraints next to an asserted format', async () => {
			const code = await generateCode({ type: 'string', format: 'email', minLength: 5 });
			const Root = await compileToZod({ type: 'string', format: 'email', minLength: 5 });

			expect(code).toContain('.min(5)');
			expect(code).toContain(".meta({ format: 'email' })");
			expect(Root.safeParse('a@b').success).toBe(false);
			expect(Root.safeParse('user@example.com').success).toBe(true);
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

		test.each([
			['email', '"joe bloggs"@example.com', 'te..st@example.com'],
			['idn-email', '실례@실례.테스트', 'δοκιμή@-example.com'],
			['hostname', 'xn--9n2bp8q.xn--9t4b11yi5a', 'ab--cd.example'],
			['idn-hostname', 'a。b', 'a·l'],
			['uri', 'mailto:John.Doe@example.com', 'http://example.com/%6G'],
			['uri-reference', '//', '1:b'],
			['iri', 'http://ƒøø.ßår/?∂éœ=πîx#πîüx', 'http://2001:db8::1'],
			['iri-reference', '/âππ', 'â:b'],
			['json-pointer', '/foo/bar~0', '/~2'],
			['relative-json-pointer', '0#', '01/a'],
			['regex', 'a|b', '*a'],
			['uri-template', '{+var}', '{v:0}'],
			['time', '08:30:06+00:20', '12:00:00'],
			['date-time', '1998-12-31T15:59:60.123-08:00', '1998-12-31T22:59:60Z'],
		])('asserts %s with structural validation', async (format, valid, invalid) => {
			const Root = await compileToZod({ type: 'string', format }, { formatMode: 'assert' });

			expect(Root.safeParse(valid).success, `${valid} should be valid`).toBe(true);
			expect(Root.safeParse(invalid).success, `${invalid} should be invalid`).toBe(false);
		});

		test('keeps a custom format override independent of the built-in validators', async () => {
			const Root = await compileToZod(
				{ type: 'string', format: 'email' },
				{ formatMap: { email: 'z.string().endsWith("@example.com")' } }
			);

			expect(Root.safeParse('not-an-email@example.com').success).toBe(true);
			expect(Root.safeParse('user@example.org').success).toBe(false);
		});

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
