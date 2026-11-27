import { page } from 'vitest/browser';
import { beforeEach, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';

import App from './App';
import './polyfills';
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

test('the validation panel can be collapsed', async () => {
	const screen = await render(<App />);
	const sectionToggle = screen.getByRole('button', { name: /Validation/ });
	const body = document.querySelector('#validation-problems');

	expect(sectionToggle.element().getAttribute('aria-expanded')).toBe('true');
	expect(body?.hasAttribute('hidden')).toBe(false);

	await sectionToggle.click();

	await vi.waitFor(() =>
		expect(sectionToggle.element().getAttribute('aria-expanded')).toBe('false')
	);
	expect(body?.hasAttribute('hidden')).toBe(true);

	await sectionToggle.click();

	await vi.waitFor(() =>
		expect(sectionToggle.element().getAttribute('aria-expanded')).toBe('true')
	);
	expect(body?.hasAttribute('hidden')).toBe(false);
});

test('the test data section collapses to its header', async () => {
	await page.viewport(1200, 800);

	try {
		const screen = await render(<App />);
		const sectionToggle = screen.getByRole('button', { name: 'Test data' });
		const editor = screen.getByTestId('data-editor').element();
		const editorPanel = editor.closest('#test-data-editor');
		const results = document.querySelector('#validator-results-panel');

		expect(sectionToggle.element().getAttribute('aria-expanded')).toBe('true');
		expect(editorPanel?.hasAttribute('hidden')).toBe(false);
		expect(results?.hasAttribute('hidden')).toBe(false);

		await sectionToggle.click();

		await vi.waitFor(() =>
			expect(sectionToggle.element().getAttribute('aria-expanded')).toBe('false')
		);
		const collapsedRow = document.getElementById('test-data-row');
		await vi.waitFor(() => expect(collapsedRow?.hasAttribute('data-collapsed')).toBe(true));
		await vi.waitFor(() => expect(collapsedRow?.getBoundingClientRect().height).toBeLessThan(60));
		expect(editorPanel?.hasAttribute('hidden')).toBe(true);
		expect(results?.hasAttribute('hidden')).toBe(true);
		expect(document.querySelector('[data-testid="data-editor"]')).toBe(editor);

		await sectionToggle.click();

		await vi.waitFor(() =>
			expect(sectionToggle.element().getAttribute('aria-expanded')).toBe('true')
		);
		expect(editorPanel?.hasAttribute('hidden')).toBe(false);
		expect(results?.hasAttribute('hidden')).toBe(false);
		expect(collapsedRow?.getBoundingClientRect().height).toBeGreaterThan(60);
		expect(document.querySelector('[data-testid="data-editor"]')).toBe(editor);
	} finally {
		await page.viewport(414, 896);
	}
});
