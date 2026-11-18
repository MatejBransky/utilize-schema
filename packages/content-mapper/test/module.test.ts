import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test } from 'vitest';

import { schemaModule } from '../src/module';

const fixture = join(__dirname, 'fixtures', 'person.jsonschema');

test('generates a runtime module with a default export', async () => {
	const result = await schemaModule(fixture, readFileSync(fixture, 'utf8'));

	expect(result.diagnostics).toBeUndefined();
	expect(result.text).toContain('export const Person');
	expect(result.text).toContain('export default Person;');
});

test('generates an Effect Schema module with a default export', async () => {
	const result = await schemaModule(fixture, readFileSync(fixture, 'utf8'), {
		target: 'effect',
	});

	expect(result.diagnostics).toBeUndefined();
	expect(result.text).toContain("import { Schema } from 'effect';");
	expect(result.text).toContain('export default Person;');
});

test('generates a types-only module without a default export', async () => {
	const result = await schemaModule(fixture, readFileSync(fixture, 'utf8'), {
		target: 'typescript',
	});

	expect(result.diagnostics).toBeUndefined();
	expect(result.text).toContain('export interface Person');
	expect(result.text).not.toContain('export default');
});

test('reports invalid JSON as a diagnostic', async () => {
	const result = await schemaModule(fixture, '{ "type": ');

	expect(result.diagnostics?.[0]?.messageText).toContain('JSON');
	expect(result.text).toBe('export {};\n');
});

test('reports an unknown target as a diagnostic', async () => {
	const result = await schemaModule(fixture, readFileSync(fixture, 'utf8'), {
		target: 'valibot' as never,
	});

	expect(result.diagnostics?.[0]?.messageText).toContain('Unknown target');
});
