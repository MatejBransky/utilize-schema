import { BrowserHost } from '@effect/ui/html';
import { Effect, Fiber, Layer } from 'effect';
import { afterEach, expect, test, vi } from 'vitest';

import {
	loadState,
	newFileId,
	normalizeState,
	PLAYGROUND_STORAGE_KEY,
	uniqueName,
} from '../playgroundState';
import '../polyfills';

import { App } from './App';

afterEach(() => {
	localStorage.clear();
	history.replaceState(null, '', '/');
	document.body.replaceChildren();
});

test('loads the saved workspace and lets URL settings win', () => {
	localStorage.setItem(
		PLAYGROUND_STORAGE_KEY,
		JSON.stringify({
			files: [{ id: 'saved', name: 'saved.json', content: '{}' }],
			target: 'unknown',
			keywordPolicy: 'ignore',
			formatMode: 'unknown',
			data: '{"saved":true}',
		})
	);
	history.replaceState(null, '', '/?keyword-policy=error&format-mode=annotate');

	const state = loadState();

	expect(state.files).toHaveLength(1);
	expect(state.files[0]?.name).toBe('saved.json');
	expect(state.target).toBe('zod');
	expect(state.keywordPolicy).toBe('error');
	expect(state.formatMode).toBe('annotate');
	expect(state.data).toBe('{"saved":true}');
});

test('falls back to the default example when nothing is saved', () => {
	const state = loadState();

	expect(state.files.length).toBeGreaterThan(0);
	expect(state.target).toBe('zod');
});

test('ignores malformed saved state', () => {
	localStorage.setItem(PLAYGROUND_STORAGE_KEY, '{');
	history.replaceState(null, '', '/');

	expect(loadState().files.length).toBeGreaterThan(0);
});

test('normalizes a saved state with missing settings', () => {
	const state = normalizeState({
		files: [{ id: 'a', name: 'a.json', content: '{}' }],
	});

	expect(state?.target).toBe('zod');
	expect(state?.keywordPolicy).toBe('warn');
	expect(state?.formatMode).toBe('assert');
	expect(state?.data).toBe('{}');
});

test('rejects a saved state without usable files', () => {
	expect(normalizeState({ files: [] })).toBeNull();
	expect(normalizeState({ files: [{ id: 1 }] })).toBeNull();
	expect(normalizeState(null)).toBeNull();
});

test('uniqueName adds a counter before the extension', () => {
	const files = [
		{ id: 'a', name: 'schema.json', content: '{}' },
		{ id: 'b', name: 'schema-2.json', content: '{}' },
	];

	expect(uniqueName('schema.json', files)).toBe('schema-3.json');
	expect(uniqueName('other.json', files)).toBe('other.json');
});

test('newFileId returns distinct ids', () => {
	expect(newFileId()).not.toBe(newFileId());
});

test('mounts the app and validates the default workspace', async () => {
	const root = document.createElement('div');

	document.body.append(root);
	localStorage.clear();
	history.replaceState(null, '', '/');

	const fiber = Effect.runFork(Layer.launch(BrowserHost.mount(App, {}, root)));

	try {
		await vi.waitFor(
			() => expect(root.querySelector('[data-testid="validator-results"]')).not.toBeNull(),
			{ timeout: 30_000 }
		);
		await vi.waitFor(
			() =>
				expect(root.querySelector('[data-testid^="result-"]')?.getAttribute('data-status')).toBe(
					'valid'
				),
			{ timeout: 30_000 }
		);
	} finally {
		await Effect.runPromise(Fiber.interrupt(fiber));
	}
}, 60_000);
