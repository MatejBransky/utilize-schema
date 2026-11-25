import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type { ParseArgsOptionsConfig } from 'node:util';

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { type CliIo, type GeneratorCli, runGeneratorCli } from '../src/node';

type TestFlags = {
	'custom-flag': { type: 'boolean'; default: false };
} & ParseArgsOptionsConfig;

interface TestOptions {
	mode: string;
}

function output() {
	return {
		out: [] as string[],
		errors: [] as string[],
		io(stdin?: string): CliIo {
			return {
				stdin,
				stdout: { write: (chunk: string) => this.out.push(chunk) },
				stderr: { write: (chunk: string) => this.errors.push(chunk) },
			};
		},
	};
}

const compileSchema = vi.fn(async () => 'stdin-code');
const compileFile = vi.fn(async (filePath: string) => `code:${path.basename(filePath)}`);
const readOptions = vi.fn((): { ok: true; options: TestOptions } => ({
	ok: true,
	options: { mode: 'assert' },
}));

function generator(
	overrides: Partial<GeneratorCli<TestFlags, TestOptions>> = {}
): GeneratorCli<TestFlags, TestOptions> {
	return {
		help: 'usage: example',
		flags: { 'custom-flag': { type: 'boolean', default: false } },
		readOptions,
		compileSchema,
		compileFile,
		withBanner: (code, banner) => (banner === false ? code : `// banner\n${code}`),
		...overrides,
	};
}

describe('runGeneratorCli', () => {
	let directory: string;

	beforeEach(() => {
		directory = mkdtempSync(path.join(tmpdir(), 'utilize-json-schema-cli-'));
		vi.clearAllMocks();
	});

	afterEach(() => {
		rmSync(directory, { recursive: true, force: true });
	});

	test('prints the help text and returns 0', async () => {
		const cli = output();

		expect(await runGeneratorCli(['--help'], cli.io(), generator())).toBe(0);
		expect(cli.out).toEqual(['usage: example']);
		expect(compileSchema).not.toHaveBeenCalled();
	});

	test('reports an unknown flag', async () => {
		const cli = output();

		expect(await runGeneratorCli(['--nope'], cli.io(), generator())).toBe(1);
		expect(cli.errors.join('')).toContain('--nope');
	});

	test('reports invalid generator options', async () => {
		const cli = output();
		const failingReadOptions = vi.fn(() => ({ ok: false as const, error: 'bad options' }));

		expect(
			await runGeneratorCli([], cli.io(), generator({ readOptions: failingReadOptions }))
		).toBe(1);
		expect(cli.errors).toEqual(['bad options\n']);
	});

	test('compiles stdin to stdout with the banner', async () => {
		const cli = output();

		expect(
			await runGeneratorCli(['--cwd', directory], cli.io('{"type":"string"}'), generator())
		).toBe(0);
		expect(compileSchema).toHaveBeenCalledWith(
			{ type: 'string' },
			{ cwd: directory, fileName: 'Root.json', mode: 'assert' }
		);
		expect(cli.out).toEqual(['// banner\nstdin-code']);
	});

	test('writes stdin to a file without a banner', async () => {
		const cli = output();

		expect(
			await runGeneratorCli(
				['--cwd', directory, '--output', 'out.ts', '--no-banner'],
				cli.io('{"type":"string"}'),
				generator()
			)
		).toBe(0);
		expect(readFileSync(path.join(directory, 'out.ts'), 'utf8')).toBe('stdin-code');
		expect(cli.out).toEqual([]);
	});

	test('reports a schema that fails to compile', async () => {
		const cli = output();
		const throwingSchema = vi.fn(async () => {
			throw new Error('invalid schema');
		});

		expect(
			await runGeneratorCli([], cli.io('{}'), generator({ compileSchema: throwingSchema }))
		).toBe(1);
		expect(cli.errors).toEqual(['invalid schema\n']);
	});

	test('compiles a single file to stdout', async () => {
		writeFileSync(path.join(directory, 'a.json'), '{"type":"string"}');
		const cli = output();

		expect(await runGeneratorCli(['a.json', '--cwd', directory], cli.io(), generator())).toBe(0);
		expect(cli.out).toEqual(['// banner\ncode:a.json']);
		expect(compileFile).toHaveBeenCalledWith(path.join(directory, 'a.json'), { mode: 'assert' });
	});

	test('compiles positional input and output paths', async () => {
		mkdirSync(path.join(directory, 'in'));
		writeFileSync(path.join(directory, 'in', 'a.json'), '{"type":"string"}');

		expect(
			await runGeneratorCli(['in/a.json', 'out.ts', '--cwd', directory], output().io(), generator())
		).toBe(0);
		expect(readFileSync(path.join(directory, 'out.ts'), 'utf8')).toBe('// banner\ncode:a.json');
	});

	test('requires an output directory when several files match', async () => {
		writeFileSync(path.join(directory, 'a.json'), '{}');
		writeFileSync(path.join(directory, 'b.yaml'), 'type: string\n');
		const cli = output();

		expect(
			await runGeneratorCli(['*.{json,yaml}', '--cwd', directory], cli.io(), generator())
		).toBe(1);
		expect(cli.errors).toEqual(['An output directory is required when compiling several files.\n']);
	});

	test('compiles a directory into a nested output directory', async () => {
		mkdirSync(path.join(directory, 'schemas', 'nested'), { recursive: true });
		writeFileSync(path.join(directory, 'schemas', 'a.json'), '{}');
		writeFileSync(path.join(directory, 'schemas', 'nested', 'b.yaml'), 'type: string\n');
		const cli = output();

		expect(
			await runGeneratorCli(
				['schemas', '--output', 'generated', '--cwd', directory],
				cli.io(),
				generator()
			)
		).toBe(0);

		expect(readFileSync(path.join(directory, 'generated', 'a.generated.ts'), 'utf8')).toBe(
			'// banner\ncode:a.json'
		);
		expect(
			readFileSync(path.join(directory, 'generated', 'nested', 'b.generated.ts'), 'utf8')
		).toBe('// banner\ncode:b.yaml');
		expect(cli.errors).toEqual([
			`${path.join(directory, 'schemas', 'a.json')} -> ${path.join(directory, 'generated', 'a.generated.ts')}\n`,
			`${path.join(directory, 'schemas', 'nested', 'b.yaml')} -> ${path.join(directory, 'generated', 'nested', 'b.generated.ts')}\n`,
		]);
	});

	test('keeps the directory structure of a glob from its root', async () => {
		mkdirSync(path.join(directory, 'schemas'));
		writeFileSync(path.join(directory, 'schemas', 'a.json'), '{}');
		const cli = output();

		expect(
			await runGeneratorCli(
				['schemas/**/*.json', '--output', 'generated/', '--cwd', directory],
				cli.io(),
				generator()
			)
		).toBe(0);

		expect(readFileSync(path.join(directory, 'generated', 'a.generated.ts'), 'utf8')).toBe(
			'// banner\ncode:a.json'
		);
	});

	test('resolves a glob whose root has no separator', async () => {
		mkdirSync(path.join(directory, 'schemas'));
		writeFileSync(path.join(directory, 'schemas', 'a.json'), '{}');
		const cli = output();

		expect(
			await runGeneratorCli(
				['sch*/a.json', '--output', 'generated/', '--cwd', directory],
				cli.io(),
				generator()
			)
		).toBe(0);

		expect(
			readFileSync(path.join(directory, 'generated', 'schemas', 'a.generated.ts'), 'utf8')
		).toBe('// banner\ncode:a.json');
	});

	test('refuses to overwrite when several inputs map to one output', async () => {
		writeFileSync(path.join(directory, 'a.json'), '{}');
		writeFileSync(path.join(directory, 'a.yaml'), 'type: string\n');
		const cli = output();

		expect(
			await runGeneratorCli(
				['a.{json,yaml}', '--output', 'generated', '--cwd', directory],
				cli.io(),
				generator()
			)
		).toBe(1);
		expect(cli.errors.join('')).toContain('Refusing to overwrite');
	});

	test('reports a pattern without matches', async () => {
		const cli = output();

		expect(
			await runGeneratorCli(['missing/**/*.json', '--cwd', directory], cli.io(), generator())
		).toBe(1);
		expect(cli.errors).toEqual(['No schema files found for "missing/**/*.json"\n']);
	});

	test('reports a file that fails to compile', async () => {
		writeFileSync(path.join(directory, 'a.json'), '{}');
		const cli = output();
		const throwingFile = vi.fn(async () => {
			throw new Error('invalid schema');
		});

		expect(
			await runGeneratorCli(
				['a.json', '--cwd', directory],
				cli.io(),
				generator({ compileFile: throwingFile })
			)
		).toBe(1);
		expect(cli.errors).toEqual(['invalid schema\n']);
	});
});
