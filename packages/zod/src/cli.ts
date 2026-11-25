#!/usr/bin/env node
import { dialectCliHelp, type DialectOptions } from '@utilize/json-schema';
import {
	type CliFlagValues,
	type CliIo,
	type CliOptionsResult,
	formatAndDialectFlags,
	isEntrypoint,
	readFormatAndDialectFlags,
	runGeneratorCli,
} from '@utilize/json-schema/node';

import { compileFile, type CompileSchemaOptions, compileSchema, withBanner } from './compile';

export { type CliIo, isEntrypoint };

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
  --format-mode <mode>  assert (default) validates known formats
                        (.email(), .uuid(), ...), annotate keeps format
                        as metadata
  --runtime-import <module>
                        import the oneOf helper from this module
                        (e.g. @utilize/zod/runtime) instead of declaring it
  --no-banner           omit the generated-file banner
${dialectCliHelp}
  -h, --help            show this help
`;

const flags = {
	readonly: { type: 'boolean', default: false },
	'runtime-import': { type: 'string' },
	...formatAndDialectFlags,
} as const;

type CliOptions = Pick<
	CompileSchemaOptions,
	'readOnlyKeyword' | 'formatMode' | 'runtimeImport' | keyof DialectOptions
>;

export async function run(
	argv: string[],
	io: CliIo = { stdout: process.stdout, stderr: process.stderr }
): Promise<number> {
	return runGeneratorCli(argv, io, {
		help: HELP,
		flags,
		readOptions,
		compileSchema,
		compileFile,
		withBanner,
	});
}

function readOptions(values: CliFlagValues<typeof flags>, io: CliIo): CliOptionsResult<CliOptions> {
	const shared = readFormatAndDialectFlags(values, io);

	if (!shared.ok) {
		return shared;
	}

	return {
		ok: true,
		options: {
			readOnlyKeyword: values.readonly,
			runtimeImport: values['runtime-import'],
			...shared.options,
		},
	};
}

if (isEntrypoint(process.argv[1], import.meta.url)) {
	process.exitCode = await run(process.argv.slice(2));
}
