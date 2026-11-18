import { describe, expect, test } from 'vitest';

import { compile, generateCode, ts } from './test-utils';

describe('references', () => {
	test('emits a declaration per referenced schema', async () => {
		await expect(
			compile({
				type: 'object',
				properties: {
					field: { $ref: '#/$defs/MyType' },
					field2: { $ref: '#/$defs/MyType2' },
				},
				$defs: {
					MyType: { type: 'string' },
					MyType2: { type: 'number' },
					Unused: { type: 'boolean' },
				},
			})
		).toMatchCode(ts`
			export type MyType = string;

			export type MyType2 = number;

			export type Unused = boolean;

			export interface Root {
				field?: MyType;
				field2?: MyType2;
				[key: string]: unknown;
			}
		`);
	});

	test('supports definitions referencing each other', async () => {
		await expect(
			compile({
				type: 'object',
				properties: { a: { $ref: '#/$defs/A' } },
				$defs: {
					A: {
						type: 'object',
						properties: { b: { $ref: '#/$defs/B' } },
					},
					B: {
						type: 'object',
						properties: { a: { $ref: '#/$defs/A' } },
					},
				},
			})
		).toMatchCode(ts`
			export interface A {
				b?: B;
				[key: string]: unknown;
			}

			export interface B {
				a?: A;
				[key: string]: unknown;
			}

			export interface Root {
				a?: A;
				[key: string]: unknown;
			}
		`);
	});

	test('supports a recursive root schema', async () => {
		await expect(
			compile({
				type: 'object',
				properties: {
					value: { type: 'string' },
					children: { type: 'array', items: { $ref: '#' } },
				},
				required: ['value'],
			})
		).toMatchCode(ts`
			export interface Root {
				value: string;
				children?: Array<Root>;
				[key: string]: unknown;
			}
		`);
	});

	test('supports recursive records and tuples', async () => {
		await expect(compile({ type: 'object', additionalProperties: { $ref: '#' } })).toMatchCode(
			ts`
				export interface Root {
					[key: string]: Root;
				}
			`
		);

		await expect(
			compile({ type: 'array', prefixItems: [{ type: 'string' }, { $ref: '#' }], items: false })
		).toMatchCode(ts`
			export type Root = [string?, Root?];
		`);
	});

	test('reads external schemas and their definitions', async () => {
		const code = await generateCode({
			type: 'object',
			properties: {
				dataType: { $ref: './definitions/DataType.json' },
				info: { $ref: './definitions/Info.json' },
				category: { $ref: '#/definitions/Category' },
			},
			definitions: { Category: { type: 'string' } },
		});

		expect(code).toContain('export type DataType =');
		expect(code).toContain('export interface Info {');
		expect(code).toContain('export type OriginalDataType =');
		expect(code).toContain('export type Category = string;');
		expect(code).toContain('dataType?: DataType;');
	});

	test('follows a cyclic pair of external files', async () => {
		const code = await generateCode({
			type: 'object',
			properties: { a: { $ref: './definitions/CycleA.json' } },
		});

		expect(code).toContain('export interface CycleA {');
		expect(code).toContain('b?: CycleB;');
		expect(code).toContain('export interface CycleB {');
		expect(code).toContain('a?: CycleA | null;');
	});

	test('follows external definitions that reference other files', async () => {
		const code = await generateCode({
			type: 'object',
			properties: { example: { $ref: './definitions/Example.json' } },
		});

		expect(code).toContain('export interface Example {');
		expect(code).toContain('export interface TestArray {');
		expect(code).toContain('export interface TestObject {');
		expect(code).toContain('export interface PropertyA {');
		expect(code).toContain('export interface PropertyB {');
	});
});
