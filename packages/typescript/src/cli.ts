#!/usr/bin/env node
import { type CliIo, isEntrypoint, runGeneratorCli } from '@utilize/json-schema/node';

import { compileFile, compileSchema, withBanner } from './compile';

export { type CliIo, isEntrypoint };

const HELP = `Usage: utilize-typescript [input] [output]

Compile JSON Schema (JSON or YAML) to TypeScript types.

Arguments:
  input                 schema file, directory or glob (default: stdin)
  output                output file or directory (default: stdout)

Options:
  -i, --input <path>    schema file, directory or glob
  -o, --output <path>   output file or directory
  --cwd <path>          directory used to resolve paths
  --no-banner           omit the generated-file banner
  -h, --help            show this help
`;

export async function run(
	argv: string[],
	io: CliIo = { stdout: process.stdout, stderr: process.stderr }
): Promise<number> {
	return runGeneratorCli(argv, io, {
		help: HELP,
		parseOptions: {},
		readOptions: () => ({ ok: true, options: {} }),
		compileSchema,
		compileFile,
		withBanner,
	});
}

if (isEntrypoint(process.argv[1], import.meta.url)) {
	process.exitCode = await run(process.argv.slice(2));
}
