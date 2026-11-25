import type { SchemaFile } from './bundle';
import { defaultExampleId, exampleById, examples } from './examples';
import { defaultFormatMode, isFormatMode } from './formatMode';
import { defaultTarget } from './targets';
import {
	isAvailableTarget,
	isKeywordPolicy,
	readFormatModeParam,
	readKeywordPolicyParam,
	readUrlState,
} from './urlState';
import type { UrlState } from './urlState';

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
		...(keywordPolicy ? { keywordPolicy } : undefined),
		...(formatMode ? { formatMode } : undefined),
	};
}

export function encodeState(state: UrlState): string {
	const bytes = new TextEncoder().encode(JSON.stringify(state));
	let binary = '';

	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}

	return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
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
	if (!value || typeof value !== 'object') {
		return null;
	}

	const state = value as Partial<UrlState>;

	if (!Array.isArray(state.files) || state.files.length === 0 || !state.files.every(isSchemaFile)) {
		return null;
	}

	return {
		files: state.files,
		target: isAvailableTarget(state.target) ? state.target : defaultTarget,
		keywordPolicy: isKeywordPolicy(state.keywordPolicy) ? state.keywordPolicy : 'warn',
		formatMode: isFormatMode(state.formatMode) ? state.formatMode : defaultFormatMode,
	};
}

function readHash(): UrlState | null {
	if (!location.hash.startsWith('#data=')) {
		return null;
	}

	try {
		const base64 = location.hash.slice('#data='.length).replaceAll('-', '+').replaceAll('_', '/');
		const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='));
		const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
		const parsed = JSON.parse(new TextDecoder().decode(bytes));

		return normalizeState(parsed);
	} catch {
		return null;
	}
}
