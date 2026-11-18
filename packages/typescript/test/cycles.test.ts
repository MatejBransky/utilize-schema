import { describe, expect, test } from 'vitest';

import { compile, generateCode } from './test-utils';

describe('cycles', () => {
	test('rejects a cycle that only passes through unions', async () => {
		await expect(
			compile({
				$ref: '#/$defs/A',
				$defs: {
					A: { anyOf: [{ $ref: '#/$defs/B' }, { type: 'string' }] },
					B: { anyOf: [{ $ref: '#/$defs/A' }, { type: 'number' }] },
				},
			})
		).rejects.toThrow(/cycle that only passes through aliases, unions or intersections/);
	});

	test('rejects a self-referencing alias', async () => {
		await expect(compile({ $ref: '#' })).rejects.toThrow(/cycle that only passes through aliases/);
	});

	test('rejects an intersection-only cycle', async () => {
		await expect(
			compile({
				$defs: {
					A: { allOf: [{ $ref: '#/$defs/A' }] },
				},
			})
		).rejects.toThrow(/A/);
	});

	test('accepts a cycle that passes through an object inside a union', async () => {
		const code = await generateCode({
			anyOf: [
				{
					type: 'object',
					properties: { next: { $ref: '#' } },
					additionalProperties: false,
				},
				{ type: 'null' },
			],
		});

		expect(code).toContain('next?: Root;');
		expect(code).toContain('| null');
	});

	test('accepts a cycle that passes through an array inside a definition', async () => {
		const code = await generateCode({
			$defs: {
				List: {
					anyOf: [{ type: 'array', items: { $ref: '#/$defs/List' } }, { type: 'null' }],
				},
			},
			$ref: '#/$defs/List',
		});

		expect(code).toContain('export type List = Array<List> | null;');
	});
});
