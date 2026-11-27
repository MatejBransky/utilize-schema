import { beforeEach, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';

import App from './App';
import './polyfills';
import { resetAppState } from './test/savedState';
import { THEME_STORAGE_KEY } from './theme';

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

test('the header pickers are selects rather than text inputs', async () => {
	const screen = await render(<App />);

	expect(document.querySelector('[data-slot="combobox-input"]')).toBeNull();
	expect(document.querySelectorAll('[data-slot="select-trigger"]')).toHaveLength(4);
	await expect.element(screen.getByRole('combobox', { name: 'Generator' })).toBeVisible();
	await expect.element(screen.getByRole('combobox', { name: 'Example' })).toBeVisible();
	await expect.element(screen.getByRole('combobox', { name: 'Keyword policy' })).toBeVisible();
	await expect.element(screen.getByRole('combobox', { name: 'Format' })).toBeVisible();
});

test('the color mode button cycles through auto, light and dark', async () => {
	const screen = await render(<App />);
	const button = screen.getByRole('button', { name: 'Color mode' });

	await button.click();
	await vi.waitFor(() => expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light'));
	await button.click();
	await vi.waitFor(() => expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark'));
	await button.click();
	await vi.waitFor(() => expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('auto'));
});

test('the generator select offers only implemented generators', async () => {
	const screen = await render(<App />);

	await screen.getByRole('combobox', { name: 'Generator' }).click();

	await expect.element(screen.getByRole('option', { name: /Zod/ })).toBeVisible();
	await expect.element(screen.getByRole('option', { name: /Effect Schema/ })).toBeVisible();
	await expect.element(screen.getByRole('option', { name: /TypeScript/ })).toBeVisible();
	expect(screen.getByRole('option', { name: /Valibot/ }).query()).toBeNull();
});

test('choosing a generator from the select updates the generated code', async () => {
	const screen = await render(<App />);

	await screen.getByRole('combobox', { name: 'Generator' }).click();
	await screen.getByRole('option', { name: /Effect Schema/ }).click();

	await vi.waitFor(() =>
		expect(new URL(location.href).searchParams.get('generator')).toBe('effect')
	);
	await expect
		.element(screen.getByRole('combobox', { name: 'Generator' }))
		.toHaveTextContent('Effect Schema');
});
