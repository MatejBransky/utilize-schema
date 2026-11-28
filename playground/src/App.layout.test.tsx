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

test('the schema and test data sections can be resized by keyboard', async () => {
	await page.viewport(1200, 800);

	try {
		const screen = await render(<App />);
		const separator = screen
			.getByRole('separator', { name: 'Resize schema and test data sections' })
			.element();
		const group = separator.closest('[data-slot="resizable"]')!;
		const panelRatio = () => {
			const [top, bottom] = Array.from(
				group.querySelectorAll<HTMLElement>('[data-slot="resizable-panel"]')
			).map((panel) => panel.getBoundingClientRect().height);

			return top / (top + bottom);
		};

		await vi.waitFor(() => expect(separator.getAttribute('aria-valuenow')).toBe('60'));
		await vi.waitFor(() => expect(panelRatio()).toBeCloseTo(0.6, 1));

		separator.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
		await vi.waitFor(() => expect(separator.getAttribute('aria-valuenow')).toBe('58'));
		await vi.waitFor(() => expect(panelRatio()).toBeCloseTo(0.58, 1));

		separator.dispatchEvent(
			new KeyboardEvent('keydown', { key: 'ArrowDown', shiftKey: true, bubbles: true })
		);
		await vi.waitFor(() => expect(separator.getAttribute('aria-valuenow')).toBe('68'));

		separator.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
		await vi.waitFor(() => expect(separator.getAttribute('aria-valuenow')).toBe('20'));

		separator.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
		await vi.waitFor(() => expect(separator.getAttribute('aria-valuenow')).toBe('94'));
	} finally {
		await page.viewport(414, 896);
	}
});

test('resize and collapse controls remain available on narrow screens', async () => {
	await page.viewport(414, 896);

	try {
		const screen = await render(<App />);
		const separator = screen
			.getByRole('separator', { name: 'Resize schema and test data sections' })
			.element();
		const sectionToggle = screen.getByRole('button', { name: 'Test data' });

		await expect.element(separator).toBeVisible();
		await expect.element(sectionToggle).toBeVisible();
		await vi.waitFor(() => expect(separator.getAttribute('aria-valuenow')).toBe('60'));

		separator.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
		await vi.waitFor(() => expect(separator.getAttribute('aria-valuenow')).toBe('62'));

		await sectionToggle.click();
		await vi.waitFor(() =>
			expect(sectionToggle.element().getAttribute('aria-expanded')).toBe('false')
		);
		expect(document.querySelector('#test-data-editor')?.hasAttribute('hidden')).toBe(true);
		await expect.element(separator).toBeVisible();

		await sectionToggle.click();
		await vi.waitFor(() =>
			expect(sectionToggle.element().getAttribute('aria-expanded')).toBe('true')
		);
		await vi.waitFor(() => expect(separator.getAttribute('aria-valuenow')).toBe('62'));
		expect(document.querySelector('#test-data-editor')?.hasAttribute('hidden')).toBe(false);
	} finally {
		await page.viewport(414, 896);
	}
});
