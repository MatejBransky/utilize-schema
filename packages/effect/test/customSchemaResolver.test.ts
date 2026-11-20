import { describe, expect, test } from 'vitest';

import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { compile as compileToFile, type CustomSchemaResolver } from '../src';
import { compile, ts, type TestSchema } from './test-utils';

describe('customSchemaResolver', () => {
	test('replaces a matching schema node with a custom Effect Schema expression', async () => {
		await expect(
			compile(
				{
					type: 'object',
					properties: { created: { type: 'string', format: 'date-time' } },
					required: ['created'],
				},
				{
					customSchemaResolver: (schema) =>
						schema.format === 'date-time' ? 'Schema.String' : undefined,
				}
			)
		).toMatchCode(ts`
      export const Root = Schema.StructWithRest(
        Schema.Struct({ created: Schema.String }),
        [Schema.Record(Schema.String, Schema.Json)]
      );

      export type Root = typeof Root.Type;
    `);
	});

	test('types a replaced node as unknown in the value type of a recursive schema', async () => {
		await expect(
			compile(
				{
					type: 'object',
					title: 'Node',
					properties: {
						created: { type: 'string', format: 'date-time' },
						children: { type: 'array', items: { $ref: '#' } },
					},
					required: ['created'],
				},
				{
					customSchemaResolver: (schema) =>
						schema.format === 'date-time' ? 'Schema.Finite' : undefined,
				}
			)
		).toMatchCode(ts`
      type NodeValue = { created: unknown; children?: ReadonlyArray<NodeValue> };

      export const Node: Schema.Codec<NodeValue> = Schema.StructWithRest(
        Schema.Struct({
          created: Schema.Finite,
          children: Schema.optionalKey(Schema.Array(Schema.suspend(() => Node))),
        }),
        [Schema.Record(Schema.String, Schema.Json)]
      ).annotate({ title: 'Node' });

      export type Node = typeof Node.Type;
    `);
	});

	test('replaces a single type of a type list, like the Zod generator', async () => {
		await expect(
			compile(
				{ type: ['string', 'null'], format: 'date-time' },
				{
					customSchemaResolver: (schema) =>
						schema.type === 'string' && schema.format === 'date-time' ? 'Schema.Finite' : undefined,
				}
			)
		).toMatchCode(ts`
      export const Root = Schema.Union([Schema.Finite, Schema.Null]).annotate({ format: 'date-time' });

      export type Root = typeof Root.Type;
    `);
	});

	test('replaces a node the generator rejects', async () => {
		const schema: TestSchema = { type: 'string', pattern: '[' };

		await expect(compile(schema)).rejects.toThrow(/pattern/);
		await expect(
			compile(schema, {
				customSchemaResolver: (node) => (node.pattern === undefined ? undefined : 'Schema.Json'),
			})
		).toMatchCode(ts`
      export const Root = Schema.Json;

      export type Root = typeof Root.Type;
    `);
	});

	test('asks a schema resolver once per dependency', async () => {
		const seen: string[] = [];

		await compile(
			{
				type: 'object',
				properties: { a: { type: 'string' } },
				dependencies: { a: { required: ['b'] } },
			},
			{
				customSchemaResolver: (schema) => {
					seen.push(JSON.stringify(schema));
					return undefined;
				},
			}
		);

		// The narrowed copy reaches the resolver through `generateSchema`, but the
		// original node must not be resolved twice before it is narrowed.
		expect(seen.filter((node) => node === '{"required":["b"]}')).toHaveLength(1);
	});

	test('leaves unmatched nodes to the generator', async () => {
		await expect(compile({ type: 'string' }, { customSchemaResolver: () => undefined }))
			.toMatchCode(ts`
      export const Root = Schema.String;

      export type Root = typeof Root.Type;
    `);
	});

	test('is passed on by compile()', async () => {
		// Typed with the package export, so dropping the export fails `check:types`.
		const dateTimeResolver: CustomSchemaResolver = (schema) =>
			schema.format === 'date-time' ? 'Schema.Finite' : undefined;
		const directory = await mkdtemp(join(tmpdir(), 'utilize-effect-resolver-'));

		try {
			await writeFile(
				join(directory, 'schema.json'),
				JSON.stringify({ type: 'string', format: 'date-time' })
			);
			await compileToFile({
				input: 'schema.json',
				cwd: directory,
				customSchemaResolver: dateTimeResolver,
			});

			expect(await readFile(join(directory, 'schema.generated.ts'), 'utf8')).toContain(
				'Schema.Finite'
			);
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});
});
