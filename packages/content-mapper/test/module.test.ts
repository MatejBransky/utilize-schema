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

test('keeps a JSON diagnostic inside the file it describes', async () => {
	// A truncated file is the normal state of a schema being edited. V8 reports
	// the error at the end of the content, and a diagnostic that ends past it
	// makes TypeScript reject the whole transform.
	for (const content of ['{"a":1', '{"é":1', '"unterminated']) {
		const result = await schemaModule(fixture, content);
		const first = result.diagnostics?.[0];

		expect(first).toBeDefined();
		expect(first!.messageText).toContain('position');
		expect(first!.start + first!.length).toBeLessThanOrEqual(Buffer.byteLength(content));
	}
});

test('lists the files it resolved through $ref', async () => {
	const related = join(__dirname, 'fixtures', 'related.jsonschema');
	const result = await schemaModule(related, readFileSync(related, 'utf8'));

	expect(result.diagnostics).toBeUndefined();
	expect(result.dependencies).toEqual([fixture]);
});

test('reports an unknown target as a diagnostic', async () => {
	const result = await schemaModule(fixture, readFileSync(fixture, 'utf8'), {
		target: 'valibot' as never,
	});

	expect(result.diagnostics?.[0]?.messageText).toContain('Unknown target');
});
