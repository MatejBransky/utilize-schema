import { describe, expect, test, vi } from 'vitest';

import type { DialectId } from '../src/dialect';
import { ajvValidator } from '../src/validate/ajv';

const context = (dialect: DialectId) => ({ filePath: 'schema.json', dialect });

describe('Ajv validator', () => {
	test('reports a type that is not a JSON Schema type', async () => {
		expect(await ajvValidator({ type: 'nonsense' }, context('draft-07'))).toContainEqual({
			pointer: '/type',
			message: 'must be equal to one of the allowed values',
			keyword: 'enum',
		});
	});

	test('reports a keyword value of the wrong shape', async () => {
		expect(await ajvValidator({ type: 'string', minLength: 'x' }, context('draft-07'))).toEqual([
			{ pointer: '/minLength', message: 'must be integer', keyword: 'type' },
		]);
	});

	test('validates against the dialect the parser resolved', async () => {
		const tuple = { type: 'array', items: [{ type: 'string' }] };

		expect(await ajvValidator(tuple, context('draft-07'))).toEqual([]);
		expect(await ajvValidator(tuple, context('2020-12'))).toContainEqual({
			pointer: '/items',
			message: 'must be object,boolean',
			keyword: 'type',
		});
	});

	test('loads the draft-06 meta-schema', async () => {
		expect(
			await ajvValidator({ type: 'number', exclusiveMinimum: true }, context('draft-06'))
		).toEqual([{ pointer: '/exclusiveMinimum', message: 'must be number', keyword: 'type' }]);
		expect(
			await ajvValidator({ type: 'number', exclusiveMinimum: 0 }, context('draft-06'))
		).toEqual([]);
	});

	test('accepts draft-04 boolean bounds', async () => {
		expect(
			await ajvValidator(
				{ type: 'number', minimum: 0, exclusiveMinimum: true },
				context('draft-04')
			)
		).toEqual([]);
	});

	test('accepts boolean schema documents from draft-06 on', async () => {
		const dialects: DialectId[] = ['draft-06', 'draft-07', '2019-09', '2020-12'];

		for (const dialect of dialects) {
			expect(await ajvValidator(true, context(dialect))).toEqual([]);
			expect(await ajvValidator(false, context(dialect))).toEqual([]);
		}
	});

	test('rejects a draft-04 boolean document, which the dialect does not allow', async () => {
		expect(await ajvValidator(true, context('draft-04'))).toEqual([
			{ pointer: '', message: 'must be object', keyword: 'type' },
		]);
		expect(await ajvValidator(false, context('draft-04'))).toEqual([
			{ pointer: '', message: 'must be object', keyword: 'type' },
		]);
	});

	test('keeps the resolved dialect when $schema is unknown', async () => {
		const schema = { $schema: 'https://example.com/not-a-dialect', type: 'nonsense' };

		expect(await ajvValidator(schema, context('draft-07'))).toContainEqual({
			pointer: '/type',
			message: 'must be equal to one of the allowed values',
			keyword: 'enum',
		});
	});

	test('drops repeated findings for one location', async () => {
		const findings = await ajvValidator(
			{ type: 'array', items: [{ type: 'string' }] },
			context('2020-12')
		);

		expect(findings).toHaveLength(1);
	});

	test('imports ajv-draft-04 only when a draft-04 document is validated', async () => {
		vi.resetModules();
		vi.doMock('ajv-draft-04', () => {
			throw new Error('Cannot find package "ajv-draft-04"');
		});

		try {
			const { ajvValidator: validatorWithoutDraft04 } = await import('../src/validate/ajv');

			await expect(
				validatorWithoutDraft04({ type: 'string' }, context('draft-07'))
			).resolves.toEqual([]);
			await expect(
				validatorWithoutDraft04({ type: 'string' }, context('draft-04'))
			).rejects.toThrow('needs the optional "ajv-draft-04" package');
		} finally {
			vi.doUnmock('ajv-draft-04');
			vi.resetModules();
		}
	});
});
