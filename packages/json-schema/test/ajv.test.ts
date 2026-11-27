import { describe, expect, test } from 'vitest';

import type { DialectId } from '../src/dialect';
import { ajvValidator } from '../src/validate/ajv';

const context = (dialect: DialectId) => ({ filePath: 'schema.json', dialect });

describe('Ajv validator', () => {
	test('reports a type that is not a JSON Schema type', () => {
		expect(ajvValidator({ type: 'nonsense' }, context('draft-07'))).toContainEqual({
			pointer: '/type',
			message: 'must be equal to one of the allowed values',
			keyword: 'enum',
		});
	});

	test('reports a keyword value of the wrong shape', () => {
		expect(ajvValidator({ type: 'string', minLength: 'x' }, context('draft-07'))).toEqual([
			{ pointer: '/minLength', message: 'must be integer', keyword: 'type' },
		]);
	});

	test('validates against the dialect the parser resolved', () => {
		const tuple = { type: 'array', items: [{ type: 'string' }] };

		expect(ajvValidator(tuple, context('draft-07'))).toEqual([]);
		expect(ajvValidator(tuple, context('2020-12'))).toContainEqual({
			pointer: '/items',
			message: 'must be object,boolean',
			keyword: 'type',
		});
	});

	test('loads the draft-06 meta-schema', () => {
		expect(ajvValidator({ type: 'number', exclusiveMinimum: true }, context('draft-06'))).toEqual([
			{ pointer: '/exclusiveMinimum', message: 'must be number', keyword: 'type' },
		]);
		expect(ajvValidator({ type: 'number', exclusiveMinimum: 0 }, context('draft-06'))).toEqual([]);
	});

	test('accepts draft-04 boolean bounds', () => {
		expect(
			ajvValidator({ type: 'number', minimum: 0, exclusiveMinimum: true }, context('draft-04'))
		).toEqual([]);
	});

	test('accepts boolean schema documents from draft-06 on', () => {
		const dialects: DialectId[] = ['draft-06', 'draft-07', '2019-09', '2020-12'];

		for (const dialect of dialects) {
			expect(ajvValidator(true, context(dialect))).toEqual([]);
			expect(ajvValidator(false, context(dialect))).toEqual([]);
		}
	});

	test('rejects a draft-04 boolean document, which the dialect does not allow', () => {
		expect(ajvValidator(true, context('draft-04'))).toEqual([
			{ pointer: '', message: 'must be object', keyword: 'type' },
		]);
		expect(ajvValidator(false, context('draft-04'))).toEqual([
			{ pointer: '', message: 'must be object', keyword: 'type' },
		]);
	});

	test('keeps the resolved dialect when $schema is unknown', () => {
		const schema = { $schema: 'https://example.com/not-a-dialect', type: 'nonsense' };

		expect(ajvValidator(schema, context('draft-07'))).toContainEqual({
			pointer: '/type',
			message: 'must be equal to one of the allowed values',
			keyword: 'enum',
		});
	});

	test('drops repeated findings for one location', () => {
		const findings = ajvValidator(
			{ type: 'array', items: [{ type: 'string' }] },
			context('2020-12')
		);

		expect(findings).toHaveLength(1);
	});
});
