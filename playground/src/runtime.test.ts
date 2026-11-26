import { assert, isPlainObject } from '@utilize/json-schema';
import { Schema } from 'effect';
import { expect, test } from 'vitest';

import './polyfills';

import { loadModule, rootValidator, validateWithEffect, validateWithZod } from './runtime';

const person = Schema.Struct({
	firstName: Schema.String,
	lastName: Schema.String,
	age: Schema.Number,
	address: Schema.Struct({
		zip: Schema.String.check(Schema.isPattern(/^[0-9]{5}$/)),
	}),
});

test('Effect reports every invalid field instead of stopping at the first', async () => {
	const result = await validateWithEffect(person, {
		firstName: 'Ada',
		age: '36',
		address: { zip: '1245' },
	});

	expect(result.ok).toBe(false);
	expect(result.issues.map((issue) => issue.path)).toEqual([
		'$.lastName',
		'$.age',
		'$.address.zip',
	]);
});

test('generated code cannot replace the runtime package bridge', async () => {
	await loadModule("import { z } from 'zod'; export const schema = z.string();");
	await loadModule("import { Schema } from 'effect'; export const schema = Schema.String;");
	const descriptor = Object.getOwnPropertyDescriptor(globalThis, '__utilizePlaygroundPackages');

	assert(descriptor !== undefined, 'Expected the runtime package bridge to be installed.');
	const bridge: unknown = descriptor.value;

	assert(isPlainObject(bridge), 'Expected the runtime package bridge to be an object.');
	assert(isPlainObject(bridge.zod), 'Expected the Zod bridge to be an object.');
	assert(isPlainObject(bridge.effect), 'Expected the Effect bridge to be an object.');

	expect(Object.isFrozen(bridge)).toBe(true);
	expect(Object.isFrozen(bridge.zod)).toBe(true);
	expect(Object.isFrozen(bridge.effect)).toBe(true);
	expect(Reflect.set(bridge, 'zod', { z: {} })).toBe(false);
	expect(Reflect.set(bridge.zod, 'z', {})).toBe(false);

	await expect(
		loadModule(`
			import { z } from 'zod';
			globalThis.__utilizePlaygroundPackages = { zod: { z: {} } };
			export const schema = z.string();
		`)
	).rejects.toThrow();

	const module = await loadModule("import { z } from 'zod'; export const schema = z.string();");
	const result = await validateWithZod(rootValidator(module, 'schema'), 'still works');

	expect(result).toMatchObject({ ok: true, value: 'still works', issues: [] });
});
