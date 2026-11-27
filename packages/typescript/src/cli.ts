#!/usr/bin/env node
import { isEntrypoint, runGeneratorCli, validationCliHelp } from '@utilize/json-schema/node';
import type { CliFlagValues, CliIo } from '@utilize/json-schema/node';

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
  --infer-format-as-string
                        treat a schema that would otherwise be unknown and
                        has "format" as string
  --no-banner           omit the generated-file banner
${validationCliHelp}
  -h, --help            show this help
`;

const parseOptions = {
	'infer-format-as-string': { type: 'boolean', default: false },
} as const;

export async function run(
	argv: string[],
	io: CliIo = { stdout: process.stdout, stderr: process.stderr }
): Promise<number> {
	return runGeneratorCli(argv, io, {
		help: HELP,
		parseOptions,
		readOptions: (values: CliFlagValues<typeof parseOptions>) => ({
			ok: true,
			options: { inferFormatAsString: values['infer-format-as-string'] },
		}),
		compileSchema,
		compileFile,
		withBanner,
	});
}

if (isEntrypoint(process.argv[1], import.meta.url)) {
	process.exitCode = await run(process.argv.slice(2));
}
