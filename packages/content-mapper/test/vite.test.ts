import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { afterAll, expect, test } from 'vitest';

import utilizeSchema from '../src/vite';

const fixture = join(__dirname, 'fixtures', 'person.jsonschema');
const relatedFixture = join(__dirname, 'fixtures', 'related.jsonschema');
const temp = join(__dirname, '.vite-output');

afterAll(() => rm(temp, { recursive: true, force: true }));

test('the Vite plugin returns JavaScript without type syntax', async () => {
	const plugin = utilizeSchema();
	const result = await plugin.load.call(
		{
			error: (message) => {
				throw new Error(message);
			},
		},
		fixture
	);

	expect(result?.code).not.toContain('export type');
	expect(result?.code).toContain('export default Person;');

	await mkdir(temp, { recursive: true });
	const file = join(temp, 'person.mjs');
	await writeFile(file, result!.code);

	const module = await import(pathToFileURL(file).href);

	expect(module.default.safeParse({ name: 'Ada', age: 36 }).success).toBe(true);
	expect(module.default.safeParse({ name: 1 }).success).toBe(false);
});

test('watches the schemas it pulls in through $ref', async () => {
	const watched: string[] = [];
	const plugin = utilizeSchema();

	await plugin.load.call(
		{
			error: (message) => {
				throw new Error(message);
			},
			addWatchFile: (id) => {
				watched.push(id);
			},
		},
		relatedFixture
	);

	expect(watched).toEqual([fixture]);
});

test('maps the timestamped request Vite sends after a change', async () => {
	const plugin = utilizeSchema();
	const result = await plugin.load.call(
		{
			error: (message) => {
				throw new Error(message);
			},
		},
		`${fixture}?t=1730000000000`
	);

	expect(result?.code).toContain('export default Person;');
});

test('leaves other query variants to Vite', async () => {
	const plugin = utilizeSchema();
	const result = await plugin.load.call(
		{
			error: (message) => {
				throw new Error(message);
			},
		},
		`${fixture}?raw`
	);

	expect(result).toBeNull();
});
