import { expect, it } from 'vitest';

import { input } from './fixtures/basic';

import { dereference } from '../src';
import { link } from '../src/linker';
import { Parent, Reference } from '../src/types/JSONSchema';

it("linker should link to each node's parent schema", async () => {
	const dereferenced = await dereference(input, {
		cwd: __dirname + '/fixtures/',
	});
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const schema = link(dereferenced) as any;
	expect(schema[Parent]).toBe(null);
	expect(schema.properties[Parent]).toBe(schema);
	expect(schema.properties.firstName[Parent]).toBe(schema.properties);
	expect(schema.properties.lastName[Parent]).toBe(schema.properties);
	expect(schema.properties.age[Parent]).toBe(schema.properties);
	expect(schema.properties.height[Parent]).toBe(schema.properties);
	expect(schema.properties.favoriteFoods[Parent]).toBe(schema.properties);
	expect(schema.properties.likesDogs[Parent]).toBe(schema.properties);
	expect(schema.required[Parent]).toBe(schema);
	expect(schema.properties.gender[Reference][Parent]).toBe(schema);
});
