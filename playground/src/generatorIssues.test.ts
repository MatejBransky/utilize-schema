import { parse } from '@utilize/json-schema';
import type { JSONSchema } from '@utilize/json-schema';
import { transformWithOxc } from 'vite';
import { expect, test } from 'vitest';

import './polyfills';

import { defaultFormatMode } from './formatMode';
import { generateCodeFor } from './generateCode';
import { loadModule, validateModule } from './runtime';

const schema = {
	$schema: 'http://json-schema.org/draft-07/schema#',
	title: 'Person',
	type: 'object',
	properties: {
		firstName: { type: 'string' },
		lastName: { type: 'string' },
		age: { type: 'integer' },
		address: {
			type: 'object',
			properties: { zip: { type: 'string', pattern: '^[0-9]{5}$' } },
		},
	},
	required: ['firstName', 'lastName'],
} satisfies JSONSchema;

const data = {
	firstName: 'Ada',
	age: '36',
	address: { zip: '1245' },
};

const expectedPaths = ['$.lastName', '$.age', '$.address.zip'];

for (const target of ['zod', 'effect'] as const) {
	test(`${target} reports every invalid field instead of stopping at the first`, async () => {
		const { root } = await parse(structuredClone(schema), {
			cwd: '/',
			fileName: 'person.json',
		});
		const { runtime } = generateCodeFor(target, root, defaultFormatMode);

		if (!runtime || runtime.status !== 'generated' || !runtime.rootName) {
			throw new Error(`The ${target} validator was not generated.`);
		}

		const { code: javascript } = await transformWithOxc(runtime.code, 'schema.ts');
		const module = await loadModule(javascript);
		const result = await validateModule(target, module, runtime.rootName, data);

		expect(result.error).toBeUndefined();
		expect(result.ok).toBe(false);
		expect(result.issues.map((issue) => issue.path)).toHaveLength(expectedPaths.length);
		expect(result.issues.map((issue) => issue.path)).toEqual(expect.arrayContaining(expectedPaths));
	});
}
