import type { KeywordPolicy } from '@utilize/json-schema';

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
const INFER_FORMAT_AS_STRING_PARAM = 'infer-format-as-string';

export interface UrlState {
	files: SchemaFile[];
	target: TargetId;
	keywordPolicy: KeywordPolicy;
	formatMode: FormatMode;
	inferFormatAsString: boolean;
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

export function readInferFormatAsStringParam(url: URL): boolean | null {
	const value = url.searchParams.get(INFER_FORMAT_AS_STRING_PARAM);

	if (value === 'true') {
		return true;
	}

	if (value === 'false') {
		return false;
	}

	return null;
}

interface UrlOverrides {
	target: TargetId | null;
	keywordPolicy: KeywordPolicy | null;
	formatMode: FormatMode | null;
	inferFormatAsString: boolean | null;
}

type GeneratorSettings = Pick<
	UrlState,
	'target' | 'keywordPolicy' | 'formatMode' | 'inferFormatAsString'
>;

function readUrlOverrides(url: URL): UrlOverrides {
	return {
		target: readGeneratorParam(url),
		keywordPolicy: readKeywordPolicyParam(url),
		formatMode: readFormatModeParam(url),
		inferFormatAsString: readInferFormatAsStringParam(url),
	};
}

function hasOverrides(overrides: UrlOverrides): boolean {
	return (
		overrides.target !== null ||
		overrides.keywordPolicy !== null ||
		overrides.formatMode !== null ||
		overrides.inferFormatAsString !== null
	);
}

function applyOverrides(base: GeneratorSettings, overrides: UrlOverrides): GeneratorSettings {
	return {
		target: overrides.target ?? base.target,
		keywordPolicy: overrides.keywordPolicy ?? base.keywordPolicy,
		formatMode: overrides.formatMode ?? base.formatMode,
		inferFormatAsString: overrides.inferFormatAsString ?? base.inferFormatAsString,
	};
}

export function readUrlState(url: URL, base: UrlState, example?: Example): UrlState | null {
	const overrides = readUrlOverrides(url);

	if (example) {
		return {
			files: example.files,
			...applyOverrides(
				{
					target: defaultTarget,
					keywordPolicy: base.keywordPolicy,
					formatMode: base.formatMode,
					inferFormatAsString: base.inferFormatAsString,
				},
				overrides
			),
			data: exampleData(example),
		};
	}

	if (!hasOverrides(overrides)) {
		return null;
	}

	return {
		files: base.files,
		...applyOverrides(base, overrides),
		data: base.data,
	};
}
