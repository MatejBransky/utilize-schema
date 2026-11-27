import { assert, isPlainObject } from '@utilize/json-schema';

import type { SchemaFile } from '../bundle';

export const WORKSPACE_STORAGE_KEY = 'utilize-schema-playground';

export function resetAppState() {
	localStorage.clear();
	history.replaceState(null, '', '/');
}

function parseSavedState(fallback: string): Record<string, unknown> {
	const state: unknown = JSON.parse(localStorage.getItem(WORKSPACE_STORAGE_KEY) ?? fallback);

	assert(isPlainObject(state), 'Expected the saved workspace to be an object.');

	return state;
}

function isSchemaFile(value: unknown): value is SchemaFile {
	return (
		isPlainObject(value) &&
		typeof value.id === 'string' &&
		typeof value.name === 'string' &&
		typeof value.content === 'string'
	);
}

export function savedFiles(): SchemaFile[] {
	const files = parseSavedState('{"files":[]}').files;

	assert(Array.isArray(files), 'Expected the saved workspace files to be an array.');

	const schemas = files.filter(isSchemaFile);

	assert(schemas.length === files.length, 'Expected every saved workspace file to be valid.');

	return schemas;
}

export function savedData(): string {
	const data = parseSavedState('{"data":""}').data;

	assert(typeof data === 'string', 'Expected the saved test data to be a string.');

	return data;
}

export function seedWorkspace(state: unknown) {
	localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(state));
}

export function encodeWorkspaceState(state: unknown): string {
	return btoa(JSON.stringify(state)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}
