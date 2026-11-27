import { beforeEach, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';

import App from './App';
import './polyfills';
import { resultStatus } from './test/domQueries';
import { resetAppState, savedData } from './test/savedState';

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

test('the test data is validated by the generated Zod schema', async () => {
	const screen = await render(<App />);

	await expect.element(screen.getByTestId('data-editor')).toBeVisible();
	await expect.element(screen.getByTestId('validator-results')).toBeVisible();
	expect(document.querySelector('[data-testid="result-effect"]')).toBeNull();

	await vi.waitFor(() => expect(resultStatus('zod')).toBe('valid'), { timeout: 15_000 });
	expect(savedData()).toContain('"firstName": "Ada"');

	await screen.getByRole('radio', { name: 'Invalid' }).click();

	await vi.waitFor(() => expect(resultStatus('zod')).toBe('invalid'), { timeout: 15_000 });

	const zodCard = document.querySelector('[data-testid="result-zod"]');

	expect(zodCard?.textContent).toContain('$.address.zip');
	expect(savedData()).toContain('"zip": "12"');
});

test('the result pane follows the selected generator', async () => {
	const screen = await render(<App />);

	await vi.waitFor(() => expect(resultStatus('zod')).toBe('valid'), { timeout: 15_000 });

	await screen.getByRole('combobox', { name: 'Generator' }).click();
	await screen.getByRole('option', { name: /Effect Schema/ }).click();

	await vi.waitFor(() => expect(resultStatus('effect')).toBe('valid'), { timeout: 15_000 });
	expect(document.querySelector('[data-testid="result-zod"]')).toBeNull();

	await screen.getByRole('radio', { name: 'Invalid' }).click();
	await vi.waitFor(() => expect(resultStatus('effect')).toBe('invalid'), { timeout: 15_000 });
	expect(document.querySelector('[data-testid="result-zod"]')).toBeNull();

	await screen.getByRole('combobox', { name: 'Generator' }).click();
	await screen.getByRole('option', { name: /TypeScript/ }).click();

	await expect.element(screen.getByText(/emits types only/)).toBeVisible();
	expect(document.querySelector('[data-testid="result-effect"]')).toBeNull();
});
