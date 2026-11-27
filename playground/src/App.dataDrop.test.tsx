import { page } from 'vitest/browser';
import { beforeEach, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';

import App from './App';
import './polyfills';
import { fileDrag } from './test/dragDrop';
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

test('dropping a JSON file on the test data editor replaces the test data', async () => {
	const screen = await render(<App />);
	const editor = document.querySelector('[data-testid="data-editor"]')!;
	const pane = editor.closest('section')!;
	const content = JSON.stringify({ dropped: true }, null, 2);
	const dropped = [{ name: 'payload.json', content }];

	pane.dispatchEvent(fileDrag('dragenter', dropped));

	await expect.element(screen.getByText('Drop a JSON document')).toBeVisible();

	pane.dispatchEvent(fileDrag('drop', dropped));

	await vi.waitFor(() => expect(editor.getAttribute('data-value')).toBe(content));
	await expect.element(screen.getByText('Drop a JSON document')).not.toBeInTheDocument();
});

test('dropping a JSON file on a collapsed test data header is ignored', async () => {
	await page.viewport(1200, 800);

	try {
		const screen = await render(<App />);
		const editor = document.querySelector('[data-testid="data-editor"]')!;
		const pane = editor.closest('section')!;
		const before = editor.getAttribute('data-value');

		await screen.getByRole('button', { name: 'Test data' }).click();
		await vi.waitFor(() =>
			expect(document.querySelector('#test-data-editor')?.hasAttribute('hidden')).toBe(true)
		);

		pane.dispatchEvent(
			fileDrag('dragenter', [{ name: 'payload.json', content: '{"changed":true}' }])
		);
		pane.dispatchEvent(fileDrag('drop', [{ name: 'payload.json', content: '{"changed":true}' }]));
		await new Promise<void>((resolve) => {
			setTimeout(resolve, 250);
		});

		expect(editor.getAttribute('data-value')).toBe(before);
	} finally {
		await page.viewport(414, 896);
	}
});
