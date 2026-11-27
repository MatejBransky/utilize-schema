import { beforeEach, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';

import App from './App';
import './polyfills';
import { dragIn, droppedSchemas, fileDrag } from './test/dragDrop';
import { resetAppState } from './test/savedState';

vi.mock('./monaco/format', () => ({
	formatTypeScript: async (source: string) => source,
}));

vi.mock('./monaco/MonacoEditor', async () => {
	const { createMonacoEditorMock } = await import('./test/monacoEditorMock');

	return createMonacoEditorMock();
});

beforeEach(() => {
	resetAppState();
});

test('dragging JSON files over the editor shows the add and replace targets', async () => {
	const screen = await render(<App />);

	await dragIn(droppedSchemas);

	await expect.element(screen.getByTestId('file-drop-overlay')).toBeVisible();
	await expect.element(screen.getByText('Add to this workspace')).toBeVisible();
	await expect.element(screen.getByText('Start from the dropped files')).toBeVisible();
});

test('the highlighted drop target follows the pointer', async () => {
	await render(<App />);

	await dragIn(droppedSchemas);

	const add = document.querySelector('[data-drop-mode="add"]')!;
	const replace = document.querySelector('[data-drop-mode="replace"]')!;

	add.dispatchEvent(fileDrag('dragover', droppedSchemas));
	await vi.waitFor(() => expect(add.getAttribute('data-active')).toBe('true'));
	expect(replace.hasAttribute('data-active')).toBe(false);

	replace.dispatchEvent(fileDrag('dragover', droppedSchemas));
	await vi.waitFor(() => expect(replace.getAttribute('data-active')).toBe('true'));
	expect(add.hasAttribute('data-active')).toBe(false);

	document.querySelector('header')!.dispatchEvent(fileDrag('dragover', droppedSchemas));
	await vi.waitFor(() => expect(document.querySelector('[data-active]')).toBeNull());
});
