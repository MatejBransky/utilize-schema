import { expect, test } from 'vitest';

import MainSchema from './dereference/MainSchema.json';

import { dereference } from '../src/dereference';
import type { JSONSchema } from '../src/types/JSONSchema';

test('dereference()', async () => {
	const schema = structuredClone(MainSchema) as JSONSchema;
	const result = await dereference(schema, {
		$refOptions: {},
		cwd: __dirname + '/dereference/',
	});

	expect(result.dereferencedSchema).toEqual({
		$schema: 'http://json-schema.org/draft-07/schema#',
		type: 'string',
		enum: ['a', 'b', 'c'],
	});
	expect(result.dereferencedPaths).toMatchInlineSnapshot(`WeakMap {}`);
});
