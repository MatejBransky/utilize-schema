#!/usr/bin/env node
import { dialectCliHelp } from '@utilize/json-schema';
import {
	formatAndDialectFlags,
	isEntrypoint,
	readFormatAndDialectFlags,
	runGeneratorCli,
} from '@utilize/json-schema/node';
import type { CliIo } from '@utilize/json-schema/node';

import { compileFile, compileSchema, withBanner } from './compile';

export { type CliIo, isEntrypoint };

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
	return runGeneratorCli(argv, io, {
		help: HELP,
		parseOptions: formatAndDialectFlags,
		readOptions: readFormatAndDialectFlags,
		compileSchema,
		compileFile,
		withBanner,
	});
}

if (isEntrypoint(process.argv[1], import.meta.url)) {
	process.exitCode = await run(process.argv.slice(2));
}
