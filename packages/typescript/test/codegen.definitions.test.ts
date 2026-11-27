import { describe, expect, test } from 'vitest';

import { compile, generateCode, ts } from './test-utils';

describe('code generation of definitions and globals', () => {
	test('collects $defs and definitions independently', async () => {
		// An empty `$defs` must not hide `definitions`.
		await expect(
			compile({
				type: 'object',
				properties: { legacy: { $ref: '#/definitions/Legacy' } },
				$defs: {},
				definitions: { Legacy: { type: 'string' } },
				additionalProperties: false,
			})
		).toMatchCode(ts`
			export type Legacy = string;

			export interface Root {
				legacy?: Legacy;
			}
		`);
	});

	test('emits both namespaces when they share a definition key', async () => {
		const code = await generateCode({
			type: 'object',
			additionalProperties: false,
			$defs: { Value: { type: 'string' } },
			definitions: { Value: { type: 'number' } },
		});

		expect(code).toContain('export type Value = string;');
		expect(code).toContain('export type Value1 = number;');
	});

	test('emits declarations for boolean definitions', async () => {
		const code = await generateCode({
			type: 'object',
			additionalProperties: false,
			$defs: { Allowed: true, Denied: false },
		});

		expect(code).toContain('export type Allowed = unknown;');
		expect(code).toContain('export type Denied = never;');
	});

	test('does not shadow the globals used by the renderer', async () => {
		await expect(compile({ title: 'Array', type: 'array', items: { type: 'string' } }))
			.toMatchCode(ts`
				/**
				 * Array
				 */
				export type Array1 = Array<string>;
			`);

		await expect(compile({ title: 'Record', const: {} })).toMatchCode(ts`
			/**
			 * Record
			 */
			export type Record1 = Record<string, never>;
		`);
	});
});
