import { describe, expect, test } from 'vitest';

import type { JSONSchema } from '../src/model';
import { parse } from '../src/parser';
import { SchemaValidationError } from '../src/validation';
import type { SchemaValidationContext, SchemaValidator } from '../src/validation';

const location = { cwd: '/schemas', fileName: 'schema.json' };

const invalidValidator: SchemaValidator = (schema) =>
	typeof schema === 'boolean'
		? []
		: [
				{
					pointer: '/type',
					message: 'must be equal to one of the allowed values',
					keyword: 'enum',
				},
				{ pointer: '/properties', message: 'must be object', keyword: 'type' },
			];

/** Adds deliberately malformed values the public model does not allow. */
function withRawValues(schema: JSONSchema, values: Record<string, unknown>): JSONSchema {
	return Object.assign(schema, values);
}

describe('optional schema validation', () => {
	test('runs the validator once per resolved document with its resolved dialect', async () => {
		const calls: SchemaValidationContext[] = [];
		const validateSchema: SchemaValidator = (_schema, context) => {
			calls.push(context);
			return [];
		};

		await parse(
			{
				$schema: 'https://json-schema.org/draft/2020-12/schema',
				type: 'object',
				properties: { name: { $ref: 'https://example.com/name.json' } },
			},
			{
				...location,
				externalSchemas: { 'https://example.com/name.json': { type: 'string' } },
				validateSchema,
			}
		);

		expect(calls).toEqual([
			{ filePath: 'schema.json', dialect: '2020-12' },
			{ filePath: 'https://example.com/name.json', dialect: '2020-12' },
		]);
	});

	test('validates every document with a forced dialect', async () => {
		const dialects: string[] = [];
		const validateSchema: SchemaValidator = (_schema, context) => {
			dialects.push(context.dialect);
			return [];
		};

		await parse(
			{
				$schema: 'https://json-schema.org/draft/2020-12/schema',
				type: 'object',
				properties: { name: { $ref: 'https://example.com/name.json' } },
			},
			{
				...location,
				dialect: 'draft-06',
				externalSchemas: { 'https://example.com/name.json': { type: 'string' } },
				validateSchema,
			}
		);

		expect(dialects).toEqual(['draft-06', 'draft-06']);
	});

	test('validates boolean schema documents', async () => {
		const schemas: unknown[] = [];
		const validateSchema: SchemaValidator = (schema) => {
			schemas.push(schema);
			return [];
		};

		await parse(true, { ...location, validateSchema });

		expect(schemas).toEqual([true]);
	});

	test('throws one error with every finding and the document it belongs to', async () => {
		try {
			await parse(withRawValues({ title: 'Thing' }, { type: 'nonsense', properties: [] }), {
				...location,
				validateSchema: invalidValidator,
			});
			expect.unreachable('parse should have thrown');
		} catch (error) {
			expect(error).toBeInstanceOf(SchemaValidationError);

			if (!(error instanceof SchemaValidationError)) {
				throw error;
			}

			expect(error.reports).toEqual([
				{
					filePath: 'schema.json',
					dialect: 'draft-07',
					findings: [
						{
							pointer: '/type',
							message: 'must be equal to one of the allowed values',
							keyword: 'enum',
						},
						{ pointer: '/properties', message: 'must be object', keyword: 'type' },
					],
				},
			]);
			expect(error.message).toBe(
				[
					'schema.json is not a valid draft-07 JSON Schema:',
					'  /type must be equal to one of the allowed values',
					'  /properties must be object',
				].join('\n')
			);
		}
	});

	test('does not call the validator when none is given', async () => {
		await expect(parse({ type: 'string' }, location)).resolves.toMatchObject({
			issues: [],
		});
	});
});
