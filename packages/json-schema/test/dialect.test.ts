import { describe, expect, test } from 'vitest';

import {
	type DialectIssue,
	DialectError,
	Meta,
	dialects,
	detectDialect,
	detectSchemaVersion,
	type JSONSchema,
	normalizeSchema,
	parse,
	prepareSchema,
	readDialectCliOptions,
	resolveDialect,
} from '../src';

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

	test('keeps the deprecated version helper working', () => {
		expect(detectSchemaVersion({ $schema: twentyTwentyTwelve })).toBe('2020-12');
		expect(detectSchemaVersion({})).toBe('draft-07');
		expect(detectSchemaVersion({}, '2019-09')).toBe('2019-09');
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
				{ $schema: twentyTwentyTwelve, type: 'array', contains: {}, minContains: 2 },
				{ keywordPolicy: 'ignore' }
			)
		).toThrow(/"minContains" is not supported/);
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
		const schema = { $schema: twentyTwentyTwelve, type: 'object' } as JSONSchema;
		const parsed = await parse(schema, { cwd: __dirname + '/', fileName: 'Root.json' });
		const root = parsed.root as NonNullable<typeof parsed.root>;

		expect(typeof root).toBe('object');
		expect((root as { [Meta]: { dialect: string } })[Meta].dialect).toBe('2020-12');
		expect((root as { [Meta]: { dialectSource: string } })[Meta].dialectSource).toBe('declared');
	});

	test('gives nodes outside the visited keywords the dialect of their parent', async () => {
		const schema = {
			$schema: twentyTwentyTwelve,
			type: 'object',
			properties: { name: { type: 'string' } },
		} as JSONSchema;
		const parsed = await parse(schema, {
			cwd: __dirname + '/',
			fileName: 'Root.json',
			dialect: '2019-09',
		});
		const properties = (parsed.root as unknown as { properties: { [Meta]: Meta } }).properties;

		expect(properties[Meta]).toMatchObject({ dialect: '2019-09', dialectSource: 'forced' });
	});

	test('resolves the dialect inside unevaluatedItems', async () => {
		const schema = {
			$schema: twentyTwentyTwelve,
			type: 'array',
			items: { type: 'string' },
			unevaluatedItems: { type: 'object', dependentRequired: { a: ['b'] } },
		} as JSONSchema;
		const parsed = await parse(schema, { cwd: __dirname + '/', fileName: 'Root.json' });
		const unevaluated = (parsed.root as unknown as { unevaluatedItems: Record<string, unknown> })
			.unevaluatedItems;

		expect((unevaluated as { [Meta]: Meta })[Meta]).toMatchObject({
			dialect: '2020-12',
			dialectSource: 'declared',
		});
		expect(unevaluated.dependencies).toEqual({ a: ['b'] });
	});

	test('marks a schema without $schema as a fallback', async () => {
		const parsed = await parse({ type: 'string' } as JSONSchema, {
			cwd: __dirname + '/',
			fileName: 'Root.json',
		});
		const root = parsed.root as NonNullable<typeof parsed.root>;

		expect((root as { [Meta]: { dialect: string } })[Meta].dialect).toBe('draft-07');
		expect((root as { [Meta]: { dialectSource: string } })[Meta].dialectSource).toBe('fallback');
	});

	test('keeps the dialect per embedded resource', async () => {
		const parsed = await parse(
			{
				$schema: draft07,
				$defs: {
					nested: {
						$id: 'https://example.com/nested',
						$schema: twentyTwentyTwelve,
						type: 'string',
					},
				},
			} as unknown as JSONSchema,
			{ cwd: __dirname + '/', fileName: 'Root.json' }
		);
		const root = parsed.root as NonNullable<typeof parsed.root>;
		const nested = (root as { $defs: Record<string, { [Meta]: { dialect: string } } | undefined> })
			.$defs.nested;

		expect(nested?.[Meta].dialect).toBe('2020-12');
	});

	test('does not mutate the caller schema', async () => {
		const schema = {
			$schema: 'http://json-schema.org/draft-04/schema#',
			type: 'number',
			minimum: 0,
			exclusiveMinimum: true,
		} as unknown as JSONSchema;

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
