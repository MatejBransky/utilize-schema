import { parse } from '@utilize/json-schema';
import type { KeywordPolicy } from '@utilize/json-schema';

import type { buildBundle, Problem } from '../bundle';
import { generatorOptionsFor } from '../exampleOptions';
import { generateCodeFor } from '../generateCode';
import type { InferenceMode, RuntimeSource } from '../generateCode';
import { formatTypeScript } from '../monaco/format';
import type { TargetId } from '../targets';
import type { FormatMode } from '../formatMode';

/** Parses, generates and formats one output, collecting any failure as a problem. */
export async function generateOutput(
	bundle: ReturnType<typeof buildBundle>,
	target: TargetId,
	keywordPolicy: KeywordPolicy,
	formatMode: FormatMode,
	inference: InferenceMode,
	exampleId: string | null
): Promise<{ code: string; runtime: RuntimeSource | null; problems: Problem[] }> {
	let nextCode = '';
	const nextProblems: Problem[] = [];
	let nextRuntime: RuntimeSource | null = null;

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
			const generated = generateCodeFor(target, root, formatMode, generatorOptions, {
				inference,
			});

			nextRuntime = generated.runtime;

			if (generated.runtime?.status === 'failed') {
				nextProblems.push({ severity: 'error', message: generated.runtime.error.message });
			} else {
				const formatCode =
					generatorOptions?.format ??
					((source: string) => formatTypeScript(source).catch(() => source));

				nextCode = await formatCode(generated.code);
			}
		} catch (error) {
			nextProblems.push({
				severity: 'error',
				message: error instanceof Error ? error.message : String(error),
			});
		}
	}

	return { code: nextCode, runtime: nextRuntime, problems: nextProblems };
}
