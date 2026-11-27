import { parse } from '@utilize/json-schema';
import type { KeywordPolicy } from '@utilize/json-schema';

import { buildBundle, parseJsonFile } from '../bundle';
import type { Problem, SchemaFile } from '../bundle';
import { generatorOptionsFor } from '../exampleOptions';
import type { FormatMode } from '../formatMode';
import { generateCodeFor } from '../generateCode';
import type { RuntimeSource } from '../generateCode';
import { formatTypeScript } from '../monaco/format';
import type { TargetId } from '../targets';

export interface GenerateInput {
	files: readonly SchemaFile[];
	target: TargetId;
	keywordPolicy: KeywordPolicy;
	formatMode: FormatMode;
	exampleId: string | null;
}

export interface GenerateOutput {
	code: string;
	runtime: RuntimeSource | null;
	problems: Problem[];
}

/**
 * Builds the bundle, generates the selected target and formats the result.
 * Errors are reported as problems, so the caller always gets a result.
 */
export async function generateOutput({
	files,
	target,
	keywordPolicy,
	formatMode,
	exampleId,
}: GenerateInput): Promise<GenerateOutput> {
	const rootId = files[0]?.id ?? '';
	const parsedFiles = files.map(parseJsonFile);
	const bundle = buildBundle(parsedFiles, rootId, keywordPolicy);

	let code = '';
	const problems: Problem[] = [];
	let runtime: RuntimeSource | null = null;

	if (bundle.root !== null) {
		try {
			// `parse` resolves the schema in place, so every run gets a copy;
			// otherwise switching targets reuses names chosen for the previous one.
			const { root } = await parse(structuredClone(bundle.root), {
				cwd: '/',
				fileName: bundle.rootFileName,
				keywordPolicy,
				onDialectIssue: () => {},
			});

			const generatorOptions = exampleId ? generatorOptionsFor(exampleId) : undefined;
			const generated = generateCodeFor(target, root, formatMode, generatorOptions);

			runtime = generated.runtime;

			if (generated.runtime?.status === 'failed') {
				problems.push({ severity: 'error', message: generated.runtime.error.message });
			} else {
				const formatCode =
					generatorOptions?.format ??
					((source: string) => formatTypeScript(source).catch(() => source));

				code = await formatCode(generated.code);
			}
		} catch (error) {
			problems.push({
				severity: 'error',
				message: error instanceof Error ? error.message : String(error),
			});
		}
	}

	return { code, runtime, problems };
}
