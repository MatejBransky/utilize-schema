import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { build } from 'vite';
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

	const module = (await import(pathToFileURL(file).href)) as {
		default: { safeParse(value: unknown): { success: boolean } };
	};

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

test('maps the module requests Vite tags with a query', async () => {
	const plugin = utilizeSchema();

	for (const query of ['?v=0a1b2c3d', '?import', '?import&t=1730000000000']) {
		const result = await plugin.load.call(
			{
				error: (message) => {
					throw new Error(message);
				},
			},
			`${fixture}${query}`
		);

		expect(result?.code, query).toContain('export default Person;');
	}
});

test('leaves the queries Vite answers itself to Vite', async () => {
	const plugin = utilizeSchema();

	for (const query of ['?raw', '?url', '?inline', '?import&raw']) {
		const result = await plugin.load.call(
			{
				error: (message) => {
					throw new Error(message);
				},
			},
			`${fixture}${query}`
		);

		expect(result, query).toBeNull();
	}
});

test('a real Vite build bundles the generated module', async () => {
	const result = (await build({
		configFile: false,
		logLevel: 'silent',
		build: {
			write: false,
			minify: false,
			rollupOptions: { input: fixture, external: ['zod'] },
		},
		plugins: [utilizeSchema()],
	})) as { output: { code?: string }[] };
	const code = result.output.map((chunk) => chunk.code ?? '').join('\n');

	expect(code).toContain('z.strictObject');
	expect(code).toContain('"Person"');
});

test('rejects the types-only target for a runtime bundle', () => {
	expect(() => utilizeSchema({ target: 'typescript' })).toThrow(/types-only/);
});

test('every runtime target emits only type syntax that can be erased', async () => {
	// `stripTypeScriptTypes` throws on syntax such as `enum`, so this fails as
	// soon as a generator starts emitting it. A JSON Schema `enum` is the most
	// likely trigger.
	const choice = join(temp, 'choice.jsonschema');

	await mkdir(temp, { recursive: true });
	await writeFile(choice, JSON.stringify({ title: 'Choice', enum: ['a', 'b', 1] }));

	for (const target of ['zod', 'effect'] as const) {
		const plugin = utilizeSchema({ target });

		for (const file of [fixture, relatedFixture, choice]) {
			const result = await plugin.load.call(
				{
					error: (message) => {
						throw new Error(message);
					},
				},
				file
			);

			expect(result?.code, `${target} ${file}`).toBeTypeOf('string');
		}
	}
});
