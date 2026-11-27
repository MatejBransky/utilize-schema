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

describe('CLI output safety', () => {
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
});
