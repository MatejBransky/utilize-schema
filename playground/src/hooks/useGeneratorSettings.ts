import type { KeywordPolicy } from '@utilize/json-schema';
import { useState } from 'react';

import type { FormatMode } from '../formatMode';
import type { InferenceMode } from '../generateCode';
import { playgroundParams, updateUrl } from '../playgroundUrl';
import type { TargetId } from '../targets';
import type { UrlState } from '../urlState';
import { useSettingsUrl } from './useSettingsUrl';

/** Generator settings and the handlers that also push each change to the URL. */
export function useGeneratorSettings(initial: UrlState) {
	const [target, setTarget] = useState<TargetId>(initial.target);
	const [keywordPolicy, setKeywordPolicy] = useState<KeywordPolicy>(initial.keywordPolicy);
	const [formatMode, setFormatMode] = useState<FormatMode>(initial.formatMode);
	const [inference, setInference] = useState(initial.inference);

	useSettingsUrl(target, keywordPolicy, formatMode, inference);

	function applyGenerator(id: TargetId) {
		setTarget(id);
		updateUrl(
			{
				[playgroundParams.generator]: id,
				[playgroundParams.inference]: id === 'typescript' ? String(inference) : null,
			},
			'push'
		);
	}

	function applyKeywordPolicy(policy: KeywordPolicy) {
		setKeywordPolicy(policy);
		updateUrl({ [playgroundParams.keywordPolicy]: policy }, 'push');
	}

	function applyFormatMode(mode: FormatMode) {
		setFormatMode(mode);
		updateUrl({ [playgroundParams.formatMode]: mode }, 'push');
	}

	function applyInference(value: InferenceMode) {
		setInference(value);
		updateUrl({ [playgroundParams.inference]: value }, 'push');
	}

	return {
		target,
		keywordPolicy,
		formatMode,
		inference,
		setTarget,
		setKeywordPolicy,
		setFormatMode,
		setInference,
		applyGenerator,
		applyKeywordPolicy,
		applyFormatMode,
		applyInference,
	};
}
