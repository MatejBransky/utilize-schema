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
});
