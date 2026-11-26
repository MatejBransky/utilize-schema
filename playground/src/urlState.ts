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

export interface UrlState {
	files: SchemaFile[];
	target: TargetId;
	keywordPolicy: KeywordPolicy;
	formatMode: FormatMode;
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

export function readUrlState(url: URL, base: UrlState, example?: Example): UrlState | null {
	const target = readGeneratorParam(url);
	const keywordPolicy = readKeywordPolicyParam(url);
	const formatMode = readFormatModeParam(url);

	if (example) {
		return {
			files: example.files,
			target: target ?? defaultTarget,
			keywordPolicy: keywordPolicy ?? base.keywordPolicy,
			formatMode: formatMode ?? base.formatMode,
			data: exampleData(example),
		};
	}

	if (!target && !keywordPolicy && !formatMode) {
		return null;
	}

	return {
		files: base.files,
		target: target ?? base.target,
		keywordPolicy: keywordPolicy ?? base.keywordPolicy,
		formatMode: formatMode ?? base.formatMode,
		data: base.data,
	};
}
