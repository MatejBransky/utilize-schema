import type { SchemaFile } from './bundle';
import { defaultExampleId, exampleById, exampleData, examples } from './examples';
import { defaultFormatMode, isFormatMode } from './formatMode';
import { defaultTarget } from './targets';
import {
	isAvailableTarget,
	isKeywordPolicy,
	readFormatModeParam,
	readKeywordPolicyParam,
	readUrlState,
	type UrlState,
} from './urlState';

export const PLAYGROUND_STORAGE_KEY = 'utilize-schema-playground';
const EXAMPLE_PARAM = 'example';

export function loadState(): UrlState {
	const url = new URL(location.href);
	const fromHash =
		readHash() ??
		readUrlState(
			url,
			loadSavedState() ?? defaultState(),
			exampleById(url.searchParams.get(EXAMPLE_PARAM))
		) ??
		loadSavedState() ??
		defaultState();
	const keywordPolicy = readKeywordPolicyParam(url);
	const formatMode = readFormatModeParam(url);

	// The query parameters win over the settings stored in the shared `#data=`
	// hash so they can be changed without editing the hash.
	return {
		...fromHash,
		...(keywordPolicy ? { keywordPolicy } : {}),
		...(formatMode ? { formatMode } : {}),
	};
}

export function encodeState(state: UrlState): string {
	const bytes = new TextEncoder().encode(JSON.stringify(state));
	let binary = '';

	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}

	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function resolveExampleId(files: SchemaFile[]): string | null {
	const match = examples.find(
		(example) =>
			example.files.length === files.length &&
			files.every((file) => {
				const exampleFile = example.files.find((item) => item.id === file.id);

				return (
					exampleFile !== undefined &&
					exampleFile.name === file.name &&
					exampleFile.content === file.content
				);
			})
	);

	return match?.id ?? null;
}

let fileCounter = 0;

export function newFileId(): string {
	fileCounter += 1;

	return globalThis.crypto?.randomUUID?.() ?? `file-${Date.now()}-${fileCounter}`;
}

export function uniqueName(base: string, files: SchemaFile[]): string {
	const names = new Set(files.map((file) => file.name.toLowerCase()));

	if (!names.has(base.toLowerCase())) {
		return base;
	}

	const dot = base.lastIndexOf('.');
	const stem = dot > 0 ? base.slice(0, dot) : base;
	const extension = dot > 0 ? base.slice(dot) : '';
	let counter = 2;

	while (names.has(`${stem}-${counter}${extension}`.toLowerCase())) {
		counter += 1;
	}

	return `${stem}-${counter}${extension}`;
}

function defaultState(): UrlState {
	const example = exampleById(defaultExampleId)!;

	return {
		files: example.files,
		target: defaultTarget,
		keywordPolicy: 'warn',
		formatMode: defaultFormatMode,
		data: exampleData(example),
	};
}

function loadSavedState(): UrlState | null {
	try {
		return normalizeState(JSON.parse(localStorage.getItem(PLAYGROUND_STORAGE_KEY) ?? 'null'));
	} catch {
		// Ignore malformed saved state and fall back to the default example.
		return null;
	}
}

function isSchemaFile(value: unknown): value is SchemaFile {
	if (!value || typeof value !== 'object') {
		return false;
	}

	const file = value as SchemaFile;

	return (
		typeof file.id === 'string' && typeof file.name === 'string' && typeof file.content === 'string'
	);
}

function normalizeState(value: unknown): UrlState | null {
	if (!hasFiles(value)) {
		return null;
	}

	return {
		files: value.files,
		target: isAvailableTarget(value.target) ? value.target : defaultTarget,
		keywordPolicy: isKeywordPolicy(value.keywordPolicy) ? value.keywordPolicy : 'warn',
		formatMode: isFormatMode(value.formatMode) ? value.formatMode : defaultFormatMode,
		data: typeof value.data === 'string' ? value.data : dataForFiles(value.files),
	};
}

function hasFiles(value: unknown): value is Partial<UrlState> & { files: SchemaFile[] } {
	if (!value || typeof value !== 'object') {
		return false;
	}

	const state = value as Partial<UrlState>;

	return Array.isArray(state.files) && state.files.length > 0 && state.files.every(isSchemaFile);
}

/** The test data that belongs to a saved workspace. */
function dataForFiles(files: SchemaFile[]): string {
	const example = exampleById(resolveExampleId(files));

	return example ? exampleData(example) : '{}';
}

function readHash(): UrlState | null {
	if (!location.hash.startsWith('#data=')) {
		return null;
	}

	try {
		const base64 = location.hash.slice('#data='.length).replace(/-/g, '+').replace(/_/g, '/');
		const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='));
		const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
		const parsed = JSON.parse(new TextDecoder().decode(bytes));

		return normalizeState(parsed);
	} catch {
		return null;
	}
}
