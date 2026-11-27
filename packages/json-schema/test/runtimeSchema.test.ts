import { expect, test } from 'vitest';

import { isParsedJSONSchemaObject, Meta, parse, sourceDocumentOf } from '../src';
import { createRuntimeGuard } from '../src/runtimeSchema';
import { createJsonSchemaValidator } from '../src/runtime';

const metaSchema = {
	$schema: 'https://json-schema.org/draft/2020-12/schema',
	$id: 'https://example.com/no-validation.json',
	$vocabulary: {
		'https://json-schema.org/draft/2020-12/vocab/core': true,
		'https://json-schema.org/draft/2020-12/vocab/applicator': true,
	},
};

test('does not project validation keywords disabled by a custom vocabulary', async () => {
	const { root } = await parse(
		{
			$schema: 'https://example.com/no-validation.json',
			type: 'number',
			minimum: 10,
		},
		{
			cwd: __dirname + '/',
			fileName: 'Root.json',
			dialect: '2020-12',
			externalSchemas: { 'https://example.com/no-validation.json': metaSchema },
		}
	);

	if (!isParsedJSONSchemaObject(root)) {
		throw new TypeError('Expected an object root');
	}

	const guard = createRuntimeGuard(root);

	expect(guard).toBeDefined();
	expect(guard?.refFor(root)).not.toBe('');
	expect(guard?.shape).not.toHaveProperty('type');
	expect(guard?.shape).not.toHaveProperty('minimum');

	if (!guard) {
		throw new TypeError('Expected a runtime guard');
	}

	const validate = createJsonSchemaValidator(guard.bundle, 'assert');
	const serializedValidate = createJsonSchemaValidator(JSON.stringify(guard.bundle), 'assert');

	expect(validate('not a number', guard.refFor(root))).toBe(true);
	expect(serializedValidate('not a number', guard.refFor(root))).toBe(true);
});

test('detects a disabled validation vocabulary behind a reference', async () => {
	const { root } = await parse(
		{
			$schema: 'https://json-schema.org/draft/2020-12/schema',
			$ref: 'https://example.com/value.json',
		},
		{
			cwd: __dirname + '/',
			fileName: 'Root.json',
			dialect: '2020-12',
			externalSchemas: {
				'https://example.com/no-validation.json': metaSchema,
				'https://example.com/value.json': {
					$schema: 'https://example.com/no-validation.json',
					type: 'number',
					minimum: 10,
				},
			},
		}
	);

	if (!isParsedJSONSchemaObject(root)) {
		throw new TypeError('Expected an object root');
	}

	const guard = createRuntimeGuard(root);

	expect(guard).toBeDefined();

	if (!guard) {
		throw new TypeError('Expected a runtime guard');
	}

	const validate = createJsonSchemaValidator(guard.bundle, 'assert');

	expect(validate(1, guard.refFor(root))).toBe(true);
	expect(validate('not a number', guard.refFor(root))).toBe(true);
});

test('keeps object map keywords in the native projection', async () => {
	const { root } = await parse(
		{
			$schema: 'https://json-schema.org/draft/2020-12/schema',
			type: 'object',
			patternProperties: { '^x-': { type: 'number' } },
			additionalProperties: { type: 'string' },
			unevaluatedProperties: false,
		},
		{ cwd: __dirname + '/', fileName: 'Root.json', dialect: '2020-12' }
	);

	if (!isParsedJSONSchemaObject(root)) {
		throw new TypeError('Expected an object root');
	}

	const guard = createRuntimeGuard(root);

	expect(guard?.shape).toMatchObject({
		patternProperties: { '^x-': { type: 'number' } },
		additionalProperties: { type: 'string' },
	});
});

test('keeps unevaluated array rests open in the native projection', async () => {
	const { root } = await parse(
		{
			$schema: 'https://json-schema.org/draft/2020-12/schema',
			type: 'array',
			prefixItems: [{ type: 'string' }],
			unevaluatedItems: false,
		},
		{ cwd: __dirname + '/', fileName: 'Root.json', dialect: '2020-12' }
	);

	if (!isParsedJSONSchemaObject(root)) {
		throw new TypeError('Expected an object root');
	}

	const guard = createRuntimeGuard(root);

	expect(guard?.shape).toMatchObject({ type: 'array', items: true });
});

test('keeps legacy tuple items and their explicit rest in the native projection', async () => {
	const { root } = await parse(
		{
			$schema: 'https://json-schema.org/draft/2019-09/schema',
			type: 'array',
			items: [{ type: 'string' }],
			additionalItems: { type: 'number' },
			unevaluatedItems: false,
		},
		{ cwd: __dirname + '/', fileName: 'Root.json', dialect: '2019-09' }
	);

	if (!isParsedJSONSchemaObject(root)) {
		throw new TypeError('Expected an object root');
	}

	const guard = createRuntimeGuard(root);

	expect(guard?.shape).toMatchObject({
		type: 'array',
		items: [{ type: 'string' }],
		additionalItems: { type: 'number' },
	});
});

test('does not add a guard to an ordinary schema', async () => {
	const { root } = await parse(
		{ type: 'string', minLength: 2 },
		{ cwd: __dirname + '/', fileName: 'Root.json' }
	);

	expect(createRuntimeGuard(root)).toBeUndefined();
	expect(sourceDocumentOf(root)).toBeUndefined();
});

test('shares resolved names between the runtime projection and parsed nodes', async () => {
	const { root } = await parse(
		{
			$schema: 'https://json-schema.org/draft/2020-12/schema',
			title: 'Guarded root',
			type: 'object',
			unevaluatedProperties: false,
		},
		{ cwd: __dirname + '/', fileName: 'Root.json', dialect: '2020-12' }
	);

	if (!isParsedJSONSchemaObject(root)) {
		throw new TypeError('Expected an object root');
	}

	const shape = createRuntimeGuard(root)?.shape;

	if (!isParsedJSONSchemaObject(shape)) {
		throw new TypeError('Expected an object projection');
	}

	shape[Meta].resolvedName = 'ProjectedRoot';
	expect(root[Meta].resolvedName).toBe('ProjectedRoot');

	root[Meta].resolvedName = 'OriginalRoot';
	expect(shape[Meta].resolvedName).toBe('OriginalRoot');
});

test('captures source documents only when advanced validation may need them', async () => {
	const { root } = await parse(
		{
			$schema: 'https://json-schema.org/draft/2020-12/schema',
			$dynamicAnchor: 'node',
			$dynamicRef: '#node',
		},
		{ cwd: __dirname + '/', fileName: 'Root.json', dialect: '2020-12' }
	);

	expect(sourceDocumentOf(root)?.schema).toMatchObject({
		$dynamicAnchor: 'node',
		$dynamicRef: '#node',
	});
});
