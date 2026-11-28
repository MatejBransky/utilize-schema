import type { KeywordPolicy } from '@utilize/json-schema';
import { useEffect, useMemo, useState } from 'react';

import type { Problem, SchemaFile } from '../bundle';
import { buildBundle, parseJsonFile } from '../bundle';
import type { FormatMode } from '../formatMode';
import type { InferenceMode, RuntimeSource } from '../generateCode';
import { resolveExampleId } from '../playgroundState';
import { collectProblems } from '../problems';
import type { TargetId } from '../targets';
import { validateSchemas } from '../validation';
import { generateOutput } from './generateOutput';

/** Debounced generation of the output pane plus the problems that feed it. */
export function useGeneration(
	files: SchemaFile[],
	target: TargetId,
	keywordPolicy: KeywordPolicy,
	formatMode: FormatMode,
	inference: InferenceMode
) {
	const [code, setCode] = useState('');
	const [runtime, setRuntime] = useState<RuntimeSource | null>(null);
	const [busy, setBusy] = useState(false);
	const [generationProblems, setGenerationProblems] = useState<Problem[]>([]);
	const rootId = files[0]?.id ?? '';
	const exampleId = useMemo(() => resolveExampleId(files), [files]);
	const parsedFiles = useMemo(() => files.map(parseJsonFile), [files]);
	const schemaProblems = useMemo(() => validateSchemas(parsedFiles), [parsedFiles]);
	const bundle = useMemo(
		() => buildBundle(parsedFiles, rootId, keywordPolicy),
		[parsedFiles, rootId, keywordPolicy]
	);
	const problems = useMemo(
		() => collectProblems(schemaProblems, bundle.problems, generationProblems),
		[schemaProblems, bundle.problems, generationProblems]
	);

	useEffect(() => {
		let cancelled = false;
		setBusy(true);

		async function generate() {
			const next = await generateOutput(
				bundle,
				target,
				keywordPolicy,
				formatMode,
				inference,
				exampleId
			);

			if (!cancelled) {
				setCode(next.code);
				setRuntime(next.runtime);
				setGenerationProblems(next.problems);
				setBusy(false);
			}
		}

		const timer = setTimeout(() => {
			void generate();
		}, 300);

		return () => {
			cancelled = true;
			clearTimeout(timer);
		};
	}, [bundle, exampleId, target, keywordPolicy, formatMode, inference]);

	return { exampleId, problems, code, runtime, busy };
}
