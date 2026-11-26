import { assert, describe, expect, test, vi } from 'vitest';

import {
	DialectError,
	isParsedJSONSchemaObject,
	Meta,
	detectDialect,
	dialectOf,
	normalizeSchema,
	parse,
	prepareSchema,
	readDialectCliOptions,
	resolveDialect,
	withSourceMeta,
} from '../src';
import type { DialectIssue, JSONSchema } from '../src';
import { dialects } from '../src/dialect';

const draft07 = 'http://json-schema.org/draft-07/schema#';
const twentyTwentyTwelve = 'https://json-schema.org/draft/2020-12/schema';

describe('detectDialect', () => {
	test.each([
		['http://json-schema.org/draft-04/schema#', 'draft-04'],
		['http://json-schema.org/draft-06/schema#', 'draft-06'],
		['http://json-schema.org/draft-07/schema#', 'draft-07'],
		['https://json-schema.org/draft/2019-09/schema', '2019-09'],
		['https://json-schema.org/draft/2020-12/schema', '2020-12'],
	] as const)('maps %s to %s', (uri, id) => {
		expect(detectDialect({ $schema: uri })?.dialect.id).toBe(id);
	});

	test('returns undefined for an unknown meta-schema', () => {
		expect(detectDialect({ $schema: 'https://example.com/meta' })).toBeUndefined();
	});

	test('returns undefined without $schema', () => {
		expect(detectDialect({ type: 'string' })).toBeUndefined();
	});
});

describe('resolveDialect', () => {
	test('forces the requested dialect', () => {
		const resolved = resolveDialect({ $schema: twentyTwentyTwelve }, { dialect: 'draft-04' });

		expect(resolved.dialect.id).toBe('draft-04');
		expect(resolved.source).toBe('forced');
	});

	test('uses the declared dialect', () => {
		const resolved = resolveDialect({ $schema: twentyTwentyTwelve });

		expect(resolved.dialect.id).toBe('2020-12');
		expect(resolved.source).toBe('declared');
	});

	test('falls back when $schema is missing', () => {
		expect(resolveDialect({}, { fallbackDialect: '2019-09' })).toEqual({
			dialect: dialects['2019-09'],
			source: 'fallback',
		});
	});

	test('falls back for an unknown $schema by default', () => {
		const resolved = resolveDialect({ $schema: 'https://example.com/meta' });

		expect(resolved.dialect.id).toBe('draft-07');
		expect(resolved.source).toBe('fallback');
	});

	test('rejects an unknown $schema with unknownDialect error', () => {
		expect(() =>
			resolveDialect({ $schema: 'https://example.com/meta' }, { unknownDialect: 'error' })
		).toThrow(DialectError);
	});

	test('allows an unknown $schema to use another fallback dialect', () => {
		const resolved = resolveDialect(
			{ $schema: 'https://example.com/meta' },
			{ fallbackDialect: 'draft-06' }
		);

		expect(resolved.dialect.id).toBe('draft-06');
		expect(resolved.source).toBe('fallback');
	});
});

describe('prepareSchema', () => {
	test('annotates the root and inherited nodes', () => {
		const schema = { $schema: twentyTwentyTwelve, type: 'object' };
		const map = prepareSchema(schema);

		expect(map.get(schema)).toEqual({
			dialect: dialects['2020-12'],
			source: 'declared',
		});
	});

	test('visits a shared schema node only once', () => {
		const shared = { type: 'array', prefixItems: [{ type: 'string' }] };
		const schema = {
			$schema: draft07,
			properties: { first: shared, second: shared },
		};
		const issues: DialectIssue[] = [];

		prepareSchema(schema, { onDialectIssue: (issue) => issues.push(issue) });

		expect(issues).toHaveLength(1);
		expect(issues[0]).toMatchObject({ keyword: 'prefixItems', path: ['properties', 'first'] });
	});

	test('visits tuple items and ignores annotation values', () => {
		const item = { type: 'string' };
		const schema = {
			$schema: twentyTwentyTwelve,
			prefixItems: [item],
			default: { nested: { type: 'number' } },
			examples: [{ type: 'boolean' }],
		};
		const map = prepareSchema(schema);

		expect(map.get(item)).toEqual({
			dialect: dialects['2020-12'],
			source: 'declared',
		});
		expect(map.has(schema.default)).toBe(false);
		expect(map.has(schema.examples)).toBe(false);
	});

	test('visits schema dependencies but not property dependency arrays', () => {
		const dependency = { type: 'object', properties: { b: { type: 'string' } } };
		const schema = {
			$schema: draft07,
			dependencies: { a: dependency, b: ['c'] },
		};
		const map = prepareSchema(schema);

		expect(map.get(dependency)?.dialect.id).toBe('draft-07');
	});

	test('switches the dialect at an embedded resource', () => {
		const nested = {
			$id: 'https://example.com/nested',
			$schema: twentyTwentyTwelve,
			prefixItems: [{ type: 'string' }],
		};
		const schema = {
			$schema: draft07,
			$defs: { nested },
		};
		const map = prepareSchema(schema);

		expect(map.get(schema)?.dialect.id).toBe('draft-07');
		expect(map.get(nested)).toEqual({
			dialect: dialects['2020-12'],
			source: 'declared',
		});
	});

	test('inherits the dialect for an embedded resource without $schema', () => {
		const nested = { $id: 'https://example.com/nested', type: 'string' };
		const schema = { $schema: twentyTwentyTwelve, $defs: { nested } };
		const map = prepareSchema(schema);

		expect(map.get(nested)).toEqual({
			dialect: dialects['2020-12'],
			source: 'inherited',
		});
	});

	test('honors a bundled $schema outside a resource root', () => {
		const nested = { $schema: twentyTwentyTwelve, prefixItems: [{ type: 'string' }] };
		const schema = { $schema: draft07, $defs: { nested } };
		const map = prepareSchema(schema);

		expect(map.get(nested)).toEqual({
			dialect: dialects['2020-12'],
			source: 'declared',
		});
	});

	test('rejects prefixItems outside 2020-12 with keywordPolicy error', () => {
		expect(() =>
			prepareSchema(
				{ $schema: draft07, type: 'array', prefixItems: [{ type: 'string' }] },
				{ keywordPolicy: 'error' }
			)
		).toThrow(DialectError);
	});

	test('rejects the tuple form of items in 2020-12 with keywordPolicy error', () => {
		expect(() =>
			prepareSchema(
				{
					$schema: twentyTwentyTwelve,
					type: 'array',
					items: [{ type: 'string' }],
				},
				{ keywordPolicy: 'error' }
			)
		).toThrow(/"items" was removed/);
	});

	test('rejects const in draft-04 with keywordPolicy error', () => {
		expect(() =>
			prepareSchema(
				{ $schema: draft07.replace('07', '04'), type: 'string', const: 'x' },
				{ keywordPolicy: 'error' }
			)
		).toThrow(/"const" is not part of draft-04/);
	});

	test('rejects dependentRequired outside 2019-09 with keywordPolicy error', () => {
		expect(() =>
			prepareSchema(
				{
					$schema: draft07,
					type: 'object',
					dependentRequired: { a: ['b'] },
				},
				{ keywordPolicy: 'error' }
			)
		).toThrow(/"dependentRequired" is not part of draft-07/);
	});

	test('rejects unevaluatedProperties outside 2019-09 with keywordPolicy error', () => {
		expect(() =>
			prepareSchema(
				{ $schema: draft07, type: 'object', unevaluatedProperties: false },
				{ keywordPolicy: 'error' }
			)
		).toThrow(/"unevaluatedProperties" is not part of draft-07/);
	});

	test('rejects boolean exclusive bounds outside draft-04 with keywordPolicy error', () => {
		expect(() =>
			prepareSchema(
				{ $schema: draft07, type: 'number', minimum: 0, exclusiveMinimum: true },
				{ keywordPolicy: 'error' }
			)
		).toThrow(/"exclusiveMinimum" must be a number/);
	});

	test('warns instead of failing by default', () => {
		const issues: DialectIssue[] = [];

		expect(() =>
			prepareSchema(
				{ $schema: draft07, type: 'array', prefixItems: [{ type: 'string' }] },
				{ onDialectIssue: (issue) => issues.push(issue) }
			)
		).not.toThrow();

		expect(issues).toHaveLength(1);
		expect(issues[0]).toMatchObject({ keyword: 'prefixItems', dialect: 'draft-07' });
	});

	test('reports issues instead of failing with keywordPolicy warn', () => {
		const issues: DialectIssue[] = [];

		prepareSchema(
			{ $schema: draft07, type: 'array', prefixItems: [{ type: 'string' }] },
			{ keywordPolicy: 'warn', onDialectIssue: (issue) => issues.push(issue) }
		);

		expect(issues).toHaveLength(1);
		expect(issues[0]).toMatchObject({
			kind: 'unknown-keyword',
			keyword: 'prefixItems',
			dialect: 'draft-07',
			dialectSource: 'declared',
			path: [],
		});
	});

	test('ignores foreign keywords with keywordPolicy ignore', () => {
		expect(() =>
			prepareSchema(
				{ $schema: draft07, type: 'array', prefixItems: [{ type: 'string' }] },
				{ keywordPolicy: 'ignore' }
			)
		).not.toThrow();
	});

	test('accepts boolean additionalProperties and additionalItems in draft-04', () => {
		expect(() =>
			prepareSchema(
				{
					$schema: 'http://json-schema.org/draft-04/schema#',
					type: 'object',
					additionalProperties: false,
					items: [{ type: 'string' }],
					additionalItems: false,
				},
				{ keywordPolicy: 'error' }
			)
		).not.toThrow();
	});

	test('rejects other boolean schemas in draft-04 with keywordPolicy error', () => {
		expect(() =>
			prepareSchema(
				{
					$schema: 'http://json-schema.org/draft-04/schema#',
					type: 'object',
					properties: { name: true },
				},
				{ keywordPolicy: 'error' }
			)
		).toThrow(/draft-04 does not allow boolean schemas/);
	});

	test('marks a referenced document without $schema as inherited', () => {
		const issues: DialectIssue[] = [];
		const schema = { type: 'object', unevaluatedProperties: false };

		const map = prepareSchema(schema, {
			inheritedDialect: 'draft-07',
			onDialectIssue: (issue) => issues.push(issue),
		});

		expect(map.get(schema)).toMatchObject({ source: 'inherited' });
		expect(issues).toEqual([
			expect.objectContaining({ keyword: 'unevaluatedProperties', dialectSource: 'inherited' }),
		]);
	});

	test('reports every foreign keyword on a node', () => {
		const issues: DialectIssue[] = [];

		prepareSchema(
			{
				$schema: draft07,
				type: 'array',
				prefixItems: [{ type: 'string' }],
				dependentRequired: { a: ['b'] },
			},
			{ onDialectIssue: (issue) => issues.push(issue) }
		);

		expect(issues.map((issue) => issue.keyword)).toEqual(['prefixItems', 'dependentRequired']);
	});

	test('preserves keyword issue ordering across validators', () => {
		const issues: DialectIssue[] = [];

		prepareSchema(
			{
				$schema: twentyTwentyTwelve,
				additionalItems: false,
				dependencies: { a: ['b'] },
				items: [{ type: 'string' }],
				exclusiveMinimum: true,
				exclusiveMaximum: false,
			},
			{ onDialectIssue: (issue) => issues.push(issue) }
		);

		expect(issues.map((issue) => issue.keyword)).toEqual([
			'additionalItems',
			'dependencies',
			'items',
			'exclusiveMinimum',
			'exclusiveMaximum',
		]);
	});

	test('reports ignored $ref siblings after the other keyword issues', () => {
		const issues: DialectIssue[] = [];

		prepareSchema(
			{
				$schema: draft07,
				$ref: '#/$defs/target',
				minimum: 0,
				prefixItems: [{ type: 'string' }],
			},
			{ onDialectIssue: (issue) => issues.push(issue) }
		);

		expect(issues.map((issue) => issue.keyword)).toEqual(['prefixItems', 'minimum']);
	});

	test('keeps reporting other issues next to a best-effort unevaluated keyword', () => {
		const issues: DialectIssue[] = [];

		prepareSchema(
			{ type: 'number', minimum: 0, exclusiveMinimum: true, unevaluatedProperties: false },
			{ onDialectIssue: (issue) => issues.push(issue) }
		);

		expect(issues.map((issue) => issue.keyword)).toEqual(['exclusiveMinimum']);
	});

	test('still rejects unsupported keywords of the dialect with keywordPolicy ignore', () => {
		expect(() =>
			prepareSchema(
				{ $schema: twentyTwentyTwelve, $dynamicRef: '#node' },
				{ keywordPolicy: 'ignore' }
			)
		).toThrow(/"\$dynamicRef" is not supported/);
	});

	test('warns about $ref siblings that draft-07 ignores', () => {
		const issues: DialectIssue[] = [];

		prepareSchema(
			{
				$schema: draft07,
				$defs: { Base: { type: 'object' } },
				$ref: '#/$defs/Base',
				properties: { extra: { type: 'string' } },
			},
			{ keywordPolicy: 'warn', onDialectIssue: (issue) => issues.push(issue) }
		);

		expect(issues[0]).toMatchObject({ kind: 'ignored-ref-siblings', dialect: 'draft-07' });
	});

	test('does not warn about $ref siblings in 2020-12', () => {
		const issues: DialectIssue[] = [];

		prepareSchema(
			{
				$schema: twentyTwentyTwelve,
				$defs: { Base: { type: 'object' } },
				$ref: '#/$defs/Base',
				properties: { extra: { type: 'string' } },
			},
			{ keywordPolicy: 'warn', onDialectIssue: (issue) => issues.push(issue) }
		);

		expect(issues).toHaveLength(0);
	});
});

describe('parse metadata', () => {
	test('copies the dialect and its source into Meta', async () => {
		const schema: JSONSchema = { $schema: twentyTwentyTwelve, type: 'object' };
		const parsed = await parse(schema, { cwd: __dirname + '/', fileName: 'Root.json' });
		const root = parsed.root;

		assert(isParsedJSONSchemaObject(root));
		expect(root[Meta].dialect).toBe('2020-12');
		expect(root[Meta].dialectSource).toBe('declared');
	});

	test('withSourceMeta keeps the dialect on a shallow copy', async () => {
		const schema: JSONSchema = { $schema: twentyTwentyTwelve, type: 'object' };
		const parsed = await parse(schema, { cwd: __dirname + '/', fileName: 'Root.json' });
		const root = parsed.root;

		assert(isParsedJSONSchemaObject(root));

		const copy = withSourceMeta(root, { ...root, title: 'Copy' });

		expect(dialectOf({ ...root }).id).toBe('draft-07');
		expect(dialectOf(copy).id).toBe('2020-12');
		expect(Object.getOwnPropertyDescriptor(copy, Meta)?.enumerable).toBe(false);
	});

	test('gives nodes outside the visited keywords the dialect of their parent', async () => {
		const schema: JSONSchema = {
			$schema: twentyTwentyTwelve,
			type: 'object',
			properties: { name: { type: 'string' } },
		};
		const parsed = await parse(schema, {
			cwd: __dirname + '/',
			fileName: 'Root.json',
			dialect: '2019-09',
		});

		assert(isParsedJSONSchemaObject(parsed.root));

		const properties = parsed.root.properties;

		assert(isParsedJSONSchemaObject(properties));
		expect(properties[Meta]).toMatchObject({ dialect: '2019-09', dialectSource: 'forced' });
	});

	test('resolves the dialect inside unevaluatedItems', async () => {
		const unevaluatedItems = Object.assign<
			JSONSchema,
			{ dependentRequired: Record<string, string[]> }
		>({ type: 'object' }, { dependentRequired: { a: ['b'] } });
		const schema: JSONSchema = {
			$schema: twentyTwentyTwelve,
			type: 'array',
			items: { type: 'string' },
			unevaluatedItems,
		};
		const parsed = await parse(schema, { cwd: __dirname + '/', fileName: 'Root.json' });

		assert(isParsedJSONSchemaObject(parsed.root));

		const unevaluated = parsed.root.unevaluatedItems;

		assert(isParsedJSONSchemaObject(unevaluated));
		expect(unevaluated[Meta]).toMatchObject({
			dialect: '2020-12',
			dialectSource: 'declared',
		});
		expect(unevaluated.dependencies).toEqual({ a: ['b'] });
	});

	test('returns dialect issues instead of writing to the console', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const schema: JSONSchema = { $schema: draft07, type: 'array', prefixItems: [{}] };

		const parsed = await parse(schema, { cwd: __dirname + '/', fileName: 'Root.json' });

		expect(parsed.issues).toEqual([expect.objectContaining({ keyword: 'prefixItems' })]);
		expect(warn).not.toHaveBeenCalled();
		warn.mockRestore();
	});

	test('marks a schema without $schema as a fallback', async () => {
		const parsed = await parse(
			{ type: 'string' },
			{
				cwd: __dirname + '/',
				fileName: 'Root.json',
			}
		);
		const root = parsed.root;

		assert(isParsedJSONSchemaObject(root));
		expect(root[Meta].dialect).toBe('draft-07');
		expect(root[Meta].dialectSource).toBe('fallback');
	});

	test('keeps the dialect per embedded resource', async () => {
		const schema: JSONSchema = {
			$schema: draft07,
			$defs: {
				nested: {
					$id: 'https://example.com/nested',
					$schema: twentyTwentyTwelve,
					type: 'string',
				},
			},
		};
		const parsed = await parse(schema, { cwd: __dirname + '/', fileName: 'Root.json' });
		const root = parsed.root;

		assert(isParsedJSONSchemaObject(root));

		const nested = root.$defs?.nested;

		assert(isParsedJSONSchemaObject(nested));
		expect(nested[Meta].dialect).toBe('2020-12');
	});

	test('does not mutate the caller schema', async () => {
		const schema: JSONSchema = {
			$schema: 'http://json-schema.org/draft-04/schema#',
			type: 'number',
			minimum: 0,
		};

		Object.assign(schema, { exclusiveMinimum: true });

		await parse(schema, { cwd: __dirname + '/', fileName: 'Root.json' });
		await parse(schema, { cwd: __dirname + '/', fileName: 'Root.json' });

		expect(schema.exclusiveMinimum).toBe(true);
	});
});

describe('normalizeSchema', () => {
	test('still merges dependent keywords for 2020-12', () => {
		const schema = {
			$schema: twentyTwentyTwelve,
			type: 'object',
			dependentRequired: { a: ['b'] },
			dependentSchemas: { a: { required: ['c'] } },
		};

		normalizeSchema(schema, '2020-12');

		expect(schema).toMatchObject({
			dependencies: {
				a: { allOf: [{ required: ['b'] }, { required: ['c'] }] },
			},
		});
	});

	test('still converts draft-04 boolean exclusive bounds', () => {
		const schema = {
			$schema: draft07.replace('07', '04'),
			type: 'number',
			minimum: 0,
			exclusiveMinimum: true,
		};

		normalizeSchema(schema, 'draft-04');

		expect(schema.exclusiveMinimum).toBe(0);
	});

	test('does not leak normalization across calls', () => {
		const first = { type: 'number', minimum: 0, exclusiveMinimum: true };

		normalizeSchema(first, 'draft-04');
		normalizeSchema(first, 'draft-04');

		expect(first.exclusiveMinimum).toBe(0);
	});
});

describe('readDialectCliOptions', () => {
	test('maps valid flags to dialect options', () => {
		expect(
			readDialectCliOptions({
				dialect: '2020-12',
				'fallback-dialect': 'draft-04',
				'unknown-dialect': 'error',
				'keyword-policy': 'ignore',
			})
		).toEqual({
			ok: true,
			options: {
				dialect: '2020-12',
				fallbackDialect: 'draft-04',
				unknownDialect: 'error',
				keywordPolicy: 'ignore',
			},
		});
	});

	test.each([
		[{ dialect: 'draft-05' }, 'Unknown dialect "draft-05"'],
		[{ 'fallback-dialect': 'auto' }, 'Unknown fallback dialect "auto"'],
		[{ 'unknown-dialect': 'warn' }, '--unknown-dialect'],
		[{ 'keyword-policy': 'nope' }, '--keyword-policy'],
	])('rejects %o', (values, error) => {
		expect(readDialectCliOptions(values)).toEqual({
			ok: false,
			error: expect.stringContaining(error),
		});
	});
});
