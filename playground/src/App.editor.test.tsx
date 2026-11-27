import { assert } from '@utilize/json-schema';
import { page } from 'vitest/browser';
import { beforeEach, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';

import App from './App';
import './polyfills';
import { tabNames } from './test/domQueries';
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

test('the copy button resets when the schema changes', async () => {
	Object.defineProperty(navigator, 'clipboard', {
		configurable: true,
		value: { writeText: async () => {} },
	});

	const screen = await render(<App />);
	const copy = screen.getByRole('button', { name: 'Copy code' });

	await vi.waitFor(() => {
		const element = copy.element();

		assert('disabled' in element, 'Expected the copy control to be a button.');
		expect(element.disabled).toBe(false);
	});
	await copy.click();
	await expect.element(screen.getByRole('button', { name: 'Copied' })).toBeVisible();

	await screen.getByLabelText('Rename person.json').click();
	await screen.getByLabelText('File name').fill('contact.json');
	await screen.getByLabelText('Confirm rename').click();

	await expect.element(screen.getByRole('button', { name: 'Copy code' })).toBeVisible();
	await expect.element(screen.getByRole('button', { name: 'Copied' })).not.toBeInTheDocument();
});

test('the schema editor fills its pane', async () => {
	await page.viewport(1200, 800);

	try {
		const screen = await render(<App />);
		const editor = screen.getByTestId('schema-editor').element();

		await vi.waitFor(() => expect(editor.getBoundingClientRect().height).toBeGreaterThan(100));
	} finally {
		await page.viewport(414, 896);
	}
});

test('clicking outside the rename input cancels the rename', async () => {
	const screen = await render(<App />);

	await screen.getByLabelText('Rename person.json').click();
	await screen.getByLabelText('File name').fill('renamed.json');
	await screen.getByText('Generated TypeScript').click();

	await expect.element(screen.getByLabelText('File name')).not.toBeInTheDocument();
	expect(tabNames().some((name) => name.includes('person.json'))).toBe(true);
});

test('rejects renaming to an existing file name', async () => {
	const screen = await render(<App />);

	await screen.getByLabelText('Rename person.json').click();
	await screen.getByLabelText('File name').fill('address.json');
	await screen.getByLabelText('Confirm rename').click();

	await expect.element(screen.getByText('A file with this name already exists.')).toBeVisible();
	expect(screen.getByLabelText('File name')).toBeInTheDocument();
});
