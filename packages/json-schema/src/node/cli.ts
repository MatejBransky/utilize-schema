import { existsSync, globSync, mkdirSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs, type ParseArgsOptionsConfig } from 'node:util';

import { dialectCliOptions, readDialectCliOptions } from '../cliOptions';
import { type DialectIssue, type DialectOptions, formatIssue } from '../dialect';
import type { JSONSchema } from '../model';
import { parseSchemaSource } from './compile';

interface Writable {
	write(chunk: string): unknown;
}

export interface CliIo {
	stdout: Writable;
	stderr: Writable;
	/** Source used when no input file is given. Defaults to the process stdin. */
	stdin?: string;
}

/** The flags every generator CLI accepts, next to its own. */
const commonFlags = {
	input: { type: 'string', short: 'i' },
	output: { type: 'string', short: 'o' },
	cwd: { type: 'string' },
	'no-banner': { type: 'boolean', default: false },
	help: { type: 'boolean', short: 'h', default: false },
} as const;

/** The values `parseArgs` returns for `Flags`. */
export type CliFlagValues<Flags extends ParseArgsOptionsConfig> = ReturnType<
	typeof parseArgs<{ args: string[]; allowPositionals: true; options: Flags }>
>['values'];

/** Compile options read from the flags, or the message to print when a flag is invalid. */
export type CliOptionsResult<Options> =
	| { ok: true; options: Options }
	| { ok: false; error: string };

/** What a generator plugs into `runGeneratorCli`. */
export interface GeneratorCli<Flags extends ParseArgsOptionsConfig, Options> {
	/** Printed for `--help`. */
	help: string;
	/** The generator's own `parseArgs` flags. `input`, `output`, `cwd`, `no-banner` and `help` are added. */
	flags: Flags;
	/** Turns the generator's flags into compile options. */
	readOptions(values: CliFlagValues<Flags>, io: CliIo): CliOptionsResult<Options>;
	/** Compiles schema text read from stdin. */
	compileSchema(
		schema: JSONSchema,
		options: Options & { cwd: string; fileName: string }
	): Promise<string>;
	/** Compiles one schema file. */
	compileFile(filePath: string, options: Options): Promise<string>;
	/** Adds the generator's banner, or leaves it out for `false`. */
	withBanner(code: string, bannerComment?: false): string;
}

/**
 * Runs a generator CLI: reads the schema from stdin, a file, a directory or a
 * glob, and writes the generated code to stdout, a file or a directory.
 * Returns the exit code.
 */
export async function runGeneratorCli<Flags extends ParseArgsOptionsConfig, Options>(
	argv: string[],
	io: CliIo,
	cli: GeneratorCli<Flags, Options>
): Promise<number> {
	const flags: ParseArgsOptionsConfig = { ...commonFlags, ...cli.flags };
	let parsed;

	try {
		parsed = parseArgs({ args: argv, allowPositionals: true, options: flags });
	} catch (error) {
		io.stderr.write(`${(error as Error).message}\n`);
		return 1;
	}

	const { positionals } = parsed;
	// `flags` loses the literal types `parseArgs` infers the values from, so they are restored here.
	const values = parsed.values as CliFlagValues<typeof commonFlags>;

	if (values.help) {
		io.stdout.write(cli.help);
		return 0;
	}

	const cwd = path.resolve(values.cwd ?? process.cwd());
	const input = values.input ?? positionals[0];
	const output = values.output ?? positionals[1];
	const banner = values['no-banner'] ? false : undefined;
	const options = cli.readOptions(parsed.values as CliFlagValues<Flags>, io);

	if (!options.ok) {
		io.stderr.write(`${options.error}\n`);
		return 1;
	}

	try {
		if (!input) {
			const source = io.stdin ?? (await readStdin());
			const code = await cli.compileSchema(parseSchemaSource(source), {
				cwd,
				fileName: 'Root.json',
				...options.options,
			});
			const content = cli.withBanner(code, banner);

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

		const targets = output ? outputTargets(files, output, cwd) : [];
		const duplicate = targets.find((target, index) => targets.indexOf(target) !== index);

		if (duplicate) {
			io.stderr.write(
				`Refusing to overwrite ${duplicate}; several inputs map to the same output file.\n`
			);
			return 1;
		}

		for (const [index, file] of files.entries()) {
			const code = await cli.compileFile(file.path, options.options);
			const content = cli.withBanner(code, banner);

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

/**
 * The flags of generators that validate `format` and read every dialect:
 * `--format-mode` plus the dialect flags (`dialectCliOptions`).
 */
export const formatAndDialectFlags = {
	'format-mode': { type: 'string', default: 'assert' },
	...dialectCliOptions,
} as const;

export interface FormatAndDialectOptions extends DialectOptions {
	formatMode: 'annotate' | 'assert';
}

/**
 * Reads `formatAndDialectFlags` into compile options. Dialect issues found
 * while parsing are printed to stderr.
 */
export function readFormatAndDialectFlags(
	values: CliFlagValues<typeof formatAndDialectFlags>,
	io: CliIo
): CliOptionsResult<FormatAndDialectOptions> {
	const dialect = readDialectCliOptions(values);

	if (!dialect.ok) {
		return dialect;
	}

	const formatMode = values['format-mode'];

	if (formatMode !== 'annotate' && formatMode !== 'assert') {
		return {
			ok: false,
			error: `Unknown format mode "${formatMode}"; expected "annotate" or "assert".`,
		};
	}

	return {
		ok: true,
		options: {
			formatMode,
			...dialect.options,
			onDialectIssue: (issue: DialectIssue) => io.stderr.write(`${formatIssue(issue)}\n`),
		},
	};
}

/** True when `entry` (usually `process.argv[1]`) is the module at `moduleUrl`, also through a symlink. */
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

/** One output file per input: inside `output` when it is a directory, else `output` itself. */
function outputTargets(files: InputFile[], output: string, cwd: string): string[] {
	const outputDirectory = isOutputDirectory(output, cwd, files.length);

	return files.map((file) =>
		outputDirectory
			? path.resolve(cwd, output, outputName(file.relative))
			: path.resolve(cwd, output)
	);
}

function isOutputDirectory(output: string, cwd: string, count: number): boolean {
	if (count > 1 || /[\\/]$/.test(output)) {
		return true;
	}

	const resolved = path.resolve(cwd, output);

	return existsSync(resolved) && statSync(resolved).isDirectory();
}

function outputName(relative: string) {
	return `${relative.replace(/\.(json|ya?ml)$/i, '')}.generated.ts`;
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
