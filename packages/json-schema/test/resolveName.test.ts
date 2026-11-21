import { describe, expect, it } from 'vitest';

import {
	allocateName,
	generateName,
	justName,
	mapDeclarationNames,
	mapName,
	Meta,
	resolveExplicitName,
	resolveName,
	stripExtension,
	toSafeString,
	type JSONSchema,
	type ParsedJSONSchemaObject,
} from '../src';

function withMeta(schema: JSONSchema, meta: Partial<Meta> = {}) {
	Object.defineProperty(schema, Meta, {
		enumerable: false,
		value: { ...meta },
		writable: true,
		configurable: true,
	});

	return schema as ParsedJSONSchemaObject;
}

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

	it('keeps looking for a free name when the first suffix is taken', () => {
		const used = new Set(['Foobar', 'Foobar1', 'Foobar2']);
		const schema = withMeta({ $id: 'Foobar' });
		expect(resolveName({ schema, usedNames: used })).toBe('Foobar3');
	});

	it('falls back to Unknown if nothing else matches', () => {
		const schema = withMeta({});
		expect(resolveName({ schema })).toBe('Unknown');
	});

	it('uses custom resolver if provided', () => {
		const schema = withMeta({}, { parent: null, fileName: 'kebab-case.schema' });
		const customResolver = (candidate: ParsedJSONSchemaObject) => {
			candidate[Meta].fileName = candidate[Meta].fileName.replace(/\.schema$/, '');
		};

		expect(resolveName({ schema, customResolver })).toBe('KebabCase');
	});

	it('returns a custom name as it is, without reserving it', () => {
		const used = new Set<string>();
		const schema = withMeta({ $id: 'Ignored' });

		expect(resolveName({ schema, usedNames: used, customResolver: () => 'my name' })).toBe(
			'my name'
		);
		expect(used).toEqual(new Set());
	});
});

describe('resolveExplicitName', () => {
	it('uses the last segment of $id', () => {
		const schema = withMeta({ $id: 'https://example.com/schemas/user.json#' });
		expect(resolveExplicitName({ schema })).toBe('User');
	});

	it('returns undefined without a custom name, $id or title', () => {
		const schema = withMeta({}, { path: ['$defs', 'Named'] });
		expect(resolveExplicitName({ schema })).toBeUndefined();
	});
});

describe('generateName', () => {
	it('reserves the name it returns', () => {
		const used = new Set<string>();

		expect(generateName('user', used)).toBe('User');
		expect(generateName('user', used)).toBe('User1');
		expect(used).toEqual(new Set(['User', 'User1']));
	});

	it('names a string without usable characters NoName', () => {
		expect(generateName('123', new Set())).toBe('NoName');
	});
});

describe('toSafeString', () => {
	it('turns any string into an identifier', () => {
		expect(toSafeString('déjà vu')).toBe('DejaVu');
		expect(toSafeString('snake_case_name')).toBe('SnakeCaseName');
		expect(toSafeString('2fast')).toBe('Fast');
	});
});

describe('justName and stripExtension', () => {
	it('keeps the file name without its extension', () => {
		expect(justName('foo/bar/baz.json')).toBe('baz');
		expect(justName('C:\\schemas\\baz.schema.json')).toBe('baz.schema');
		expect(justName('foo/')).toBeUndefined();
	});

	it('keeps a leading dot', () => {
		expect(stripExtension('.hidden')).toBe('.hidden');
	});
});

describe('mapName', () => {
	it('keeps the resolved name without a mapper', () => {
		expect(mapName('User')).toBe('User');
	});

	it('keeps a mapped identifier as it is', () => {
		expect(mapName('User', (name) => `${name.toLowerCase()}Schema`)).toBe('userSchema');
	});

	it('turns a mapped non-identifier into one, or falls back to the resolved name', () => {
		expect(mapName('User', (name) => `${name} schema`)).toBe('UserSchema');
		expect(mapName('User', () => '!!!')).toBe('User');
	});
});

describe('mapDeclarationNames', () => {
	it('allocates values and types in separate pools', () => {
		const { names, valueNames, typeNames } = mapDeclarationNames(['User', 'User'], {
			schemaName: (name) => `${name}Schema`,
			reservedNames: ['z'],
		});

		expect(names).toEqual([
			{ schema: 'UserSchema', type: 'User' },
			{ schema: 'UserSchema1', type: 'User1' },
		]);
		expect(valueNames).toEqual(new Set(['z', 'UserSchema', 'UserSchema1']));
		expect(typeNames).toEqual(new Set(['z', 'User', 'User1']));
	});
});

describe('allocateName', () => {
	it('uses the first free numeric suffix', () => {
		const used = new Set(['Value', 'Value1']);

		expect(allocateName('Value', used)).toBe('Value2');
		expect(used.has('Value2')).toBe(true);
	});
});
