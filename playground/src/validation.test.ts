import { expect, test } from 'vitest';

import type { ParsedFile } from './bundle';
import { validateSchemas } from './validation';

function parsed(id: string, schema: unknown): ParsedFile {
	return {
		file: { id, name: `${id}.json`, content: '' },
		schema,
		problems: [],
	};
}

test('accepts valid object and boolean schemas', () => {
	expect(
		validateSchemas([
			parsed('object', { type: 'string' }),
			parsed('true', true),
			parsed('false', false),
		])
	).toEqual([]);
});

test('rejects schemas that are neither objects nor booleans', () => {
	expect(validateSchemas([parsed('number', 42), parsed('null', null)])).toEqual([
		{
			fileId: 'number',
			severity: 'error',
			message: 'A JSON Schema must be an object or a boolean.',
		},
		{
			fileId: 'null',
			severity: 'error',
			message: 'A JSON Schema must be an object or a boolean.',
		},
	]);
});

test('reports every AJV schema error with its instance path', () => {
	const problems = validateSchemas([
		parsed('invalid', {
			type: 'object',
			properties: { count: { type: 'not-a-type' } },
			required: ['missing'],
		}),
	]);

	expect(problems.length).toBeGreaterThan(1);
	expect(problems).toContainEqual({
		fileId: 'invalid',
		severity: 'error',
		message: '/properties/count/type must be equal to one of the allowed values',
	});
	expect(problems.every((problem) => problem.fileId === 'invalid')).toBe(true);
});

test('selects the AJV draft declared by each schema', () => {
	expect(
		validateSchemas([
			parsed('draft04', {
				$schema: 'http://json-schema.org/draft-04/schema#',
				type: 'number',
				minimum: 0,
				exclusiveMinimum: true,
			}),
			parsed('draft2019', {
				$schema: 'https://json-schema.org/draft/2019-09/schema',
				type: 'object',
				unevaluatedProperties: false,
			}),
			parsed('draft2020', {
				$schema: 'https://json-schema.org/draft/2020-12/schema',
				type: 'array',
				prefixItems: [{ type: 'string' }],
			}),
		])
	).toEqual([]);

	expect(
		validateSchemas([
			parsed('draft07', {
				$schema: 'http://json-schema.org/draft-07/schema#',
				type: 'number',
				exclusiveMinimum: true,
			}),
		])
	).toEqual([
		{
			fileId: 'draft07',
			severity: 'error',
			message: '/exclusiveMinimum must be number',
		},
	]);
});

test('falls back to draft-07 validation when the schema URI is unknown', () => {
	expect(
		validateSchemas([
			parsed('valid', { $schema: 'https://example.com/unknown-schema', type: 'string' }),
		])
	).toEqual([]);

	expect(
		validateSchemas([
			parsed('invalid', { $schema: 'https://example.com/unknown-schema', type: 'not-a-type' }),
		])
	).toEqual([
		{
			fileId: 'invalid',
			severity: 'error',
			message: expect.stringContaining('Could not validate against $schema:'),
		},
	]);
});

test('skips files without a parsed schema', () => {
	const broken: ParsedFile = {
		file: { id: 'broken', name: 'broken.json', content: '{' },
		problems: [{ fileId: 'broken', severity: 'error', message: 'Invalid JSON' }],
	};

	expect(validateSchemas([broken])).toEqual([]);
});
