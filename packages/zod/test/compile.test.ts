import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, test, vi } from 'vitest';

import { compile } from '../src';

const directories: string[] = [];

async function makeDirectory() {
	const directory = await mkdtemp(join(tmpdir(), 'utilize-zod-compile-'));
	directories.push(directory);
	return directory;
}

afterEach(async () => {
	vi.restoreAllMocks();
	await Promise.all(
		directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))
	);
});

describe('compile', () => {
	test('writes to schema.generated.ts when output is omitted', async () => {
		vi.spyOn(console, 'log').mockImplementation(() => {});
		const directory = await makeDirectory();
		await writeFile(join(directory, 'schema.json'), JSON.stringify({ type: 'string' }));

		await compile({ input: 'schema.json', cwd: directory });

		expect(await readFile(join(directory, 'schema.generated.ts'), 'utf8')).toContain('z.string()');
	});

	test('keeps defaults when optional paths are explicitly undefined', async () => {
		vi.spyOn(console, 'log').mockImplementation(() => {});
		const directory = await makeDirectory();
		await writeFile(join(directory, 'schema.json'), JSON.stringify({ type: 'string' }));

		await compile({
			input: 'schema.json',
			cwd: directory,
			output: undefined as string | undefined,
		});
		expect(await readFile(join(directory, 'schema.generated.ts'), 'utf8')).toContain('z.string()');

		await compile({
			input: join(directory, 'schema.json'),
			cwd: undefined,
			output: join(directory, 'absolute.ts'),
		});
		expect(await readFile(join(directory, 'absolute.ts'), 'utf8')).toContain('z.string()');
	});

	test('writes the default banner and can omit it', async () => {
		vi.spyOn(console, 'log').mockImplementation(() => {});
		const directory = await makeDirectory();
		await writeFile(join(directory, 'schema.json'), JSON.stringify({ type: 'string' }));

		await compile({ input: 'schema.json', cwd: directory });
		expect(await readFile(join(directory, 'schema.generated.ts'), 'utf8')).toContain(
			'DO NOT MODIFY IT BY HAND'
		);

		await compile({
			input: 'schema.json',
			cwd: directory,
			output: 'no-banner.ts',
			bannerComment: false,
		});
		expect(await readFile(join(directory, 'no-banner.ts'), 'utf8')).not.toContain(
			'DO NOT MODIFY IT BY HAND'
		);
	});

	test('passes formatMap to the generator', async () => {
		vi.spyOn(console, 'log').mockImplementation(() => {});
		const directory = await makeDirectory();
		await writeFile(
			join(directory, 'schema.json'),
			JSON.stringify({ type: 'string', format: 'phone-number' })
		);

		await compile({
			input: 'schema.json',
			cwd: directory,
			formatMap: { 'phone-number': 'z.string().startsWith("+")' },
		});

		expect(await readFile(join(directory, 'schema.generated.ts'), 'utf8')).toContain(
			'z.string().startsWith("+")'
		);
	});

	test('passes customSchemaResolver to the generator', async () => {
		vi.spyOn(console, 'log').mockImplementation(() => {});
		const directory = await makeDirectory();
		await writeFile(
			join(directory, 'schema.json'),
			JSON.stringify({ type: 'string', format: 'date-time' })
		);

		await compile({
			input: 'schema.json',
			cwd: directory,
			customSchemaResolver: (schema) =>
				schema.format === 'date-time' ? 'z.coerce.date()' : undefined,
		});

		expect(await readFile(join(directory, 'schema.generated.ts'), 'utf8')).toContain(
			'z.coerce.date()'
		);
	});
});
