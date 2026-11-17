#!/usr/bin/env node
import { existsSync, globSync, mkdirSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { load as loadYaml } from 'js-yaml';

import {
	type DialectId,
	type DialectOptions,
	dialects,
	formatIssue,
	type JSONSchema,
	type KeywordPolicy,
} from '@utilize/json-schema';

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
  --dialect <id>        force a dialect (draft-04, draft-06, draft-07, 2019-09, 2020-12)
  --fallback-dialect    dialect for schemas without $schema (default: draft-07)
  --unknown-dialect     error (default) or fallback for an unrecognized $schema
  --keyword-policy      error (default), warn or ignore foreign keywords
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
				dialect: { type: 'string' },
				'fallback-dialect': { type: 'string' },
				'unknown-dialect': { type: 'string' },
				'keyword-policy': { type: 'string' },
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
	const dialectOptions = readDialectOptions(values, io);

	if (!dialectOptions) {
		return 1;
	}

	try {
		if (!input) {
			const source = io.stdin ?? (await readStdin());
			const code = await compileSchema(parseSchema(source), {
				cwd,
				fileName: 'Root.json',
				readOnlyKeyword,
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
			const code = await compileFile(file.path, { readOnlyKeyword, ...dialectOptions });
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

const DIALECT_IDS = new Set<string>(Object.keys(dialects));

function readDialectOptions(
	values: {
		dialect?: string;
		'fallback-dialect'?: string;
		'unknown-dialect'?: string;
		'keyword-policy'?: string;
	},
	io: CliIo
): DialectOptions | undefined {
	const dialect = values.dialect;
	const fallbackDialect = values['fallback-dialect'];
	const unknownDialect = values['unknown-dialect'];
	const keywordPolicy = values['keyword-policy'];

	if (dialect !== undefined && dialect !== 'auto' && !DIALECT_IDS.has(dialect)) {
		io.stderr.write(`Unknown dialect "${dialect}"\n`);
		return undefined;
	}

	if (fallbackDialect !== undefined && !DIALECT_IDS.has(fallbackDialect)) {
		io.stderr.write(`Unknown fallback dialect "${fallbackDialect}"\n`);
		return undefined;
	}

	if (unknownDialect !== undefined && unknownDialect !== 'error' && unknownDialect !== 'fallback') {
		io.stderr.write(`--unknown-dialect must be "error" or "fallback"\n`);
		return undefined;
	}

	if (
		keywordPolicy !== undefined &&
		keywordPolicy !== 'error' &&
		keywordPolicy !== 'warn' &&
		keywordPolicy !== 'ignore'
	) {
		io.stderr.write(`--keyword-policy must be "error", "warn" or "ignore"\n`);
		return undefined;
	}

	return {
		dialect: dialect as DialectId | 'auto' | undefined,
		fallbackDialect: fallbackDialect as DialectId | undefined,
		unknownDialect: unknownDialect as 'error' | 'fallback' | undefined,
		keywordPolicy: keywordPolicy as KeywordPolicy | undefined,
		onDialectIssue: (issue) => io.stderr.write(`${formatIssue(issue)}\n`),
	};
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
