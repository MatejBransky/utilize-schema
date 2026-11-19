#!/usr/bin/env node
import { existsSync, globSync, mkdirSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import {
	dialectCliHelp,
	type DialectIssue,
	dialectCliOptions,
	formatIssue,
	type JSONSchema,
	readDialectCliOptions,
} from '@utilize/json-schema';

import { load as loadYaml } from 'js-yaml';

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

const HELP = `Usage: utilize-effect [input] [output]

Compile JSON Schema (JSON or YAML) to Effect Schema codecs.

Arguments:
  input                 schema file, directory or glob (default: stdin)
  output                output file or directory (default: stdout)

Options:
  -i, --input <path>    schema file, directory or glob
  -o, --output <path>   output file or directory
  --cwd <path>          directory used to resolve paths
  --format-mode <mode>  assert (default) validates known formats,
                        annotate keeps format as metadata
  --no-banner           omit the generated-file banner
${dialectCliHelp}
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
				'format-mode': { type: 'string', default: 'assert' },
				'no-banner': { type: 'boolean', default: false },
				...dialectCliOptions,
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
	const formatMode = values['format-mode'];
	const dialectCli = readDialectCliOptions(values);

	if (!dialectCli.ok) {
		io.stderr.write(`${dialectCli.error}\n`);
		return 1;
	}

	if (formatMode !== 'annotate' && formatMode !== 'assert') {
		io.stderr.write(`Unknown format mode "${formatMode}"; expected "annotate" or "assert".\n`);
		return 1;
	}

	const dialectOptions = {
		...dialectCli.options,
		onDialectIssue: (issue: DialectIssue) => io.stderr.write(`${formatIssue(issue)}\n`),
	};

	try {
		if (!input) {
			const source = io.stdin ?? (await readStdin());
			const code = await compileSchema(parseSchema(source), {
				cwd,
				fileName: 'Root.json',
				formatMode,
				...dialectOptions,
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

		const outputDirectory = output ? resolveOutputDirectory(output, cwd, files.length) : false;
		const targets = output
			? files.map((file) =>
					outputDirectory
						? path.resolve(cwd, output, outputName(file.relative))
						: path.resolve(cwd, output)
				)
			: [];

		const duplicate = targets.find((target, index) => targets.indexOf(target) !== index);

		if (duplicate) {
			io.stderr.write(
				`Refusing to overwrite ${duplicate}; several inputs map to the same output file.\n`
			);
			return 1;
		}

		for (const [index, file] of files.entries()) {
			const code = await compileFile(file.path, { formatMode, ...dialectOptions });
			const content = withBanner(code, banner);

			if (!output) {
				io.stdout.write(content);
				continue;
			}

			const target = targets[index]!;

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
		const base = path.resolve(cwd, globRoot(input));

		return matches.map((file) => {
			const absolute = path.resolve(cwd, file);

			return { path: absolute, relative: path.relative(base, absolute) };
		});
	}

	return [{ path: resolved, relative: path.basename(resolved) }];
}

/**
 * The non-magic prefix of a glob, used to keep the input's directory structure
 * in the output. `schemas/**\/*.json` roots at `schemas`.
 */
function globRoot(pattern: string) {
	const magic = pattern.search(/[*?[\]{}]/);
	const prefix = magic === -1 ? pattern : pattern.slice(0, magic);
	const endsWithSeparator = prefix.endsWith('/') || prefix.endsWith(path.sep);
	const root = endsWithSeparator ? prefix.slice(0, -1) : path.dirname(prefix);

	return root === '.' ? '' : root;
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

export function isEntrypoint(entry: string | undefined, moduleUrl: string): boolean {
	if (!entry) {
		return false;
	}

	try {
		return realpathSync(fileURLToPath(moduleUrl)) === realpathSync(entry);
	} catch {
		return false;
	}
}

if (isEntrypoint(process.argv[1], import.meta.url)) {
	process.exitCode = await run(process.argv.slice(2));
}
