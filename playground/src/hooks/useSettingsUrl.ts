import type { KeywordPolicy } from '@utilize/json-schema';
import { useEffect } from 'react';

import type { FormatMode } from '../formatMode';
import type { InferenceMode } from '../generateCode';
import { playgroundParams, updateUrl } from '../playgroundUrl';
import type { TargetId } from '../targets';

/** Keeps the shareable settings in the URL without adding history entries. */
export function useSettingsUrl(
	target: TargetId,
	keywordPolicy: KeywordPolicy,
	formatMode: FormatMode,
	inference: InferenceMode
) {
	useEffect(() => {
		const url = new URL(location.href);
		const inferred = target === 'typescript' ? String(inference) : null;

		if (
			url.hash ||
			(url.searchParams.get(playgroundParams.generator) === target &&
				url.searchParams.get(playgroundParams.keywordPolicy) === keywordPolicy &&
				url.searchParams.get(playgroundParams.formatMode) === formatMode &&
				url.searchParams.get(playgroundParams.inference) === inferred)
		) {
			return;
		}

		updateUrl(
			{
				[playgroundParams.generator]: target,
				[playgroundParams.keywordPolicy]: keywordPolicy,
				[playgroundParams.formatMode]: formatMode,
				[playgroundParams.inference]: inferred,
			},
			'replace'
		);
	}, [target, keywordPolicy, formatMode, inference]);
}
