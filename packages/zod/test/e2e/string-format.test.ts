import {
	ASTKind,
	generateName,
	type JSONSchema,
} from '@utilize/json-schema-core';
import { describe, expect, test, vi } from 'vitest';

import { generate } from '../../src';
import { compile, ts } from '../test-utils';

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
      import { z } from 'zod';

      export const ${name} = z.string()${zod};
      export type ${name} = z.infer<typeof ${name}>;
    `,
		name: format,
	};
});

describe('Zod string formats', () => {
	testCases.forEach((testCase) => {
		test(testCase.name, async () => {
			const code = await compile(testCase.schema, {
				fileName: `Format ${testCase.name}.json`,
				deref: { cwd: process.cwd(), $refOptions: {} },
			});
			expect(code).toBe(await testCase.expected);
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
