import { describe, expect, test } from 'vitest';

import { dialectOf, Meta, parse } from '@utilize/json-schema';
import type { ParsedJSONSchemaObject } from '@utilize/json-schema';

import type { CustomSchemaResolver } from '../src/context';
import { renderValueTypeDeclaration } from '../src/valueTypes';
import type { ValueTypeContext } from '../src/valueTypes';

import type { TestSchema } from './test-utils';

async function render(
	schema: TestSchema,
	customSchemaResolver?: CustomSchemaResolver
): Promise<string> {
	const parsed = await parse(schema, { cwd: __dirname, fileName: 'Root.json' });
	const root = parsed.root as ParsedJSONSchemaObject;
	const context: ValueTypeContext = {
		dialect: dialectOf(root),
		aliasFor: (target) => (target === root ? 'Value' : undefined),
		typeNameFor: (target) => target[Meta]?.resolvedName ?? 'Other',
		customSchemaResolver,
	};

	return renderValueTypeDeclaration('Value', root, context);
}

describe('value type rendering characterization', () => {
	test('renders recursive object members and arrays', async () => {
		expect(
			await render({
				type: 'object',
				properties: {
					value: { type: 'string' },
					children: { type: 'array', items: { $ref: '#' } },
				},
				required: ['value'],
			})
		).toMatchInlineSnapshot(`"type Value = { value: string; children?: ReadonlyArray<Value> };"`);
	});

	test('renders recursive records as interfaces', async () => {
		expect(await render({ type: 'object', additionalProperties: { $ref: '#' } }))
			.toMatchInlineSnapshot(`
			"interface Value {
				[key: string]: Value;
			}"
		`);
	});

	test('degrades a direct self reference to Schema.Json', async () => {
		expect(await render({ $ref: '#' })).toMatchInlineSnapshot(`"type Value = Schema.Json;"`);
	});

	test('renders literals, compositions, and type arrays', async () => {
		expect(
			await render({
				type: 'object',
				properties: {
					literal: { const: { a: 1 } },
					choices: { enum: ['a', 'b'] },
					both: { allOf: [{ type: 'string' }, { minLength: 1 }] },
					any: { anyOf: [{ type: 'string' }, { type: 'null' }] },
					one: { oneOf: [{ type: 'number' }, { type: 'boolean' }] },
					types: { type: ['string', 'null'] },
					next: { $ref: '#' },
				},
			})
		).toMatchInlineSnapshot(
			`"type Value = { literal?: { a: 1 }; choices?: "a" | "b"; both?: Schema.Json & string; any?: string | null; one?: number | boolean; types?: string | null; next?: Value };"`
		);
	});

	test('renders closed and open tuples with optional elements', async () => {
		expect(
			await render({
				$schema: 'https://json-schema.org/draft/2020-12/schema',
				type: 'object',
				properties: {
					closed: {
						type: 'array',
						prefixItems: [{ type: 'string' }, { $ref: '#' }],
						items: false,
						minItems: 1,
					} as TestSchema,
					open: {
						type: 'array',
						prefixItems: [{ type: 'number' }],
						items: { $ref: '#' },
					} as TestSchema,
				},
			})
		).toMatchInlineSnapshot(
			`"type Value = { closed?: readonly [string, Value?]; open?: readonly [number?, ...Value[]] };"`
		);
	});

	test('renders pattern records as Schema.Json values', async () => {
		expect(
			await render({
				type: 'object',
				patternProperties: { '^x-': { $ref: '#' } },
				additionalProperties: { type: 'number' },
			})
		).toMatchInlineSnapshot(`
			"interface Value {
				[key: string]: Schema.Json;
			}"
		`);
	});

	test('renders resolved references and merged reference siblings', async () => {
		expect(
			await render({
				$defs: {
					Child: { type: 'object', properties: { id: { type: 'string' } } },
				},
				type: 'object',
				properties: {
					child: { $ref: '#/$defs/Child' },
					merged: {
						$ref: '#/$defs/Child',
						properties: { extra: { type: 'boolean' } },
						required: ['extra'],
					},
					checked: { $ref: '#/$defs/Child', minProperties: 1 },
					next: { $ref: '#' },
				},
			})
		).toMatchInlineSnapshot(
			`"type Value = { child?: Other; merged?: Other; checked?: Other; next?: Value };"`
		);
	});

	test('renders caller-resolved nodes as unknown', async () => {
		expect(
			await render(
				{
					type: 'object',
					properties: {
						custom: { type: 'string', format: 'date-time' },
						next: { $ref: '#' },
					},
				},
				(schema) => (schema.format === 'date-time' ? 'Schema.Date' : undefined)
			)
		).toMatchInlineSnapshot(`"type Value = { custom?: unknown; next?: Value };"`);
	});
});
