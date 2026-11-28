import { exampleById } from './examples';
import { defaultState, loadSavedState, readHash } from './playgroundPersistence';
import {
	readFormatModeParam,
	readInferenceParam,
	readKeywordPolicyParam,
	readUrlState,
} from './urlState';
import type { UrlState } from './urlState';

export { PLAYGROUND_STORAGE_KEY } from './playgroundPersistence';
export { newFileId, resolveExampleId, uniqueName } from './schemaFileNames';

export function loadState(): UrlState {
	const url = new URL(location.href);
	const fromHash =
		readHash() ??
		readUrlState(
			url,
			loadSavedState() ?? defaultState(),
			exampleById(url.searchParams.get('example'))
		) ??
		loadSavedState() ??
		defaultState();
	const keywordPolicy = readKeywordPolicyParam(url);
	const formatMode = readFormatModeParam(url);
	const inference = readInferenceParam(url);
	const state: UrlState = { ...fromHash };

	if (keywordPolicy) {
		state.keywordPolicy = keywordPolicy;
	}

	if (formatMode) {
		state.formatMode = formatMode;
	}

	if (inference !== null && state.target === 'typescript') {
		state.inference = inference;
	}

	return state;
}

export function encodeState(state: UrlState): string {
	const bytes = new TextEncoder().encode(JSON.stringify(state));
	let binary = '';

	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}

	return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}
