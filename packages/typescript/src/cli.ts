#!/usr/bin/env node
import { isEntrypoint, runGeneratorCli, validationCliHelp } from '@utilize/json-schema/node';
import type { CliFlagValues, CliIo, CliOptionsResult } from '@utilize/json-schema/node';

import { compileFile, compileSchema, withBanner } from './compile';
import type { InferenceMode } from './render/context';

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
  --inference <mode>    spec (default) keeps scalar keywords unknown;
                        pragmatic infers string/number/array from the keyword
                        family (format, minimum, contains, ...)
  --no-banner           omit the generated-file banner
${validationCliHelp}
  -h, --help            show this help
`;

const parseOptions = {
	inference: { type: 'string', default: 'spec' },
} as const;

function readInference(value: string): CliOptionsResult<{ inference: InferenceMode }> {
	if (value === 'spec' || value === 'pragmatic') {
		return { ok: true, options: { inference: value } };
	}

	return { ok: false, error: `Unknown inference mode "${value}"; expected "spec" or "pragmatic".` };
}

export async function run(
	argv: string[],
	io: CliIo = { stdout: process.stdout, stderr: process.stderr }
): Promise<number> {
	return runGeneratorCli(argv, io, {
		help: HELP,
		parseOptions,
		readOptions: (values: CliFlagValues<typeof parseOptions>) => readInference(values.inference),
		compileSchema,
		compileFile,
		withBanner,
	});
}

if (isEntrypoint(process.argv[1], import.meta.url)) {
	process.exitCode = await run(process.argv.slice(2));
}
