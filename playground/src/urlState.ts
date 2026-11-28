import type { KeywordPolicy } from '@utilize/json-schema';

import type { SchemaFile } from './bundle';
import type { InferenceMode } from '@utilize/typescript';
import { exampleData } from './examples';
import type { Example } from './examples';
import { isFormatMode } from './formatMode';
import type { FormatMode } from './formatMode';
import { defaultTarget, isTargetId, targets } from './targets';
import type { TargetId } from './targets';

const GENERATOR_PARAM = 'generator';
const KEYWORD_POLICY_PARAM = 'keyword-policy';
const FORMAT_MODE_PARAM = 'format-mode';
const INFERENCE_PARAM = 'inference';

export interface UrlState {
	files: SchemaFile[];
	target: TargetId;
	keywordPolicy: KeywordPolicy;
	formatMode: FormatMode;
	inference: InferenceMode;
	data: string;
}

export function isAvailableTarget(value: unknown): value is TargetId {
	return isTargetId(value) && targets.some((target) => target.value === value && !target.disabled);
}

export function readGeneratorParam(url: URL): TargetId | null {
	const id = url.searchParams.get(GENERATOR_PARAM);

	return isAvailableTarget(id) ? id : null;
}

export function readKeywordPolicyParam(url: URL): KeywordPolicy | null {
	const value = url.searchParams.get(KEYWORD_POLICY_PARAM);

	return isKeywordPolicy(value) ? value : null;
}

export function isKeywordPolicy(value: unknown): value is KeywordPolicy {
	return value === 'error' || value === 'warn' || value === 'ignore';
}

export function readFormatModeParam(url: URL): FormatMode | null {
	const value = url.searchParams.get(FORMAT_MODE_PARAM);

	return isFormatMode(value) ? value : null;
}

export function readInferenceParam(url: URL): InferenceMode | null {
	const value = url.searchParams.get(INFERENCE_PARAM);

	return value === 'spec' || value === 'pragmatic' ? value : null;
}

export function readUrlState(url: URL, base: UrlState, example?: Example): UrlState | null {
	const target = readGeneratorParam(url);
	const keywordPolicy = readKeywordPolicyParam(url);
	const formatMode = readFormatModeParam(url);
	const inference = readInferenceParam(url);

	if (!example && !target && !keywordPolicy && !formatMode && inference === null) {
		return null;
	}

	const settings: UrlState = example
		? {
				files: example.files,
				target: defaultTarget,
				keywordPolicy: base.keywordPolicy,
				formatMode: base.formatMode,
				inference: base.inference,
				data: exampleData(example),
			}
		: base;
	const resolvedTarget = target ?? settings.target;

	return {
		files: settings.files,
		target: resolvedTarget,
		keywordPolicy: keywordPolicy ?? settings.keywordPolicy,
		formatMode: formatMode ?? settings.formatMode,
		inference:
			resolvedTarget === 'typescript' ? (inference ?? settings.inference) : settings.inference,
		data: settings.data,
	};
}
