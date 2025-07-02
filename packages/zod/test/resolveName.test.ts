import { Meta, type ParsedJSONSchemaObject } from '@utilize/json-schema';
import { describe, expect, it } from 'vitest';

import { withMeta } from './test-utils';

import { resolveName } from '../src/resolveName';

describe('resolveName', () => {
	it('prefers $id if present', () => {
		const schema = withMeta({ $id: 'FooBar' });
		expect(resolveName({ schema })).toBe('FooBar');
	});

	it('prefers title if $id is missing', () => {
		const schema = withMeta({ title: 'My Schema' });
		expect(resolveName({ schema })).toBe('MySchema');
	});

	it('uses $defs key from path', () => {
		const schema = withMeta({}, { path: ['root', '$defs', 'MyDef'] });
		expect(resolveName({ schema })).toBe('MyDef');
	});

	it('uses definitions key from path', () => {
		const schema = withMeta({}, { path: ['root', 'definitions', 'OtherDef'] });
		expect(resolveName({ schema })).toBe('OtherDef');
	});

	it('uses fileName from Meta for external schemas', () => {
		const schema = withMeta({}, { parent: null, fileName: 'ExternalSchema' });
		expect(resolveName({ schema })).toBe('ExternalSchema');
	});

	it('deduplicates names using usedNames', () => {
		const used = new Set(['Foobar']);
		const schema = withMeta({ $id: 'Foobar' });
		expect(resolveName({ schema, usedNames: used })).toBe('Foobar1');
	});

	it('falls back to Unknown if nothing else matches', () => {
		const schema = withMeta({});
		expect(resolveName({ schema })).toBe('Unknown');
	});

	it('uses custom resolver if provided', () => {
		const schema = withMeta(
			{},
			{ parent: null, fileName: 'kebab-case.schema' }
		);
		const customResolver = (schema: ParsedJSONSchemaObject) => {
			schema[Meta].fileName = schema[Meta].fileName.replace(/\.schema$/, '');
		};
		expect(resolveName({ schema, customResolver })).toBe('KebabCase');
	});
});
