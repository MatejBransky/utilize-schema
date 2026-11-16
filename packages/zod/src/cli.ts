#!/usr/bin/env node
import { existsSync, globSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

import { load as loadYaml } from 'js-yaml';

import { type JSONSchema } from '@utilize/json-schema';

import { compileFile, compileSchema, withBanner } from './compile';

interface Writable {
	write(chunk: string): unknown;
}

export interface CliIo {
	stdout: Writable;
	stderr: Writable;
	/** Source used when no input file is given. Defaults to the process stdin. */
	stdin?: string;
}

const HELP = `Usage: utilize-zod [input] [output]

Compile JSON Schema (JSON or YAML) to Zod schemas.

Arguments:
  input                 schema file, directory or glob (default: stdin)
  output                output file or directory (default: stdout)

Options:
  -i, --input <path>    schema file, directory or glob
  -o, --output <path>   output file or directory
  --cwd <path>          directory used to resolve paths
  --readonly            map readOnly: true to .readonly()
  --no-banner           omit the generated-file banner
  -h, --help            show this help
`;

export async function run(
	argv: string[],
	io: CliIo = { stdout: process.stdout, stderr: process.stderr }
): Promise<number> {
	let parsed;

	try {
		parsed = parseArgs({
			args: argv,
			allowPositionals: true,
			options: {
				input: { type: 'string', short: 'i' },
				output: { type: 'string', short: 'o' },
				cwd: { type: 'string' },
				readonly: { type: 'boolean', default: false },
				'no-banner': { type: 'boolean', default: false },
				help: { type: 'boolean', short: 'h', default: false },
			},
		});
	} catch (error) {
		io.stderr.write(`${(error as Error).message}\n`);
		return 1;
	}

	const { values, positionals } = parsed;

	if (values.help) {
		io.stdout.write(HELP);
		return 0;
	}

	const cwd = path.resolve(values.cwd ?? process.cwd());
	const input = values.input ?? positionals[0];
	const output = values.output ?? positionals[1];
	const banner = values['no-banner'] ? false : undefined;
	const readOnlyKeyword = values.readonly;

	try {
		if (!input) {
			const source = io.stdin ?? (await readStdin());
			const code = await compileSchema(parseSchema(source), {
				cwd,
				fileName: 'Root.json',
				readOnlyKeyword,
			});
			const content = withBanner(code, banner);

			if (output) {
				writeFile(path.resolve(cwd, output), content);
			} else {
				io.stdout.write(content);
			}

			return 0;
		}

		const files = discover(input, cwd);

		if (files.length === 0) {
			io.stderr.write(`No schema files found for "${input}"\n`);
			return 1;
		}

		if (files.length > 1 && !output) {
			io.stderr.write('An output directory is required when compiling several files.\n');
			return 1;
		}

		const outputDirectory = output ? resolveOutputDirectory(output, cwd, files.length) : undefined;

		for (const file of files) {
			const code = await compileFile(file.path, { readOnlyKeyword });
			const content = withBanner(code, banner);

			if (!output) {
				io.stdout.write(content);
				continue;
			}

			const target = outputDirectory
				? path.resolve(cwd, output, outputName(file.relative))
				: path.resolve(cwd, output);

			writeFile(target, content);
			io.stderr.write(`${file.path} -> ${target}\n`);
		}

		return 0;
	} catch (error) {
		io.stderr.write(`${(error as Error).message}\n`);
		return 1;
	}
}

interface InputFile {
	path: string;
	/** Path used to name the output file, relative to the input root. */
	relative: string;
}

function discover(input: string, cwd: string): InputFile[] {
	const resolved = path.resolve(cwd, input);

	if (existsSync(resolved) && statSync(resolved).isDirectory()) {
		// eslint-disable-next-line unicorn/no-array-sort -- globSync returns a fresh array
		const matches = globSync('**/*.{json,yaml,yml}', { cwd: resolved }).sort();

		return matches.map((file) => ({ path: path.join(resolved, file), relative: file }));
	}

	if (/[*?[\]{}]/.test(input)) {
		// eslint-disable-next-line unicorn/no-array-sort -- globSync returns a fresh array
		const matches = globSync(input, { cwd }).sort();

		return matches.map((file) => ({
			path: path.resolve(cwd, file),
			relative: path.basename(file),
		}));
	}

	return [{ path: resolved, relative: path.basename(resolved) }];
}

function resolveOutputDirectory(output: string, cwd: string, count: number): boolean {
	if (count > 1 || /[\\/]$/.test(output)) {
		return true;
	}

	const resolved = path.resolve(cwd, output);

	return existsSync(resolved) && statSync(resolved).isDirectory();
}

function outputName(relative: string) {
	return `${relative.replace(/\.(json|ya?ml)$/i, '')}.generated.ts`;
}

function parseSchema(source: string): JSONSchema {
	try {
		return JSON.parse(source) as JSONSchema;
	} catch {
		return loadYaml(source) as JSONSchema;
	}
}

function writeFile(target: string, content: string) {
	mkdirSync(path.dirname(target), { recursive: true });
	writeFileSync(target, content, 'utf8');
}

async function readStdin() {
	const chunks: Buffer[] = [];

	for await (const chunk of process.stdin) {
		chunks.push(Buffer.from(chunk as Buffer));
	}

	return Buffer.concat(chunks).toString('utf8');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	process.exitCode = await run(process.argv.slice(2));
}
