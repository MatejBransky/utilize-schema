import {
	ASTKind,
	generateName,
	type JSONSchema,
} from '@utilize/json-schema-core';
import { describe, expect, test, vi } from 'vitest';

import { generate } from '../../src';
import { compile, ts } from '../test-utils';

describe('string constraints', () => {
	test('minLength', async () => {
		await expect(compile({ type: 'string', minLength: 5 })).toMatchCode(ts`
      export const Unknown = z.string().min(5)
      export type Unknown = z.infer<typeof Unknown>;
    `);
	});

	test('maxLength', async () => {
		await expect(compile({ type: 'string', maxLength: 10 })).toMatchCode(ts`
      export const Unknown = z.string().max(10)
      export type Unknown = z.infer<typeof Unknown>;
    `);
	});

	test('pattern', async () => {
		await expect(compile({ type: 'string', pattern: String.raw`^\d+$` }))
			.toMatchCode(ts`
      export const Unknown = z.string().regex(/^\d+$/)
      export type Unknown = z.infer<typeof Unknown>;
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
      export const ${name} = z.string()${zod};
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

		test('unsupported format logs warning', () => {
			const node = {
				kind: ASTKind.STRING,
				format: 'unsupported-format',
				standaloneName: 'schema',
			};
			const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
			generate(node);
			expect(warnSpy).toHaveBeenCalledWith(
				'Unsupported string format: unsupported-format'
			);
			warnSpy.mockRestore();
		});
	});
});
