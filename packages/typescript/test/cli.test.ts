import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { afterEach, describe, expect, test } from 'vitest';

import { isEntrypoint, run } from '../src/cli';
import type { CliIo } from '../src/cli';
import { compileSchema } from '../src';

const temporaryDirectories: string[] = [];

async function makeDirectory() {
	const directory = await mkdtemp(join(tmpdir(), 'utilize-typescript-cli-'));
	temporaryDirectories.push(directory);
	return directory;
}

function createIo(stdin?: string) {
	const stdout: string[] = [];
	const stderr: string[] = [];
	const io: CliIo = {
		stdout: { write: (chunk) => stdout.push(chunk) },
		stderr: { write: (chunk) => stderr.push(chunk) },
		stdin,
	};

	return { io, stdout: () => stdout.join(''), stderr: () => stderr.join('') };
}

afterEach(async () => {
	await Promise.all(
		temporaryDirectories
			.splice(0)
			.map((directory) => rm(directory, { recursive: true, force: true }))
	);
});

describe('CLI', () => {
	test('compiles a boolean schema document', async () => {
		await expect(
			compileSchema(true, {
				cwd: join(tmpdir(), 'utilize-typescript-boolean'),
				fileName: 'Root.json',
			})
		).resolves.toContain('export type Root = unknown;');
	});

	test('reads a schema from stdin and writes to stdout', async () => {
		const { io, stdout } = createIo(JSON.stringify({ type: 'string' }));

		const exitCode = await run([], io);

		expect(exitCode).toBe(0);
		expect(stdout()).toContain('DO NOT MODIFY IT BY HAND');
		expect(stdout()).toContain('export type Root = string;');
	});

	test('reads YAML from stdin', async () => {
		const { io, stdout } = createIo('type: object\nproperties:\n  name:\n    type: string\n');

		const exitCode = await run(['--no-banner'], io);

		expect(exitCode).toBe(0);
		expect(stdout()).toContain('export interface Root');
		expect(stdout()).toContain('name?: string;');
	});

	test('--no-banner omits the header', async () => {
		const { io, stdout } = createIo(JSON.stringify({ type: 'string' }));

		const exitCode = await run(['--no-banner'], io);

		expect(exitCode).toBe(0);
		expect(stdout()).not.toContain('DO NOT MODIFY IT BY HAND');
		expect(stdout()).toContain('export type Root = string;');
	});

	test('compiles a directory of JSON and YAML schemas into an output directory', async () => {
		const directory = await makeDirectory();
		const output = join(directory, 'generated');

		await writeFile(join(directory, 'a.json'), JSON.stringify({ type: 'string' }));
		await mkdir(join(directory, 'nested'));
		await writeFile(join(directory, 'nested', 'b.yaml'), 'type: number\n');

		const { io } = createIo();
		const exitCode = await run(['--input', directory, '--output', output], io);

		expect(exitCode).toBe(0);
		expect(await readFile(join(output, 'a.generated.ts'), 'utf8')).toContain(
			'export type A = string;'
		);
		expect(await readFile(join(output, 'nested', 'b.generated.ts'), 'utf8')).toContain(
			'export type B = number;'
		);
	});

	test('compiles a glob into an output directory', async () => {
		const directory = await makeDirectory();
		const output = join(directory, 'generated');

		await writeFile(join(directory, 'a.json'), JSON.stringify({ type: 'string' }));
		await writeFile(join(directory, 'b.json'), JSON.stringify({ type: 'boolean' }));

		const { io } = createIo();
		const exitCode = await run(['-i', '*.json', '-o', output, '--cwd', directory], io);

		expect(exitCode).toBe(0);
		expect(await readFile(join(output, 'a.generated.ts'), 'utf8')).toContain(
			'export type A = string;'
		);
		expect(await readFile(join(output, 'b.generated.ts'), 'utf8')).toContain(
			'export type B = boolean;'
		);
	});

	test('requires an output directory for several inputs', async () => {
		const directory = await makeDirectory();
		await writeFile(join(directory, 'a.json'), JSON.stringify({ type: 'string' }));
		await writeFile(join(directory, 'b.json'), JSON.stringify({ type: 'boolean' }));

		const { io, stderr } = createIo();
		const exitCode = await run(['--input', directory], io);

		expect(exitCode).toBe(1);
		expect(stderr()).toContain('output directory');
	});
});

describe('CLI path handling', () => {
	test('preserves paths from a glob root', async () => {
		const directory = await makeDirectory();
		const output = join(directory, 'generated');

		await mkdir(join(directory, 'schemas', 'a'), { recursive: true });
		await mkdir(join(directory, 'schemas', 'b'), { recursive: true });
		await writeFile(
			join(directory, 'schemas', 'a', 'user.json'),
			JSON.stringify({ type: 'string' })
		);
		await writeFile(
			join(directory, 'schemas', 'b', 'user.json'),
			JSON.stringify({ type: 'number' })
		);

		const { io } = createIo();
		const exitCode = await run(['-i', 'schemas/**/*.json', '-o', output, '--cwd', directory], io);

		expect(exitCode).toBe(0);
		expect(await readFile(join(output, 'a', 'user.generated.ts'), 'utf8')).toContain(
			'export type User = string;'
		);
		expect(await readFile(join(output, 'b', 'user.generated.ts'), 'utf8')).toContain(
			'export type User = number;'
		);
	});

	test('refuses to overwrite colliding outputs', async () => {
		const directory = await makeDirectory();
		await writeFile(join(directory, 'a.json'), JSON.stringify({ type: 'string' }));
		await writeFile(join(directory, 'a.yaml'), 'type: string\n');

		const { io, stderr } = createIo();
		const exitCode = await run(
			['--input', directory, '--output', join(directory, 'generated')],
			io
		);

		expect(exitCode).toBe(1);
		expect(stderr()).toContain('Refusing to overwrite');
	});

	test('detects the entrypoint through a symlink', async () => {
		const directory = await makeDirectory();
		const real = join(directory, 'real.mjs');
		await writeFile(real, '');
		const link = join(directory, 'link.mjs');
		await symlink(real, link);

		expect(isEntrypoint(link, pathToFileURL(real).href)).toBe(true);
		expect(isEntrypoint(real, pathToFileURL(join(directory, 'other.mjs')).href)).toBe(false);
		expect(isEntrypoint(undefined, pathToFileURL(real).href)).toBe(false);
	});
});
