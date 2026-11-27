#!/usr/bin/env node
import { dialectCliHelp } from '@utilize/json-schema';
import type { DialectOptions } from '@utilize/json-schema';
import {
	formatAndDialectFlags,
	isEntrypoint,
	readFormatAndDialectFlags,
	runGeneratorCli,
	validationCliHelp,
} from '@utilize/json-schema/node';
import type { CliFlagValues, CliIo, CliOptionsResult } from '@utilize/json-schema/node';

import { compileFile, compileSchema, withBanner } from './compile';
import type { CompileSchemaOptions } from './compile';

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
                        (.iso.date(), url patterns, ...), annotate keeps format
                        as metadata
  --runtime-import <module>
                        import the oneOf helper from this module
                        (e.g. @utilize/zod/runtime) instead of declaring it
  --no-banner           omit the generated-file banner
${dialectCliHelp}
${validationCliHelp}
  -h, --help            show this help
`;

const parseOptions = {
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
		parseOptions,
		readOptions,
		compileSchema,
		compileFile,
		withBanner,
	});
}

function readOptions(
	values: CliFlagValues<typeof parseOptions>,
	io: CliIo
): CliOptionsResult<CliOptions> {
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
