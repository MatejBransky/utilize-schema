import { mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { afterEach, describe, expect, test } from 'vitest';

import { compileSchema } from '../src';
import { isEntrypoint, run } from '../src/cli';
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

describe('CLI validation and entrypoint', () => {
	test('compiles a boolean schema document', async () => {
		await expect(
			compileSchema(true, {
				cwd: join(tmpdir(), 'utilize-typescript-boolean'),
				fileName: 'Root.json',
			})
		).resolves.toContain('export type Root = unknown;');
	});

	test('--validate rejects a schema that does not match its dialect', async () => {
		const { io, stdout, stderr } = createIo(JSON.stringify({ title: 'Thing', type: 'nonsense' }));

		const exitCode = await run(['--no-banner', '--validate'], io);

		expect(exitCode).toBe(1);
		expect(stdout()).toBe('');
		expect(stderr()).toContain('Root.json is not a valid draft-07 JSON Schema');
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
