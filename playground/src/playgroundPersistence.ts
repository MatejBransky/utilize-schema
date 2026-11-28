import { expectDefined, isPlainObject } from '@utilize/json-schema';

import type { SchemaFile } from './bundle';
import { defaultExampleId, exampleById, exampleData } from './examples';
import { defaultFormatMode, isFormatMode } from './formatMode';
import { resolveExampleId } from './schemaFileNames';
import { defaultTarget } from './targets';
import { isAvailableTarget, isKeywordPolicy } from './urlState';
import type { UrlState } from './urlState';

export const PLAYGROUND_STORAGE_KEY = 'utilize-schema-playground';

function defaultState(): UrlState {
	const example = expectDefined(exampleById(defaultExampleId));

	return {
		files: example.files,
		target: defaultTarget,
		keywordPolicy: 'warn',
		formatMode: defaultFormatMode,
		inference: 'spec',
		data: exampleData(example),
	};
}

function isSchemaFile(value: unknown): value is SchemaFile {
	if (!isPlainObject(value)) {
		return false;
	}

	return (
		typeof value.id === 'string' &&
		typeof value.name === 'string' &&
		typeof value.content === 'string'
	);
}

function hasFiles(value: unknown): value is Partial<UrlState> & { files: SchemaFile[] } {
	if (!value || typeof value !== 'object') {
		return false;
	}

	const state = value as Partial<UrlState>;

	return Array.isArray(state.files) && state.files.length > 0 && state.files.every(isSchemaFile);
}

function dataForFiles(files: SchemaFile[]): string {
	const example = exampleById(resolveExampleId(files));

	return example ? exampleData(example) : '{}';
}

function normalizeState(value: unknown): UrlState | null {
	if (!hasFiles(value)) {
		return null;
	}

	const target = isAvailableTarget(value.target) ? value.target : defaultTarget;

	return {
		files: value.files,
		target,
		keywordPolicy: isKeywordPolicy(value.keywordPolicy) ? value.keywordPolicy : 'warn',
		formatMode: isFormatMode(value.formatMode) ? value.formatMode : defaultFormatMode,
		inference: target === 'typescript' && value.inference === 'pragmatic' ? 'pragmatic' : 'spec',
		data: typeof value.data === 'string' ? value.data : dataForFiles(value.files),
	};
}

export function loadSavedState(): UrlState | null {
	try {
		return normalizeState(JSON.parse(localStorage.getItem(PLAYGROUND_STORAGE_KEY) ?? 'null'));
	} catch {
		// Ignore malformed saved state and fall back to the default example.
		return null;
	}
}

export function readHash(): UrlState | null {
	if (!location.hash.startsWith('#data=')) {
		return null;
	}

	try {
		const base64 = location.hash.slice('#data='.length).replaceAll('-', '+').replaceAll('_', '/');
		const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='));
		const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
		const parsed = JSON.parse(new TextDecoder().decode(bytes)) as unknown;

		return normalizeState(parsed);
	} catch {
		return null;
	}
}

export { defaultState };
