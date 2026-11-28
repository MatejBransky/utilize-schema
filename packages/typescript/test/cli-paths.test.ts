import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, test } from 'vitest';

import { run } from '../src/cli';
import type { CliIo } from '../src/cli';

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

describe('CLI path handling', () => {
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
