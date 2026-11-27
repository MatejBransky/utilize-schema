import { describe, expect, test } from 'vitest';

import { run } from '../src/cli';
import type { CliIo } from '../src/cli';

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

describe('CLI options', () => {
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

	test('defaults to spec inference for an untyped schema', async () => {
		const { io, stdout } = createIo(JSON.stringify({ format: 'email' }));

		const exitCode = await run(['--no-banner'], io);

		expect(exitCode).toBe(0);
		expect(stdout()).toContain('export type Root = unknown;');
	});

	test('--inference pragmatic infers a format-only schema as string', async () => {
		const { io, stdout } = createIo(JSON.stringify({ format: 'email' }));

		const exitCode = await run(['--no-banner', '--inference', 'pragmatic'], io);

		expect(exitCode).toBe(0);
		expect(stdout()).toContain('export type Root = string;');
	});

	test('rejects an unknown inference mode', async () => {
		const { io, stderr } = createIo(JSON.stringify({ type: 'string' }));

		const exitCode = await run(['--inference', 'loose'], io);

		expect(exitCode).toBe(1);
		expect(stderr()).toContain('Unknown inference mode');
	});
});
