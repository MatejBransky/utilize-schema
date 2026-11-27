import type { KeywordPolicy } from '@utilize/json-schema';
import type { InferenceMode } from '@utilize/typescript';

import type { SchemaFile } from './bundle';
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

interface UrlOverrides {
	target: TargetId | null;
	keywordPolicy: KeywordPolicy | null;
	formatMode: FormatMode | null;
	inference: InferenceMode | null;
}

type GeneratorSettings = Pick<UrlState, 'target' | 'keywordPolicy' | 'formatMode' | 'inference'>;

function readUrlOverrides(url: URL): UrlOverrides {
	return {
		target: readGeneratorParam(url),
		keywordPolicy: readKeywordPolicyParam(url),
		formatMode: readFormatModeParam(url),
		inference: readInferenceParam(url),
	};
}

function hasOverrides(overrides: UrlOverrides): boolean {
	return (
		overrides.target !== null ||
		overrides.keywordPolicy !== null ||
		overrides.formatMode !== null ||
		overrides.inference !== null
	);
}

function applyOverrides(base: GeneratorSettings, overrides: UrlOverrides): GeneratorSettings {
	return {
		target: overrides.target ?? base.target,
		keywordPolicy: overrides.keywordPolicy ?? base.keywordPolicy,
		formatMode: overrides.formatMode ?? base.formatMode,
		inference: overrides.inference ?? base.inference,
	};
}

export function readUrlState(url: URL, base: UrlState, example?: Example): UrlState | null {
	const overrides = readUrlOverrides(url);

	if (example) {
		const settings = applyOverrides(
			{
				target: defaultTarget,
				keywordPolicy: base.keywordPolicy,
				formatMode: base.formatMode,
				inference: base.inference,
			},
			overrides
		);

		return {
			files: example.files,
			...settings,
			inference: settings.target === 'typescript' ? settings.inference : base.inference,
			data: exampleData(example),
		};
	}

	if (!hasOverrides(overrides)) {
		return null;
	}

	const settings = applyOverrides(base, overrides);

	return {
		files: base.files,
		...settings,
		inference: settings.target === 'typescript' ? settings.inference : base.inference,
		data: base.data,
	};
}
