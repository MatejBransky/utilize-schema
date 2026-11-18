import { Schema } from 'effect';
import { expect, test } from 'vitest';

import './polyfills';

import { validateWithEffect } from './runtime';

const person = Schema.Struct({
	firstName: Schema.String,
	lastName: Schema.String,
	age: Schema.Number,
	address: Schema.Struct({
		zip: Schema.String.check(Schema.isPattern(/^[0-9]{5}$/)),
	}),
});

test('Effect reports every invalid field instead of stopping at the first', () => {
	const result = validateWithEffect(person, {
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
